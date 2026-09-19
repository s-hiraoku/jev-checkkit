#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * @typedef {{ skillDir: string, tree: string[], skillText: string, schemaText: string, typesText?: string, parseDefinition?: (raw: unknown) => unknown }} Snapshot
 * @typedef {string | { skip: string } | undefined} Outcome
 * @typedef {{ id: string, check: (s: Snapshot) => Outcome }} Rule
 */

const SKILL_NAME = "create-jev-cheker-skill";
const REQUIRED_FILES = ["SKILL.md", "references/definition-schema.md", "scripts/validate-skill.mjs"];
const FORBIDDEN_BASENAMES = ["jev_check.py", "generated-skill-template.md"];
const GATE_HEADING = "## Whole-list approval stop";
const SCHEMA_NAMES = ["approval", "Verdict", "noul", "choice", "score", "applyWhen", "CheckReport"];

const lines = (text) => text.split("\n");
const sentences = (text) => text.split(/(?<=[.!?])\s+|\n+/);

function section(text, heading) {
  const start = text.indexOf(heading);
  if (start < 0) return undefined;
  const bodyStart = start + heading.length;
  const next = text.indexOf("\n## ", bodyStart);
  return { start, body: text.slice(bodyStart, next < 0 ? text.length : next) };
}

function jsonBlocks(text) {
  return [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
}

/** @type {Rule[]} */
const RULES = [
  {
    id: "name",
    check: (s) => (basename(s.skillDir) === SKILL_NAME ? undefined : `skill directory must be named ${SKILL_NAME}`),
  },
  {
    id: "files",
    check: (s) => {
      const missing = REQUIRED_FILES.filter((f) => !s.tree.includes(f));
      return missing.length ? `missing ${missing.join(", ")}` : undefined;
    },
  },
  {
    id: "forbidden-files",
    check: (s) => {
      const found = s.tree.filter((f) => FORBIDDEN_BASENAMES.includes(basename(f)));
      return found.length ? `remove ${found.join(", ")}` : undefined;
    },
  },
  {
    id: "frontmatter",
    check: (s) =>
      /^---\nname: create-jev-cheker-skill\ndescription: \S.*\n---\n/.test(s.skillText)
        ? undefined
        : "frontmatter must have name create-jev-cheker-skill and a description",
  },
  {
    id: "approval-gate",
    check: (s) => {
      const fail = `SKILL.md needs a "${GATE_HEADING}" section that forbids running jev-check before the operator approves the whole list, placed before the first jev-check mention`;
      const gate = section(s.skillText, GATE_HEADING);
      if (!gate || s.skillText.indexOf(GATE_HEADING, gate.start + 1) >= 0) return fail;
      const firstRunner = s.skillText.indexOf("jev-check");
      const ok =
        /\b(do not|never)\b/i.test(gate.body) &&
        /approv/i.test(gate.body) &&
        /jev-check|inspect/i.test(gate.body) &&
        (firstRunner < 0 || gate.start < firstRunner);
      return ok ? undefined : fail;
    },
  },
  {
    id: "whole-list",
    check: (s) => {
      const gate = section(s.skillText, GATE_HEADING);
      const upToStop = gate ? s.skillText.slice(0, gate.start + GATE_HEADING.length + gate.body.length) : s.skillText;
      const ok =
        /whole (check)?list/i.test(upToStop) &&
        /every item/i.test(upToStop) &&
        sentences(s.skillText).some((t) => /again/.test(t) && /approv/i.test(t));
      return ok ? undefined : "SKILL.md must show every item, wait for approval of the whole list, and repeat after a revision";
    },
  },
  {
    id: "definition-default",
    check: (s) => {
      const isDefault = /definition file[^.\n]*\bdefault\b/i.test(s.skillText) || /\bdefault\b[^.\n]*definition file/i.test(s.skillText);
      const unconditional = /^(?!.*\b(only when|only if|do not|never)\b).*\b(generate|create|write|emit)\b[^\n]*\b(execution|target) skill/i;
      const ok = isDefault && !lines(s.skillText).some((l) => unconditional.test(l));
      return ok ? undefined : "the definition file must be the default output and an execution skill must be conditional";
    },
  },
  {
    id: "no-python-runner",
    check: (s) => {
      const copies = /^(?!.*\b(do not|never|must not)\b).*\b(copy|create|generate|install|write)\b[^\n]*(jev_check\.py|python runner)/i;
      const ok = !s.tree.some((f) => basename(f) === "jev_check.py") && !lines(s.skillText).some((l) => copies.test(l));
      return ok ? undefined : "SKILL.md must not tell the agent to copy or write a Python runner";
    },
  },
  {
    id: "no-auto-action",
    check: (s) => {
      const bans = (t) => ["merge", "delete", "publish", "send"].every((w) => t.includes(w)) && /\b(do not|never|not)\b/i.test(t);
      const ok = s.skillText.includes("CheckReport") && sentences(s.skillText).some(bans);
      return ok ? undefined : "SKILL.md must name CheckReport and forbid merge, delete, publish, and send from a report";
    },
  },
  {
    id: "schema-names",
    check: (s) => {
      const missing = SCHEMA_NAMES.filter((n) => !s.schemaText.includes(n));
      return missing.length ? `definition-schema.md must name ${missing.join(", ")}` : undefined;
    },
  },
  {
    id: "schema-types",
    check: (s) => {
      if (s.typesText === undefined) return { skip: "src/types.ts not found" };
      const names = [...s.typesText.matchAll(/^export (?:type|interface) (\w+)/gm)].map((m) => m[1]);
      const missing = names.filter((n) => !s.schemaText.includes(n));
      return missing.length ? `definition-schema.md does not mention ${missing.join(", ")}` : undefined;
    },
  },
  {
    id: "schema-examples",
    check: (s) => {
      const blocks = jsonBlocks(s.schemaText);
      for (const [i, block] of blocks.entries()) {
        let value;
        try {
          value = JSON.parse(block);
        } catch (e) {
          return `example ${i + 1} in definition-schema.md: ${e.message}`;
        }
        if (!s.parseDefinition || value === null || typeof value !== "object" || !("approval" in value)) continue;
        try {
          s.parseDefinition(value);
        } catch (e) {
          if (e?.kind !== "unapproved") return `example ${i + 1} in definition-schema.md: ${e.message}`;
        }
      }
      return s.parseDefinition ? undefined : { skip: "dist/index.js not built" };
    },
  },
];

function walk(dir, root = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full, root) : [relative(root, full).split("\\").join("/")];
  });
}

const readIf = (file) => (existsSync(file) ? readFileSync(file, "utf8") : undefined);

/** @returns {Promise<Snapshot>} */
async function snapshot(skillDir) {
  const repoRoot = resolve(skillDir, "../..");
  const dist = join(repoRoot, "dist/index.js");
  const parseDefinition = existsSync(dist) ? (await import(pathToFileURL(dist).href)).parseDefinition : undefined;
  return {
    skillDir,
    tree: existsSync(skillDir) ? walk(skillDir) : [],
    skillText: readIf(join(skillDir, "SKILL.md")) ?? "",
    schemaText: readIf(join(skillDir, "references/definition-schema.md")) ?? "",
    typesText: readIf(join(repoRoot, "src/types.ts")),
    parseDefinition,
  };
}

async function main() {
  const skillDir = resolve(process.argv[2] ?? dirname(dirname(fileURLToPath(import.meta.url))));
  const s = await snapshot(skillDir);
  let failed = false;
  for (const rule of RULES) {
    const outcome = rule.check(s);
    if (outcome === undefined) console.log(`ok ${rule.id}`);
    else if (typeof outcome === "string") {
      failed = true;
      console.error(`fail ${rule.id}: ${outcome}`);
    } else console.log(`skip ${rule.id}: ${outcome.skip}`);
  }
  process.exitCode = failed ? 1 : 0;
}

await main();
