// The ten PR2 live lanes from docs/jev-checker-plan.md, "Verify, live", run against skills/create-jev-cheker-skill.
// Lane 1 compares trunk with head in the plan; trunk is this repository now, so only the head half is encoded.
import assert from "node:assert/strict";
import { cpSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { test } from "node:test";
import { jevCheck, json, readText, root, runNode, skillDir, tempDir, validator } from "./helpers.js";

const GATE_HEADING = "## Whole-list approval stop";
const SKILL_NAME = "create-jev-cheker-skill";

const skillText = readText(`skills/${SKILL_NAME}/SKILL.md`);
const schemaText = readText(`skills/${SKILL_NAME}/references/definition-schema.md`);
const skillTree = walk(skillDir);

function walk(dir: string, top = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full, top) : [relative(top, full).split("\\").join("/")];
  });
}

function section(text: string, heading: string): { start: number; end: number; body: string } | undefined {
  const start = text.indexOf(heading);
  if (start < 0) return undefined;
  const bodyStart = start + heading.length;
  const next = text.indexOf("\n## ", bodyStart);
  const end = next < 0 ? text.length : next;
  return { start, end, body: text.slice(bodyStart, end) };
}

const sentences = (text: string): string[] => text.split(/(?<=[.!?])\s+|\n+/);

test("Lane 1. validate-skill.mjs exits 0 on head and prints ok approval-gate", () => {
  const result = runNode([validator]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^ok approval-gate$/m);
  assert.doesNotMatch(result.stderr, /^fail /m);
});

test("Lane 2. SKILL.md forbids inspection and jev-check before the operator approves the whole list", () => {
  const gate = section(skillText, GATE_HEADING);
  assert.ok(gate, `SKILL.md lacks "${GATE_HEADING}"`);
  assert.match(gate.body, /\b(do not|never)\b/i);
  assert.match(gate.body, /approv/i);
  assert.match(gate.body, /jev-check|inspect/i);
  assert.ok(gate.start < skillText.indexOf("jev-check"), "the approval stop must come before the first jev-check mention");
});

test("Lane 3. the definition file is the default output and an execution skill is conditional", () => {
  assert.match(skillText, /definition file is the default output/i);
  const executionSkillLines = skillText.split("\n").filter((line) => /\b(execution|target) skill\b/i.test(line));
  assert.ok(executionSkillLines.length > 0, "SKILL.md never mentions an execution skill");
  for (const line of executionSkillLines) {
    if (/\b(write|generate|create|emit)\b/i.test(line)) assert.match(line, /\b(only when|only if)\b/i, line);
  }
});

test("Lane 4. the skill tree has no jev_check.py and SKILL.md does not tell the agent to copy one", () => {
  assert.deepEqual(
    skillTree.filter((file) => basename(file) === "jev_check.py"),
    [],
  );
  const runnerLines = skillText.split("\n").filter((line) => /jev_check\.py|python runner/i.test(line));
  for (const line of runnerLines) assert.match(line, /\b(do not|never|must not)\b/i, line);
});

test("Lane 5. generated-skill-template.md is absent", () => {
  assert.equal(existsSync(join(skillDir, "references/generated-skill-template.md")), false);
  assert.deepEqual(
    walk(join(root, "skills")).filter((file) => basename(file) === "generated-skill-template.md"),
    [],
  );
});

test("Lane 6. definition-schema.md names approval, Verdict, the three question types, and every type src/types.ts exports", () => {
  for (const name of ["approval", "Verdict", "noul", "choice", "score"]) assert.ok(schemaText.includes(name), name);
  const exported = [...readText("src/types.ts").matchAll(/^export (?:type|interface) (\w+)/gm)].map((m) => m[1]!);
  assert.ok(exported.includes("Approval") && exported.includes("Verdict"));
  for (const name of ["NoulCheck", "ChoiceCheck", "ScoreCheck"]) assert.ok(exported.includes(name), name);
  assert.deepEqual(
    exported.filter((name) => !schemaText.includes(name)),
    [],
  );
});

test("Lane 7. a copy of the skill with the approval stop removed makes validate-skill.mjs exit 1", () => {
  const copy = join(tempDir("stripped-gate"), SKILL_NAME);
  cpSync(skillDir, copy, { recursive: true });
  const gate = section(skillText, GATE_HEADING);
  assert.ok(gate);
  writeFileSync(join(copy, "SKILL.md"), skillText.slice(0, gate.start) + skillText.slice(gate.end + 1));

  const result = runNode([join(copy, "scripts/validate-skill.mjs"), copy]);
  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /^fail approval-gate/m);
});

test("Lane 8. the skill directory is spelled create-jev-cheker-skill", () => {
  assert.ok(readdirSync(join(root, "skills")).includes(SKILL_NAME));
  assert.equal(basename(skillDir), SKILL_NAME);
  assert.match(skillText, /^name: create-jev-cheker-skill$/m);
});

test("Lane 9. SKILL.md names CheckReport and forbids merge, delete, publish, and send from a report", () => {
  assert.ok(skillText.includes("CheckReport"));
  const ban = sentences(skillText).find(
    (sentence) => ["merge", "delete", "publish", "send"].every((word) => sentence.includes(word)) && /\b(do not|never|not)\b/i.test(sentence),
  );
  assert.ok(ban, "no sentence forbids merge, delete, publish, and send together");
});

test("Lane 10. the schema's draft example is refused until approval.status is approved, then dry-runs", () => {
  const blocks = [...schemaText.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
  const draft = blocks.find((block) => (block.approval as { status?: string } | undefined)?.status === "draft");
  assert.ok(draft, "definition-schema.md has no draft example");

  const dir = tempDir("schema-example");
  const draftFile = join(dir, "schema-draft.json");
  const approvedFile = join(dir, "schema-approved.json");
  writeFileSync(draftFile, JSON.stringify(draft));
  writeFileSync(
    approvedFile,
    JSON.stringify({ ...draft, approval: { status: "approved", at: "2026-09-20T00:00:00Z", by: "e2e-test" } }),
  );

  const refused = jevCheck(["--definition", draftFile, "--input", "fixtures/replay/pass.json"]);
  assert.equal(refused.code, 2, refused.stdout);
  assert.match(String(json(refused).error), /approval\.status is "draft"/);

  const dryRun = jevCheck(["--dry-run", "--definition", approvedFile, "--input", "fixtures/replay/pass.json"]);
  assert.equal(dryRun.code, 0, dryRun.stdout);
  const output = json(dryRun);
  assert.deepEqual(output.definition, { id: "my-subject", version: 0 });
  assert.deepEqual(Object.keys((output.request as { questions: Record<string, unknown> }).questions), ["one_claim"]);
});
