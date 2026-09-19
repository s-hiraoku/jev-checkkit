#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { TypeSafeClient, TypeSafeError, type EntryType, type Usage } from "@typesafe-ai/sdk";
import { isEntryType, isRecord, parseDefinition } from "./definition.js";
import { evaluate, skipReason } from "./evaluate.js";
import { buildRequest, liveGateway, parseReplayAnswers, parseUsage, replayGateway } from "./jev.js";
import { exitCodeFor } from "./report.js";
import type { JevAnswer } from "./types.js";

const HELP = `Usage:
  jev-check --definition <file> --input <file> [--dry-run]
  jev-check --replay <file> [--definition <file>] [--input <file>] [--dry-run]

Flags:
  --definition <file>  approved checker definition (JSON)
  --input <file>       JSON object whose "state" is the subject to check
  --dry-run            print the request that would go to Jev, then exit 0
  --replay <file>      JSON with "definition", "state", "answers", and optional "usage";
                       the answers stand in for Jev, so nothing is sent
  --help               show this text

Exit codes:
  0  every item is pass or not_applicable
  1  at least one item is fail
  2  at least one item is review or error, or a file was refused
  3  TYPESAFE_API_KEY is missing or the Jev request failed
`;

const OPTIONS = {
  definition: { type: "string" },
  input: { type: "string" },
  "dry-run": { type: "boolean" },
  replay: { type: "string" },
  help: { type: "boolean" },
} as const;

interface ReplayFile {
  definition: string;
  state: EntryType;
  answers: Record<string, JevAnswer>;
  usage: Usage | undefined;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readInput(file: string): EntryType {
  const raw = readJson(file);
  if (!isRecord(raw) || !isEntryType(raw.state)) {
    throw new Error(`${file}: "state" must be text, a JSON object, an array, or null`);
  }
  return raw.state;
}

function readReplay(file: string): ReplayFile {
  const raw = readJson(file);
  if (!isRecord(raw)) throw new Error(`${file}: must be a JSON object`);
  if (typeof raw.definition !== "string") throw new Error(`${file}: "definition" must be a path relative to the replay file`);
  if (!isEntryType(raw.state)) throw new Error(`${file}: "state" must be text, a JSON object, an array, or null`);
  return {
    definition: resolve(dirname(file), raw.definition),
    state: raw.state,
    answers: parseReplayAnswers(raw.answers, `${file}: answers`),
    usage: raw.usage === undefined ? undefined : parseUsage(raw.usage, `${file}: usage`),
  };
}

async function main(argv: readonly string[]): Promise<number> {
  const { values } = parseArgs({ args: [...argv], options: OPTIONS });
  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const replay = values.replay === undefined ? undefined : readReplay(values.replay);
  const definitionFile = values.definition ?? replay?.definition;
  if (definitionFile === undefined) throw new Error("--definition <file> is required unless --replay names one");
  const state = values.input === undefined ? replay?.state : readInput(values.input);
  if (state === undefined) throw new Error("--input <file> is required unless --replay carries a state");

  const definition = parseDefinition(readJson(definitionFile));
  const asked = definition.questions.filter((check) => skipReason(check, state) === undefined);
  if (values["dry-run"]) {
    print({
      mode: "dry-run",
      definition: { id: definition.id, version: definition.version },
      request: buildRequest(state, asked),
    });
    return 0;
  }

  const jev =
    replay === undefined
      ? liveGateway(() => new TypeSafeClient({ logLevel: "off" }))
      : replayGateway(replay.answers, replay.usage);
  const report = await evaluate(definition, state, jev);
  print(report);
  return exitCodeFor(report.items);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    print({ error: error instanceof Error ? error.message : String(error) });
    process.exitCode = error instanceof TypeSafeError ? 3 : 2;
  },
);
