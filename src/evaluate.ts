import type { EntryType, JsonValue } from "@typesafe-ai/sdk";
import { isDeepStrictEqual } from "node:util";
import { buildRequest, type JevGateway, type JevReply } from "./jev.js";
import { startTimer } from "./report.js";
import type { ApprovedDefinition, Check, CheckReport, ItemResult, JevAnswer } from "./types.js";

const NOUL_DEFAULTS = { passAt: 0.8, failAt: 0.2 };

type Judgement = Pick<ItemResult, "verdict" | "reason">;

function lookup(state: EntryType, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = state;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = current[key];
  }
  return current;
}

export function skipReason(check: Check, state: EntryType): string | undefined {
  const when = check.applyWhen;
  if (when === undefined) return undefined;
  const actual = lookup(state, when.path);
  if (actual === undefined) return `applyWhen: ${when.path} is absent from state`;
  switch (when.op) {
    case "exists":
      return undefined;
    case "equals":
      return isDeepStrictEqual(actual, when.value)
        ? undefined
        : `applyWhen: ${when.path} is ${JSON.stringify(actual)}, not ${JSON.stringify(when.value)}`;
  }
}

function band(label: string, value: number, passAt: number, failAt: number): Judgement {
  if (value >= passAt) return { verdict: "pass", reason: `${label} ${value} is at or above passAt ${passAt}` };
  if (value <= failAt) return { verdict: "fail", reason: `${label} ${value} is at or below failAt ${failAt}` };
  return { verdict: "review", reason: `${label} ${value} is between failAt ${failAt} and passAt ${passAt}` };
}

function lowConfidence(confidence: number, floor: number | undefined): Judgement | undefined {
  if (floor === undefined || confidence >= floor) return undefined;
  return { verdict: "review", reason: `confidence ${confidence} is below confidenceFloor ${floor}` };
}

function mismatch(check: Check, answer: JevAnswer): Judgement {
  return { verdict: "error", reason: `answer type "${answer.type}" does not match question type "${check.type}"` };
}

function unreachable(value: never): never {
  throw new Error(`unreachable: ${JSON.stringify(value)}`);
}

function judge(check: Check, answer: JevAnswer): Judgement {
  switch (check.type) {
    case "noul":
      if (answer.type !== "noul") return mismatch(check, answer);
      return band("noul", answer.noul, check.passAt ?? NOUL_DEFAULTS.passAt, check.failAt ?? NOUL_DEFAULTS.failAt);
    case "choice": {
      if (answer.type !== "choice") return mismatch(check, answer);
      const mapped = check.options[answer.choice];
      return (
        lowConfidence(answer.confidence, check.confidenceFloor) ??
        (mapped === undefined
          ? { verdict: "review", reason: `choice "${answer.choice}" has no entry in options` }
          : { verdict: mapped, reason: `choice "${answer.choice}" maps to ${mapped}` })
      );
    }
    case "score":
      if (answer.type !== "score") return mismatch(check, answer);
      return lowConfidence(answer.confidence, check.confidenceFloor) ?? band("score", answer.score, check.passAt, check.failAt);
    default:
      return unreachable(check);
  }
}

export async function evaluate(definition: ApprovedDefinition, state: EntryType, jev: JevGateway): Promise<CheckReport> {
  const wall = startTimer();
  const skips = definition.questions.map((check) => skipReason(check, state));
  const asked = definition.questions.filter((_, index) => skips[index] === undefined);
  let reply: JevReply = { answers: {}, usage: { input_tokens: 0, output_tokens: 0 } };
  let jevMs = 0;
  if (asked.length > 0) {
    const jevTimer = startTimer();
    reply = await jev.ask(buildRequest(state, asked));
    jevMs = jevTimer();
  }
  const items = definition.questions.map((check, index): ItemResult => {
    const skip = skips[index];
    if (skip !== undefined) return { id: check.id, verdict: "not_applicable", reason: skip };
    const answer = reply.answers[check.id];
    if (answer === undefined) return { id: check.id, verdict: "error", reason: `no answer for "${check.id}"` };
    return { id: check.id, ...judge(check, answer), answer };
  });
  return {
    definition: { id: definition.id, version: definition.version },
    items,
    usage: reply.usage,
    timing: { wallMs: wall(), jevMs },
  };
}
