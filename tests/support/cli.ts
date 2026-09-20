import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../..", import.meta.url));
export const cli = join(root, "dist/cli.js");
export const skillDir = join(root, "skills/create-jev-cheker-skill");
export const validator = join(skillDir, "scripts/validate-skill.mjs");

export interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

export type Env = Record<string, string>;

function envWithoutTypesafe(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("TYPESAFE_")) delete env[key];
  return env;
}

/** Every TYPESAFE_* variable of the test process, so a live run inherits the key without the test reading its value. */
export function typesafeEnv(): Env {
  const env: Env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("TYPESAFE_") && value !== undefined) env[key] = value;
  }
  return env;
}

export function runNode(args: string[], extraEnv: Env = {}): Run {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...envWithoutTypesafe(), ...extraEnv },
    encoding: "utf8",
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Runs the built binary that `npx jev-check` resolves to. `npm run test:e2e` builds it first. */
export function jevCheck(args: string[], extraEnv: Env = {}): Run {
  if (!existsSync(cli)) throw new Error(`${cli} is missing; run "npm run build" first`);
  return runNode([cli, ...args], extraEnv);
}

export const json = (run: Run): Record<string, unknown> => JSON.parse(run.stdout) as Record<string, unknown>;

export const items = (run: Run): { id: string; verdict: string; answer?: { type: string } }[] =>
  json(run).items as { id: string; verdict: string; answer?: { type: string } }[];

export const verdicts = (run: Run): [string, string][] => items(run).map((item) => [item.id, item.verdict]);

export const readText = (file: string): string => readFileSync(resolve(root, file), "utf8");

export const loadJson = (file: string): Record<string, unknown> => JSON.parse(readText(file)) as Record<string, unknown>;

export const tempDir = (label: string): string => mkdtempSync(join(tmpdir(), `jev-checkkit-e2e-${label}-`));
