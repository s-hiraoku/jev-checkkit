import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(args: string[], extraEnv: Record<string, string> = {}): Run {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("TYPESAFE_")) delete env[key];
  const result = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: root,
    env: { ...env, ...extraEnv },
    encoding: "utf8",
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const json = (run: Run): Record<string, unknown> => JSON.parse(run.stdout) as Record<string, unknown>;
const verdicts = (run: Run): [string, string][] =>
  (json(run).items as { id: string; verdict: string }[]).map((item) => [item.id, item.verdict]);

test("replay pass exits 0 with every item pass", () => {
  const result = run(["--replay", "fixtures/replay/pass.json"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(verdicts(result), [
    ["one_claim", "pass"],
    ["tone", "pass"],
    ["clarity", "pass"],
    ["cites_source", "pass"],
  ]);
  assert.deepEqual(json(result).usage, { input_tokens: 120, output_tokens: 8 });
});

test("replay fail exits 1", () => {
  const result = run(["--replay", "fixtures/replay/fail.json"]);
  assert.equal(result.code, 1, result.stdout);
  assert.deepEqual(verdicts(result)[1], ["tone", "fail"]);
});

test("replay review exits 2", () => {
  const result = run(["--replay", "fixtures/replay/review.json"]);
  assert.equal(result.code, 2, result.stdout);
  assert.deepEqual(verdicts(result)[0], ["one_claim", "review"]);
});

test("replay not-applicable exits 0 with cites_source not_applicable", () => {
  const result = run(["--replay", "fixtures/replay/not-applicable.json"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(verdicts(result)[3], ["cites_source", "not_applicable"]);
});

test("replay missing-answer exits 2 with cites_source error", () => {
  const result = run(["--replay", "fixtures/replay/missing-answer.json"]);
  assert.equal(result.code, 2, result.stdout);
  assert.deepEqual(verdicts(result)[3], ["cites_source", "error"]);
});

test("hallucination replay pass exits 0 with every item pass", () => {
  const result = run(["--replay", "fixtures/replay/hallucination-pass.json"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(verdicts(result), [
    ["consistent_with_source", "pass"],
    ["added_details", "pass"],
    ["admits_uncertainty", "pass"],
    ["self_consistent", "pass"],
  ]);
});

test("hallucination replay fail exits 1 and names the fabricated details", () => {
  const result = run(["--replay", "fixtures/replay/hallucination-fail.json"]);
  assert.equal(result.code, 1, result.stdout);
  assert.deepEqual(verdicts(result), [
    ["consistent_with_source", "fail"],
    ["added_details", "fail"],
    ["admits_uncertainty", "fail"],
    ["self_consistent", "pass"],
  ]);
});

test("hallucination dry-run without a source keeps only the source-free questions", () => {
  const replay = JSON.parse(readFileSync(`${root}fixtures/replay/hallucination-pass.json`, "utf8")) as {
    state: Record<string, unknown>;
  };
  delete replay.state.source;
  const file = join(tmpdir(), `jev-check-no-source-${process.pid}.json`);
  writeFileSync(file, JSON.stringify({ state: replay.state }));
  const result = run(["--dry-run", "--definition", "fixtures/hallucination.checker.json", "--input", file]);
  assert.equal(result.code, 0, result.stdout);
  const request = json(result).request as { questions: Record<string, unknown> };
  assert.deepEqual(Object.keys(request.questions), ["admits_uncertainty", "self_consistent"]);
});

test("a draft definition is refused with exit 2 before any key is needed", () => {
  const result = run(["--definition", "fixtures/sample-draft.checker.json", "--input", "fixtures/replay/pass.json"]);
  assert.equal(result.code, 2, result.stdout);
  assert.match(String(json(result).error), /approval/);
});

test("dry-run prints the planned request and no answers", () => {
  const result = run([
    "--dry-run",
    "--definition",
    "fixtures/sample-approved.checker.json",
    "--input",
    "fixtures/replay/pass.json",
  ]);
  assert.equal(result.code, 0, result.stdout);
  assert.match(result.stdout, /"questions"/);
  assert.doesNotMatch(result.stdout, /"answers"/);
  const output = json(result);
  assert.equal(output.mode, "dry-run");
  const request = output.request as { state: { claimsSource: boolean }; questions: Record<string, unknown> };
  assert.equal(request.state.claimsSource, true);
  assert.deepEqual(Object.keys(request.questions), ["one_claim", "tone", "clarity", "cites_source"]);
});

test("dry-run leaves a not-applicable question out of the request", () => {
  const result = run([
    "--dry-run",
    "--definition",
    "fixtures/sample-approved.checker.json",
    "--input",
    "fixtures/replay/not-applicable.json",
  ]);
  assert.equal(result.code, 0, result.stdout);
  const request = json(result).request as { questions: Record<string, unknown> };
  assert.deepEqual(Object.keys(request.questions), ["one_claim", "tone", "clarity"]);
});

test("live mode without a key exits 3 and prints an error object", () => {
  const result = run(["--definition", "fixtures/sample-approved.checker.json", "--input", "fixtures/replay/pass.json"]);
  assert.equal(result.code, 3, result.stdout);
  assert.match(String(json(result).error), /TYPESAFE_API_KEY/);
  assert.doesNotMatch(result.stdout + result.stderr, /TYPESAFE_API_KEY=/);
});

test("live mode needs no key when every question is not_applicable", () => {
  const raw = JSON.parse(readFileSync(`${root}fixtures/sample-approved.checker.json`, "utf8")) as {
    questions: Record<string, unknown>[];
  };
  for (const question of raw.questions) question.applyWhen = { path: "audience", op: "exists" };
  const file = join(tmpdir(), `jev-check-gated-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(raw));
  const result = run(["--definition", file, "--input", "fixtures/replay/pass.json"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(
    verdicts(result).map(([, verdict]) => verdict),
    ["not_applicable", "not_applicable", "not_applicable", "not_applicable"],
  );
});

test("live mode with an unreachable endpoint exits 3 and never prints the key", () => {
  const secret = "dummy-secret-value-123";
  const result = run(["--definition", "fixtures/sample-approved.checker.json", "--input", "fixtures/replay/pass.json"], {
    TYPESAFE_API_KEY: secret,
    TYPESAFE_BASE_URL: "http://127.0.0.1:9",
  });
  assert.equal(result.code, 3, result.stdout + result.stderr);
  assert.equal(typeof json(result).error, "string");
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
  assert.doesNotMatch(result.stdout + result.stderr, /TYPESAFE_API_KEY=/);
});

test("--help lists the four flags and exits 0", () => {
  const result = run(["--help"]);
  assert.equal(result.code, 0);
  for (const flag of ["--definition", "--input", "--dry-run", "--replay"]) assert.match(result.stdout, new RegExp(flag));
});

test("a missing input file is refused with exit 2 and the path in the message", () => {
  const result = run(["--definition", "fixtures/sample-approved.checker.json", "--input", "fixtures/replay/nope.json"]);
  assert.equal(result.code, 2, result.stdout);
  assert.match(String(json(result).error), /fixtures\/replay\/nope\.json/);
});
