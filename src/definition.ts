import type { ChoiceCriteria, EntryType, JsonValue, NoulQuestion, ScoreCriteria } from "@typesafe-ai/sdk";
import type {
  ApplyWhen,
  Approval,
  ApprovedDefinition,
  Check,
  CheckerId,
  MappedVerdict,
  QuestionId,
} from "./types.js";

export type DefinitionErrorKind = "malformed" | "unapproved" | "duplicate-id" | "empty";

export class DefinitionError extends Error {
  constructor(
    readonly kind: DefinitionErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "DefinitionError";
  }
}

const ENTRY = "text, a JSON object, an array, or null";

const malformed = (field: string, expected: string): DefinitionError =>
  new DefinitionError("malformed", `${field} must be ${expected}`);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function isEntryType(value: unknown): value is EntryType {
  if (value === null || typeof value === "string") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isScoreCriteria(value: unknown): value is ScoreCriteria {
  return Array.isArray(value) && value.length >= 2 && value.every(isEntryType);
}

const MAPPED_VERDICTS: Record<MappedVerdict, null> = { pass: null, fail: null, review: null };

function isMappedVerdict(value: unknown): value is MappedVerdict {
  return typeof value === "string" && Object.hasOwn(MAPPED_VERDICTS, value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw malformed(field, "a non-empty string");
  return value;
}

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw malformed(field, "a finite number");
  return value;
}

function requireNumber(value: unknown, field: string): number {
  const number = optionalNumber(value, field);
  if (number === undefined) throw malformed(field, "a finite number");
  return number;
}

function requireBands<T extends number | undefined>(passAt: T, failAt: T, field: string): { passAt: T; failAt: T } {
  if (passAt !== undefined && failAt !== undefined && passAt <= failAt) {
    throw new DefinitionError("malformed", `${field}.passAt ${passAt} must be greater than ${field}.failAt ${failAt}`);
  }
  return { passAt, failAt };
}

function requireEntry(value: unknown, field: string): EntryType {
  if (!isEntryType(value)) throw malformed(field, ENTRY);
  return value;
}

function parseApproval(raw: unknown): Approval {
  if (!isRecord(raw)) throw malformed("approval", "an object");
  switch (raw.status) {
    case "draft":
      return { status: "draft" };
    case "approved":
      return {
        status: "approved",
        at: requireString(raw.at, "approval.at"),
        by: requireString(raw.by, "approval.by"),
      };
    default:
      throw malformed("approval.status", '"draft" or "approved"');
  }
}

function parseApplyWhen(raw: unknown, field: string): ApplyWhen {
  if (!isRecord(raw)) throw malformed(field, "an object");
  const path = requireString(raw.path, `${field}.path`);
  switch (raw.op) {
    case "exists":
      return { path, op: "exists" };
    case "equals": {
      const value = raw.value;
      if (!isJsonValue(value)) throw malformed(`${field}.value`, "a JSON value");
      return { path, op: "equals", value };
    }
    default:
      throw malformed(`${field}.op`, '"exists" or "equals"');
  }
}

function parseNoulCriteria(raw: unknown, field: string): NoulQuestion["criteria"] {
  if (raw === null) return null;
  if (!isRecord(raw)) throw malformed(field, 'an object with optional "true" and "false" descriptions, or null');
  const description = (key: "true" | "false"): EntryType | undefined => {
    const value = raw[key];
    return value === undefined ? undefined : requireEntry(value, `${field}.${key}`);
  };
  return { true: description("true"), false: description("false") };
}

function parseChoiceCriteria(raw: unknown, field: string): ChoiceCriteria {
  if (!isRecord(raw) || Object.keys(raw).length === 0) throw malformed(field, "an object with at least one label");
  return Object.fromEntries(
    Object.entries(raw).map(([label, description]) => [label, requireEntry(description, `${field}.${label}`)] as const),
  );
}

function parseOptions(raw: unknown, field: string): Record<string, MappedVerdict> {
  if (!isRecord(raw)) throw malformed(field, "an object mapping labels to pass, fail, or review");
  return Object.fromEntries(
    Object.entries(raw).map(([label, verdict]) => {
      if (!isMappedVerdict(verdict)) throw malformed(`${field}.${label}`, '"pass", "fail", or "review"');
      return [label, verdict] as const;
    }),
  );
}

function parseCheck(raw: unknown, field: string): Check {
  if (!isRecord(raw)) throw malformed(field, "an object");
  const base = {
    id: requireString(raw.id, `${field}.id`) as QuestionId,
    instructions: requireEntry(raw.instructions, `${field}.instructions`),
    applyWhen: raw.applyWhen === undefined ? undefined : parseApplyWhen(raw.applyWhen, `${field}.applyWhen`),
  };
  switch (raw.type) {
    case "noul":
      return {
        ...base,
        type: "noul",
        criteria: raw.criteria === undefined ? undefined : parseNoulCriteria(raw.criteria, `${field}.criteria`),
        ...requireBands(optionalNumber(raw.passAt, `${field}.passAt`), optionalNumber(raw.failAt, `${field}.failAt`), field),
      };
    case "choice":
      return {
        ...base,
        type: "choice",
        criteria: parseChoiceCriteria(raw.criteria, `${field}.criteria`),
        options: parseOptions(raw.options, `${field}.options`),
        confidenceFloor: optionalNumber(raw.confidenceFloor, `${field}.confidenceFloor`),
      };
    case "score": {
      const criteria = raw.criteria;
      if (!isScoreCriteria(criteria)) throw malformed(`${field}.criteria`, "a list of at least two descriptions");
      return {
        ...base,
        type: "score",
        criteria,
        ...requireBands(requireNumber(raw.passAt, `${field}.passAt`), requireNumber(raw.failAt, `${field}.failAt`), field),
        confidenceFloor: optionalNumber(raw.confidenceFloor, `${field}.confidenceFloor`),
      };
    }
    default:
      throw malformed(`${field}.type`, '"noul", "choice", or "score"');
  }
}

export function parseDefinition(raw: unknown): ApprovedDefinition {
  if (!isRecord(raw)) throw malformed("definition", "a JSON object");
  const id = requireString(raw.id, "id") as CheckerId;
  const version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw malformed("version", "a non-negative integer");
  }
  const subject = requireString(raw.subject, "subject");
  const approval = parseApproval(raw.approval);
  if (!Array.isArray(raw.questions)) throw malformed("questions", "an array");
  if (raw.questions.length === 0) {
    throw new DefinitionError("empty", "questions is empty; a definition needs at least one question");
  }
  const questions = raw.questions.map((question, index) => parseCheck(question, `questions[${index}]`));
  const seen = new Set<string>();
  for (const [index, question] of questions.entries()) {
    if (seen.has(question.id)) {
      throw new DefinitionError("duplicate-id", `questions[${index}].id "${question.id}" repeats an earlier question id`);
    }
    seen.add(question.id);
  }
  if (approval.status !== "approved") {
    throw new DefinitionError("unapproved", 'approval.status is "draft"; approve every question before running this definition');
  }
  return { id, version, subject, approval, questions };
}
