// End to end: hallucination checking of an AI answer against the source it was given.
//   1. prepare the question and the source handed to a model
//   2. create-jev-cheker-skill drafts the lie-detector checklist, the operator adjusts it, then approves the whole list
//   3. write the approved definition (a test file; fixtures/hallucination.checker.json stays the only committed copy, a sample)
//   4. produce two answers, one faithful to the source and one that fabricates facts
//   5. run jev-check live with state { question, source, answer }
//   6. the faithful answer is not failed for fabrication, the fabricated one is fail or review, and a person can read the report
// The skill is an agent procedure, so the test stands in for the agent (the draft is a fixture) and for the operator
// (the adjustment and the approval are made by the test, approval.by "e2e-test"). Steps 5 and 6 skip when
// TYPESAFE_API_KEY is missing. The key is never printed.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { items, jevCheck, json, loadJson, tempDir, typesafeEnv, type Run } from "../support/cli.js";

interface Question {
  id: string;
  type: "noul" | "choice" | "score";
  instructions: string;
  criteria?: Record<string, unknown> | unknown[];
  options?: Record<string, string>;
  passAt?: number;
  failAt?: number;
  confidenceFloor?: number;
  applyWhen?: { path: string; op: string; value?: unknown };
}

interface Item {
  id: string;
  verdict: string;
  reason: string;
  answer?: { type: string };
}

interface State {
  question: string;
  source: string;
  answer: string;
}

const DRAFT_FIXTURE = "fixtures/hallucination-draft.checker.json";
const APPROVED_FIXTURE = "fixtures/hallucination.checker.json";
const FAITHFUL_REPLAY = "fixtures/replay/hallucination-pass.json";
const FABRICATED_REPLAY = "fixtures/replay/hallucination-fail.json";
const FABRICATION_QUESTIONS = ["consistent_with_source", "added_details"];

const liveSkip = process.env.TYPESAFE_API_KEY === undefined ? "TYPESAFE_API_KEY is not set" : false;

const stateOf = (replayFile: string): State => loadJson(replayFile).state as State;

const withoutApproval = ({ approval: _approval, ...body }: Record<string, unknown>): Record<string, unknown> => body;

/** Runs before any other assertion on a live result, so no failure message can carry the key into the log. */
function assertNoKeyInOutput(run: Run): void {
  const key = process.env.TYPESAFE_API_KEY;
  assert.ok(key !== undefined && key.length > 0);
  assert.equal(run.stdout.includes(key), false, "stdout contains the API key");
  assert.equal(run.stderr.includes(key), false, "stderr contains the API key");
}

function runLive(definitionFile: string, inputFile: string, t: TestContext): { code: number; items: Item[]; report: Record<string, unknown> } {
  const live = jevCheck(["--definition", definitionFile, "--input", inputFile], typesafeEnv());
  assertNoKeyInOutput(live);
  assert.ok(live.code !== null && live.code >= 0 && live.code <= 2, `exit ${live.code}: ${live.stdout}${live.stderr}`);
  const report = json(live);
  const results = items(live) as Item[];
  for (const item of results) {
    assert.ok(["pass", "fail", "review"].includes(item.verdict), `${item.id} is ${item.verdict}`);
    assert.notEqual(item.answer, undefined, `${item.id} has no Jev answer`);
    assert.ok(typeof item.reason === "string" && item.reason.length > 0, `${item.id} has no reason`);
  }
  const usage = report.usage as { input_tokens: number; output_tokens: number };
  assert.ok(usage.input_tokens > 0 && usage.output_tokens > 0, live.stdout);
  const timing = report.timing as { wallMs: number; jevMs: number };
  assert.ok(timing.jevMs > 0 && timing.wallMs >= timing.jevMs, live.stdout);
  for (const line of renderReport(report).split("\n")) t.diagnostic(line);
  return { code: live.code, items: results, report };
}

function renderReport(report: Record<string, unknown>): string {
  const { id, version } = report.definition as { id: string; version: number };
  const usage = report.usage as { input_tokens: number; output_tokens: number };
  const timing = report.timing as { wallMs: number; jevMs: number };
  return [
    `${id} v${version}`,
    ...(report.items as Item[]).map((item) => `  ${item.id.padEnd(23)} ${item.verdict.padEnd(7)} ${item.reason}`),
    `  tokens in/out ${usage.input_tokens}/${usage.output_tokens}, jev ${timing.jevMs} ms, wall ${timing.wallMs} ms`,
  ].join("\n");
}

test("hallucination check: an AI answer goes from a drafted lie detector to a Jev-backed verdict", async (t: TestContext) => {
  const dir = tempDir("hallucination-check");
  const definitionFile = join(dir, "ai-answer-hallucination.checker.json");
  const faithfulInput = join(dir, "faithful.json");
  const fabricatedInput = join(dir, "fabricated.json");

  const faithful = stateOf(FAITHFUL_REPLAY);
  const fabricated = stateOf(FABRICATED_REPLAY);
  const draft = loadJson(DRAFT_FIXTURE);
  const questions = draft.questions as Question[];
  const questionIds = questions.map((question) => question.id);

  await t.test("1. the question and the source handed to the model are prepared once", () => {
    assert.equal(faithful.question, fabricated.question, "both answers must respond to the same question");
    assert.equal(faithful.source, fabricated.source, "both answers must be checked against the same source");
    assert.ok(faithful.question.length > 0 && faithful.source.length > 0);
    t.diagnostic(`question: ${faithful.question}`);
    t.diagnostic(`source: ${faithful.source}`);
  });

  await t.test("2. the skill drafts the lie detector, the operator adjusts it, and approves the whole list", () => {
    assert.deepEqual(draft.approval, { status: "draft" });
    assert.match(String(draft.subject), /AI assistant's answer/);
    for (const id of FABRICATION_QUESTIONS) assert.ok(questionIds.includes(id), `${id} missing from the draft`);
    for (const question of questions) {
      if (question.type === "choice") {
        assert.deepEqual(Object.keys(question.criteria ?? {}).sort(), Object.keys(question.options ?? {}).sort(), question.id);
      }
      if (question.type === "noul") {
        assert.equal(question.passAt === undefined, question.failAt === undefined, `${question.id}: write passAt and failAt together`);
      }
    }
    const refused = jevCheck(["--dry-run", "--definition", DRAFT_FIXTURE, "--input", FAITHFUL_REPLAY]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.equal(json(refused).error, 'approval.status is "draft"; approve every question before running this definition');

    // The operator's adjustment: a fabrication verdict that Jev is unsure about goes to a person instead of passing.
    const addedDetails = questions.find((question) => question.id === "added_details");
    assert.ok(addedDetails && addedDetails.type === "choice" && addedDetails.confidenceFloor === undefined);
    addedDetails.confidenceFloor = 0.6;
    assert.deepEqual(draft.approval, { status: "draft" }, "an edit keeps the list a draft until the whole list is approved again");

    for (const question of questions) t.diagnostic(`${question.id} (${question.type}): ${question.instructions}`);
    draft.approval = { status: "approved", at: new Date().toISOString(), by: "e2e-test" };
  });

  await t.test("3. the approved definition is written, matches the committed sample, and parses", () => {
    writeFileSync(definitionFile, `${JSON.stringify(draft, null, 2)}\n`);
    assert.deepEqual(withoutApproval(loadJson(definitionFile)), withoutApproval(loadJson(APPROVED_FIXTURE)));

    writeFileSync(faithfulInput, JSON.stringify({ state: faithful }));
    const dryRun = jevCheck(["--dry-run", "--definition", definitionFile, "--input", faithfulInput]);
    assert.equal(dryRun.code, 0, dryRun.stdout);
    assert.doesNotMatch(dryRun.stdout, /"answers"/);
    const request = json(dryRun).request as { questions: Record<string, unknown> };
    assert.deepEqual(Object.keys(request.questions), questionIds, "a state with a source triggers every question");
  });

  await t.test("4. two answers are produced: one faithful to the source, one that fabricates facts", () => {
    assert.notEqual(faithful.answer, fabricated.answer);
    assert.match(faithful.answer, /nine/);
    assert.match(fabricated.answer, /eight/);
    assert.doesNotMatch(faithful.source, /2023|million|tripled/);
    assert.match(fabricated.answer, /2023|million|tripled/);
    writeFileSync(fabricatedInput, JSON.stringify({ state: fabricated }));
    t.diagnostic(`faithful answer: ${faithful.answer}`);
    t.diagnostic(`fabricated answer: ${fabricated.answer}`);
  });

  await t.test("5. live: the faithful answer is not failed for fabrication", { skip: liveSkip }, () => {
    const { items: results } = runLive(definitionFile, faithfulInput, t);
    assert.deepEqual(
      results.map((item) => item.id),
      questionIds,
    );
    for (const item of results.filter((item) => FABRICATION_QUESTIONS.includes(item.id))) {
      assert.notEqual(item.verdict, "fail", `${item.id}: ${item.reason}`);
    }
  });

  await t.test("6. live: the fabricated answer is fail or review", { skip: liveSkip }, () => {
    const { code, items: results } = runLive(definitionFile, fabricatedInput, t);
    assert.ok(code === 1 || code === 2, `exit ${code}`);
    const addedDetails = results.find((item) => item.id === "added_details");
    assert.ok(addedDetails, "added_details missing from the report");
    assert.ok(["fail", "review"].includes(addedDetails.verdict), `added_details: ${addedDetails.reason}`);
  });
});
