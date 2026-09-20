// Walks the create-jev-cheker-skill procedure once with the sample fixture as the subject: pre-checks on the draft,
// the draft refused by jev-check, the approved file dry-run, then a live Jev run that exists only when TYPESAFE_API_KEY is set.
// The definition under test is the fixture about a short English paragraph, not a product checklist.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { items, jevCheck, json, loadJson, tempDir, typesafeEnv, verdicts } from "./helpers.js";

interface Question {
  id: string;
  type: "noul" | "choice" | "score";
  criteria?: Record<string, unknown> | unknown[];
  options?: Record<string, string>;
  passAt?: number;
  failAt?: number;
  applyWhen?: unknown;
}

const DRAFT_FILE = "fixtures/sample-draft.checker.json";
const PASS_INPUT = "fixtures/replay/pass.json";
const NA_INPUT = "fixtures/replay/not-applicable.json";

const draft = loadJson(DRAFT_FILE);
const questions = draft.questions as Question[];
const questionIds = questions.map((question) => question.id);

const approved = { ...draft, approval: { status: "approved", at: "2026-09-20T00:00:00Z", by: "e2e-test" } };
const approvedFile = join(tempDir("skill-path"), "sample.checker.json");
writeFileSync(approvedFile, JSON.stringify(approved, null, 2));

const withoutApproval = ({ approval: _approval, ...rest }: Record<string, unknown>): Record<string, unknown> => rest;

const liveSkip = process.env.TYPESAFE_API_KEY === undefined ? "TYPESAFE_API_KEY is not set" : false;

/** Asserts on secret hygiene first, so no later failure message can carry the key into the log. */
function assertNoKeyInOutput(run: { stdout: string; stderr: string }): void {
  const key = process.env.TYPESAFE_API_KEY;
  assert.ok(key !== undefined && key.length > 0);
  assert.equal(run.stdout.includes(key), false, "stdout contains the API key");
  assert.equal(run.stderr.includes(key), false, "stderr contains the API key");
}

const exitCodeFor = (verdictList: string[]): number =>
  verdictList.includes("fail") ? 1 : verdictList.some((v) => v === "review" || v === "error") ? 2 : 0;

test("the draft passes the three checks the parser does not do", () => {
  assert.equal((draft.approval as { status: string }).status, "draft");
  for (const question of questions) {
    if (question.type === "choice") {
      assert.deepEqual(Object.keys(question.criteria ?? {}).sort(), Object.keys(question.options ?? {}).sort(), question.id);
    }
    if (question.type === "noul") {
      assert.equal(question.passAt === undefined, question.failAt === undefined, `${question.id}: write passAt and failAt together`);
      for (const value of [question.passAt, question.failAt]) if (value !== undefined) assert.ok(value >= 0 && value <= 1, question.id);
    }
    if (question.type === "score") {
      const top = (question.criteria as unknown[]).length - 1;
      for (const value of [question.passAt, question.failAt]) assert.ok(value !== undefined && value >= 0 && value <= top, question.id);
    }
  }
});

test("jev-check refuses the draft with exit 2 and names approval.status, which confirms the question structure", () => {
  const result = jevCheck(["--dry-run", "--definition", DRAFT_FILE, "--input", PASS_INPUT]);
  assert.equal(result.code, 2, result.stdout);
  assert.equal(json(result).error, 'approval.status is "draft"; approve every question before running this definition');
});

test("the approved file changes only the approval record and dry-runs with exit 0", () => {
  assert.deepEqual(withoutApproval(approved), withoutApproval(draft));

  const result = jevCheck(["--dry-run", "--definition", approvedFile, "--input", PASS_INPUT]);
  assert.equal(result.code, 0, result.stdout);
  const output = json(result);
  assert.equal(output.mode, "dry-run");
  assert.doesNotMatch(result.stdout, /"answers"/);
  const request = output.request as { questions: Record<string, Record<string, unknown>> };
  assert.deepEqual(Object.keys(request.questions), questionIds);
  for (const [id, sent] of Object.entries(request.questions)) {
    assert.deepEqual(
      Object.keys(sent).filter((key) => !["type", "instructions", "criteria"].includes(key)),
      [],
      `${id} sends a runner-side field to Jev`,
    );
  }
});

test("the approved file dry-runs without the not-applicable question when its applyWhen fails", () => {
  const result = jevCheck(["--dry-run", "--definition", approvedFile, "--input", NA_INPUT]);
  assert.equal(result.code, 0, result.stdout);
  const request = json(result).request as { questions: Record<string, unknown> };
  assert.deepEqual(Object.keys(request.questions), ["one_claim", "tone", "clarity"]);
});

test("live: Jev answers every question of the approved file and the key never reaches the output", { skip: liveSkip }, () => {
  const result = jevCheck(["--definition", approvedFile, "--input", PASS_INPUT], typesafeEnv());
  assertNoKeyInOutput(result);
  assert.ok(result.code !== null && result.code >= 0 && result.code <= 2, `exit ${result.code}: ${result.stdout}${result.stderr}`);

  const report = json(result);
  assert.deepEqual(report.definition, { id: draft.id, version: draft.version });
  const answered = items(result);
  assert.deepEqual(
    answered.map((item) => item.id),
    questionIds,
  );
  for (const [index, item] of answered.entries()) {
    assert.ok(["pass", "fail", "review"].includes(item.verdict), `${item.id} is ${item.verdict}`);
    assert.equal(item.answer?.type, questions[index]!.type, item.id);
  }
  assert.equal(result.code, exitCodeFor(verdicts(result).map(([, verdict]) => verdict)));

  const usage = report.usage as { input_tokens: number; output_tokens: number };
  assert.ok(usage.input_tokens > 0 && usage.output_tokens > 0, result.stdout);
  const timing = report.timing as { wallMs: number; jevMs: number };
  assert.ok(timing.jevMs > 0 && timing.wallMs >= timing.jevMs, result.stdout);
});

test("live: a question whose applyWhen fails is not_applicable and carries no Jev answer", { skip: liveSkip }, () => {
  const result = jevCheck(["--definition", approvedFile, "--input", NA_INPUT], typesafeEnv());
  assertNoKeyInOutput(result);
  assert.ok(result.code !== null && result.code >= 0 && result.code <= 2, `exit ${result.code}: ${result.stdout}${result.stderr}`);

  const answered = items(result);
  const skipped = answered.find((item) => item.id === "cites_source");
  assert.equal(skipped?.verdict, "not_applicable");
  assert.equal(skipped?.answer, undefined);
  for (const item of answered.filter((item) => item.id !== "cites_source")) {
    assert.ok(["pass", "fail", "review"].includes(item.verdict), `${item.id} is ${item.verdict}`);
    assert.notEqual(item.answer, undefined, item.id);
  }
});

test("live mode without the key stops with exit 3 before any request", () => {
  const result = jevCheck(["--definition", approvedFile, "--input", PASS_INPUT]);
  assert.equal(result.code, 3, result.stdout);
  assert.match(String(json(result).error), /TYPESAFE_API_KEY/);
  assert.doesNotMatch(result.stdout + result.stderr, /TYPESAFE_API_KEY=/);
});
