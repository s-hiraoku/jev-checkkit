import {
  choice,
  noul,
  score,
  type EntryType,
  type Question,
  type Questions,
  type SystemOneRequest,
  type TypeSafeClient,
  type Usage,
} from "@typesafe-ai/sdk";
import { isEntryType, isRecord } from "./definition.js";
import type { Check, JevAnswer } from "./types.js";

export interface JevReply {
  answers: Record<string, JevAnswer>;
  usage: Usage;
}

export interface JevGateway {
  ask(request: SystemOneRequest): Promise<JevReply>;
}

function toQuestion(check: Check): Question {
  switch (check.type) {
    case "noul":
      return noul(check.instructions, check.criteria);
    case "choice":
      return choice(check.instructions, check.criteria);
    case "score":
      return score(check.instructions, check.criteria);
  }
}

export function buildRequest(state: EntryType, checks: readonly Check[]): SystemOneRequest {
  const questions: Questions = {};
  for (const check of checks) questions[check.id] = toQuestion(check);
  return { state, questions };
}

export function liveGateway(connect: () => TypeSafeClient): JevGateway {
  return {
    async ask(request) {
      const { answers, usage } = await connect().systemOne(request);
      return { answers, usage };
    },
  };
}

export function replayGateway(
  answers: Record<string, JevAnswer>,
  usage: Usage = { input_tokens: 0, output_tokens: 0 },
): JevGateway & { calls: number } {
  const gateway: JevGateway & { calls: number } = {
    calls: 0,
    async ask() {
      gateway.calls += 1;
      return { answers, usage };
    },
  };
  return gateway;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number") throw new Error(`${field} must be a number`);
  return value;
}

function numberMap(raw: unknown, field: string): Record<string, number> {
  if (!isRecord(raw)) throw new Error(`${field} must be an object`);
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, requireNumber(value, `${field}.${key}`)] as const));
}

function entryMap(raw: unknown, field: string): Record<string, EntryType> {
  if (!isRecord(raw)) throw new Error(`${field} must be an object`);
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => {
      if (!isEntryType(value)) throw new Error(`${field}.${key} must be text, a JSON object, an array, or null`);
      return [key, value] as const;
    }),
  );
}

function parseAnswer(raw: unknown, field: string): JevAnswer {
  if (!isRecord(raw)) throw new Error(`${field} must be an object`);
  switch (raw.type) {
    case "noul":
      return { type: "noul", noul: requireNumber(raw.noul, `${field}.noul`) };
    case "choice":
      if (typeof raw.choice !== "string") throw new Error(`${field}.choice must be a string`);
      return {
        type: "choice",
        choice: raw.choice,
        confidence: requireNumber(raw.confidence, `${field}.confidence`),
        probabilities: numberMap(raw.probabilities, `${field}.probabilities`),
      };
    case "score":
      return {
        type: "score",
        score: requireNumber(raw.score, `${field}.score`),
        confidence: requireNumber(raw.confidence, `${field}.confidence`),
        legend: entryMap(raw.legend, `${field}.legend`),
        probabilities: numberMap(raw.probabilities, `${field}.probabilities`),
      };
    default:
      throw new Error(`${field}.type must be "noul", "choice", or "score"`);
  }
}

export function parseReplayAnswers(raw: unknown, field: string): Record<string, JevAnswer> {
  if (!isRecord(raw)) throw new Error(`${field} must be an object keyed by question id`);
  return Object.fromEntries(Object.entries(raw).map(([id, answer]) => [id, parseAnswer(answer, `${field}.${id}`)] as const));
}

export function parseUsage(raw: unknown, field: string): Usage {
  if (!isRecord(raw)) throw new Error(`${field} must be an object`);
  return {
    input_tokens: requireNumber(raw.input_tokens, `${field}.input_tokens`),
    output_tokens: requireNumber(raw.output_tokens, `${field}.output_tokens`),
  };
}
