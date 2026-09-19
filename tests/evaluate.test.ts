import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { EntryType, SystemOneRequest, Usage } from "@typesafe-ai/sdk";
import {
  evaluate,
  exitCodeFor,
  parseDefinition,
  replayGateway,
  type CheckReport,
  type JevAnswer,
  type JevGateway,
} from "../src/index.js";

interface Replay {
  state: EntryType;
  answers: Record<string, JevAnswer>;
  usage: Usage;
}

const fixture = (path: string): unknown => JSON.parse(readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8"));
const replay = (name: string): Replay => fixture(`replay/${name}.json`) as Replay;
const approvedRaw = (): Record<string, unknown> => fixture("sample-approved.checker.json") as Record<string, unknown>;
const definition = parseDefinition(approvedRaw());
const verdicts = (report: CheckReport): string[] => report.items.map((item) => item.verdict);
const reasonOf = (report: CheckReport, id: string): string | undefined => report.items.find((item) => item.id === id)?.reason;

test("answers inside their bands pass, in one Jev call, with usage copied from the reply", async () => {
  const { state, answers, usage } = replay("pass");
  const jev = replayGateway(answers, usage);
  const report = await evaluate(definition, state, jev);
  assert.deepEqual(verdicts(report), ["pass", "pass", "pass", "pass"]);
  assert.equal(jev.calls, 1);
  assert.deepEqual(report.usage, { input_tokens: 120, output_tokens: 8 });
  assert.deepEqual(report.definition, { id: "sample-paragraph", version: 1 });
  assert.equal(reasonOf(report, "one_claim"), "noul 0.93 is at or above passAt 0.8");
  assert.equal(exitCodeFor(report.items), 0);
});

test("a confident hostile tone maps to fail through the options table", async () => {
  const { state, answers, usage } = replay("fail");
  const report = await evaluate(definition, state, replayGateway(answers, usage));
  assert.deepEqual(verdicts(report), ["pass", "fail", "pass", "pass"]);
  assert.equal(reasonOf(report, "tone"), 'choice "hostile" maps to fail');
  assert.equal(exitCodeFor(report.items), 1);
});

test("a noul between the default bands is review", async () => {
  const { state, answers, usage } = replay("review");
  const report = await evaluate(definition, state, replayGateway(answers, usage));
  assert.deepEqual(verdicts(report), ["review", "pass", "pass", "pass"]);
  assert.equal(reasonOf(report, "one_claim"), "noul 0.5 is between failAt 0.2 and passAt 0.8");
  assert.equal(exitCodeFor(report.items), 2);
});

test("a false applyWhen marks the question not_applicable and leaves it out of the request", async () => {
  const { state, answers, usage } = replay("not-applicable");
  const sent: SystemOneRequest[] = [];
  const jev: JevGateway = {
    async ask(request) {
      sent.push(request);
      return { answers, usage };
    },
  };
  const report = await evaluate(definition, state, jev);
  assert.deepEqual(verdicts(report), ["pass", "pass", "pass", "not_applicable"]);
  assert.equal(reasonOf(report, "cites_source"), "applyWhen: claimsSource is absent from state");
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys(sent[0]!.questions), ["one_claim", "tone", "clarity"]);
  assert.equal(sent[0]!.state, state);
  assert.equal(exitCodeFor(report.items), 0);
});

test("an applicable question without an answer is error", async () => {
  const { state, answers, usage } = replay("missing-answer");
  const report = await evaluate(definition, state, replayGateway(answers, usage));
  assert.deepEqual(verdicts(report), ["pass", "pass", "pass", "error"]);
  assert.equal(reasonOf(report, "cites_source"), 'no answer for "cites_source"');
  assert.equal(exitCodeFor(report.items), 2);
});

test("a choice below its confidence floor is review even when its label maps to pass", async () => {
  const { state, answers, usage } = replay("pass");
  const tone = answers.tone;
  assert.equal(tone?.type, "choice");
  const shaky = { ...answers, tone: { ...tone, confidence: 0.4 } };
  const report = await evaluate(definition, state, replayGateway(shaky, usage));
  assert.deepEqual(verdicts(report), ["pass", "review", "pass", "pass"]);
  assert.equal(reasonOf(report, "tone"), "confidence 0.4 is below confidenceFloor 0.6");
});

test("a choice label missing from options is review", async () => {
  const { state, answers, usage } = replay("pass");
  const tone = answers.tone;
  assert.equal(tone?.type, "choice");
  const odd = { ...answers, tone: { ...tone, choice: "sarcastic" } };
  const report = await evaluate(definition, state, replayGateway(odd, usage));
  assert.equal(reasonOf(report, "tone"), 'choice "sarcastic" has no entry in options');
  assert.deepEqual(verdicts(report), ["pass", "review", "pass", "pass"]);
});

test("a score uses passAt and failAt as bands", async () => {
  const { state, answers, usage } = replay("pass");
  const clarity = answers.clarity;
  assert.equal(clarity?.type, "score");
  const expected: [number, string][] = [
    [0.3, "fail"],
    [1.0, "review"],
    [1.5, "pass"],
  ];
  for (const [score, verdict] of expected) {
    const report = await evaluate(definition, state, replayGateway({ ...answers, clarity: { ...clarity, score } }, usage));
    assert.equal(report.items[2]?.verdict, verdict, `score ${score}`);
  }
});

test("an answer of the wrong type is error", async () => {
  const { state, answers, usage } = replay("pass");
  const swapped = { ...answers, one_claim: answers.tone! };
  const report = await evaluate(definition, state, replayGateway(swapped, usage));
  assert.deepEqual(verdicts(report), ["error", "pass", "pass", "pass"]);
  assert.equal(reasonOf(report, "one_claim"), 'answer type "choice" does not match question type "noul"');
});

test("when nothing applies there is no Jev call and usage is zero", async () => {
  const raw = approvedRaw();
  const gated = {
    ...raw,
    questions: (raw.questions as Record<string, unknown>[]).map((question) => ({
      ...question,
      applyWhen: { path: "audience", op: "equals", value: "experts" },
    })),
  };
  const { state, answers, usage } = replay("pass");
  const jev = replayGateway(answers, usage);
  const report = await evaluate(parseDefinition(gated), state, jev);
  assert.deepEqual(verdicts(report), ["not_applicable", "not_applicable", "not_applicable", "not_applicable"]);
  assert.equal(jev.calls, 0);
  assert.deepEqual(report.usage, { input_tokens: 0, output_tokens: 0 });
  assert.equal(report.timing.jevMs, 0);
  assert.equal(exitCodeFor(report.items), 0);
});

test("applyWhen equals compares the value at a dotted path", async () => {
  const raw = approvedRaw();
  const questions = raw.questions as Record<string, unknown>[];
  questions[3]!.applyWhen = { path: "meta.claimsSource", op: "equals", value: true };
  const { answers, usage } = replay("pass");
  const gated = parseDefinition(raw);
  const nested = await evaluate(gated, { paragraph: "p", meta: { claimsSource: true } }, replayGateway(answers, usage));
  const differing = await evaluate(gated, { paragraph: "p", meta: { claimsSource: false } }, replayGateway(answers, usage));
  assert.equal(nested.items[3]?.verdict, "pass");
  assert.equal(differing.items[3]?.verdict, "not_applicable");
  assert.equal(differing.items[3]?.reason, "applyWhen: meta.claimsSource is false, not true");
});
