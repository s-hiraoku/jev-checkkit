import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SystemOneRequest } from "@typesafe-ai/sdk";
import {
  evaluate,
  exitCodeFor,
  parseDefinition,
  replayGateway,
  skipReason,
  type CheckReport,
  type JevAnswer,
  type JevGateway,
} from "../src/index.js";

const load = (path: string): unknown => JSON.parse(readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8"));

const definition = parseDefinition(load("page-credibility.checker.json"));
const verdicts = (report: CheckReport): [string, string][] => report.items.map((item) => [item.id, item.verdict]);

test("the page-credibility definition parses with eight questions and whole-list approval", () => {
  assert.equal(definition.id, "page-credibility");
  assert.equal(definition.version, 1);
  assert.equal(definition.approval.status, "approved");
  assert.deepEqual(
    definition.questions.map((question) => question.id),
    [
      "identifiable_publisher",
      "site_purpose",
      "disclosed_incentives",
      "evidence_for_claims",
      "separates_fact_and_opinion",
      "unsourced_specifics",
      "self_consistent",
      "certainty_matches_evidence",
    ],
  );
  const choice = definition.questions.find((question) => question.id === "site_purpose");
  assert.equal(choice?.type, "choice");
  if (choice?.type === "choice") {
    assert.deepEqual(Object.keys(choice.criteria).sort(), Object.keys(choice.options).sort());
  }
});

test("a sourced news page replays as all pass in one Jev call", async () => {
  const replay = load("replay/page-credibility-pass.json") as {
    state: Record<string, unknown>;
    answers: Record<string, JevAnswer>;
    usage: { input_tokens: number; output_tokens: number };
  };
  const jev = replayGateway(replay.answers, replay.usage);
  const report = await evaluate(definition, replay.state, jev);
  assert.equal(jev.calls, 1);
  assert.deepEqual(
    verdicts(report),
    [
      ["identifiable_publisher", "pass"],
      ["site_purpose", "pass"],
      ["disclosed_incentives", "pass"],
      ["evidence_for_claims", "pass"],
      ["separates_fact_and_opinion", "pass"],
      ["unsourced_specifics", "pass"],
      ["self_consistent", "pass"],
      ["certainty_matches_evidence", "pass"],
    ],
  );
  assert.equal(exitCodeFor(report.items), 0);
});

test("a sales page with invented figures replays with fail on site and body questions", async () => {
  const replay = load("replay/page-credibility-fail.json") as {
    state: Record<string, unknown>;
    answers: Record<string, JevAnswer>;
    usage: { input_tokens: number; output_tokens: number };
  };
  const report = await evaluate(definition, replay.state, replayGateway(replay.answers, replay.usage));
  assert.deepEqual(
    verdicts(report),
    [
      ["identifiable_publisher", "fail"],
      ["site_purpose", "review"],
      ["disclosed_incentives", "fail"],
      ["evidence_for_claims", "fail"],
      ["separates_fact_and_opinion", "fail"],
      ["unsourced_specifics", "fail"],
      ["self_consistent", "fail"],
      ["certainty_matches_evidence", "fail"],
    ],
  );
  assert.equal(exitCodeFor(report.items), 1);
});

test("a page without a body skips the five content questions and leaves them out of the request", async () => {
  const replay = load("replay/page-credibility-empty.json") as {
    state: Record<string, unknown>;
    answers: Record<string, JevAnswer>;
    usage: { input_tokens: number; output_tokens: number };
  };
  const sent: SystemOneRequest[] = [];
  const jev: JevGateway = {
    async ask(request) {
      sent.push(request);
      return { answers: replay.answers, usage: replay.usage };
    },
  };
  const report = await evaluate(definition, replay.state, jev);
  assert.deepEqual(
    verdicts(report),
    [
      ["identifiable_publisher", "review"],
      ["site_purpose", "fail"],
      ["disclosed_incentives", "pass"],
      ["evidence_for_claims", "not_applicable"],
      ["separates_fact_and_opinion", "not_applicable"],
      ["unsourced_specifics", "not_applicable"],
      ["self_consistent", "not_applicable"],
      ["certainty_matches_evidence", "not_applicable"],
    ],
  );
  assert.deepEqual(Object.keys(sent[0]!.questions), [
    "identifiable_publisher",
    "site_purpose",
    "disclosed_incentives",
  ]);
  assert.equal(skipReason(definition.questions[3]!, replay.state), "applyWhen: hasBody is false, not true");
  assert.equal(exitCodeFor(report.items), 1);
});
