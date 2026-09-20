// The ten PR1 lanes from docs/jev-checker-plan.md, "Verify, live", as functional checks against the built dist/cli.js.
// They use --dry-run and --replay only, so they never talk to Jev; the skill-to-live path is tests/e2e.
// Lane 1 compares trunk with head in the plan; trunk is this repository now, so only the head half is encoded.
import assert from "node:assert/strict";
import { test } from "node:test";
import { jevCheck, json, verdicts } from "../support/cli.js";

const APPROVED = "fixtures/sample-approved.checker.json";
const DRAFT = "fixtures/sample-draft.checker.json";
const PASS_INPUT = "fixtures/replay/pass.json";

test("Lane 1. head --help prints the --definition, --dry-run, and --replay flags and exits 0", () => {
  const result = jevCheck(["--help"]);
  assert.equal(result.code, 0, result.stderr);
  for (const flag of ["--definition", "--dry-run", "--replay"]) assert.match(result.stdout, new RegExp(flag));
});

test("Lane 2. dry-run of the approved fixture prints questions, no answers, and exits 0", () => {
  const result = jevCheck(["--dry-run", "--definition", APPROVED, "--input", PASS_INPUT]);
  assert.equal(result.code, 0, result.stdout);
  assert.match(result.stdout, /"questions"/);
  assert.doesNotMatch(result.stdout, /"answers"/);
});

test("Lane 3. the draft definition is refused with exit 2 and stdout names approval", () => {
  const result = jevCheck(["--definition", DRAFT, "--input", PASS_INPUT]);
  assert.equal(result.code, 2, result.stdout);
  assert.match(String(json(result).error), /approval/);
});

test("Lane 4. replay pass exits 0 with every item pass or not_applicable", () => {
  const result = jevCheck(["--replay", "fixtures/replay/pass.json"]);
  assert.equal(result.code, 0, result.stdout);
  for (const [id, verdict] of verdicts(result)) assert.ok(verdict === "pass" || verdict === "not_applicable", `${id} is ${verdict}`);
});

test("Lane 5. replay fail exits 1 with at least one fail", () => {
  const result = jevCheck(["--replay", "fixtures/replay/fail.json"]);
  assert.equal(result.code, 1, result.stdout);
  assert.ok(verdicts(result).some(([, verdict]) => verdict === "fail"), result.stdout);
});

test("Lane 6. replay review exits 2 with at least one review", () => {
  const result = jevCheck(["--replay", "fixtures/replay/review.json"]);
  assert.equal(result.code, 2, result.stdout);
  assert.ok(verdicts(result).some(([, verdict]) => verdict === "review"), result.stdout);
});

test("Lane 7. replay not-applicable marks cites_source not_applicable and dry-run leaves it out of the request", () => {
  const replay = jevCheck(["--replay", "fixtures/replay/not-applicable.json"]);
  assert.equal(replay.code, 0, replay.stdout);
  assert.deepEqual(verdicts(replay)[3], ["cites_source", "not_applicable"]);

  const dryRun = jevCheck(["--dry-run", "--definition", APPROVED, "--input", "fixtures/replay/not-applicable.json"]);
  assert.equal(dryRun.code, 0, dryRun.stdout);
  const request = json(dryRun).request as { questions: Record<string, unknown> };
  assert.deepEqual(Object.keys(request.questions), ["one_claim", "tone", "clarity"]);
});

test("Lane 8. replay missing-answer marks the missing id error and exits 2", () => {
  const result = jevCheck(["--replay", "fixtures/replay/missing-answer.json"]);
  assert.equal(result.code, 2, result.stdout);
  assert.deepEqual(verdicts(result)[3], ["cites_source", "error"]);
});

test("Lane 9. dry-run batches two or more question ids in one request and replay prints one report", () => {
  const dryRun = jevCheck(["--dry-run", "--definition", APPROVED, "--input", PASS_INPUT]);
  assert.equal(dryRun.code, 0, dryRun.stdout);
  const request = json(dryRun).request as { questions: Record<string, unknown> };
  assert.ok(Object.keys(request.questions).length >= 2, dryRun.stdout);

  const replay = jevCheck(["--replay", "fixtures/replay/pass.json"]);
  assert.equal(replay.code, 0, replay.stdout);
  // stdout parses as a single JSON object, so one report was printed; usage and timing appear once each.
  assert.deepEqual(json(replay).usage, { input_tokens: 120, output_tokens: 8 });
  assert.equal(replay.stdout.match(/"usage"/g)?.length, 1);
  assert.equal(replay.stdout.match(/"timing"/g)?.length, 1);
});

test("Lane 10. a dummy TYPESAFE_API_KEY in the lane environment never reaches stdout or stderr", () => {
  const dummy = "dummy-lane-10-key-value";
  const result = jevCheck(["--replay", "fixtures/replay/pass.json"], { TYPESAFE_API_KEY: dummy });
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.stdout.includes(dummy), false);
  assert.equal(result.stderr.includes(dummy), false);
  for (const [, verdict] of verdicts(result)) assert.equal(verdict, "pass");
});
