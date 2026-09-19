import type {
  ChoiceCriteria,
  ChoiceResponse,
  EntryType,
  JsonValue,
  NoulQuestion,
  NoulResponse,
  ScoreCriteria,
  ScoreResponse,
  Usage,
} from "@typesafe-ai/sdk";

export type Verdict = "pass" | "fail" | "review" | "not_applicable" | "error";
export type MappedVerdict = Extract<Verdict, "pass" | "fail" | "review">;

export type CheckerId = string & { readonly __brand: "CheckerId" };
export type QuestionId = string & { readonly __brand: "QuestionId" };

export type Approval = { status: "draft" } | { status: "approved"; at: string; by: string };

export type ApplyWhen =
  | { path: string; op: "exists" }
  | { path: string; op: "equals"; value: JsonValue };

interface CheckBase {
  id: QuestionId;
  instructions: EntryType;
  applyWhen?: ApplyWhen;
}

export type NoulCheck = CheckBase & {
  type: "noul";
  criteria?: NoulQuestion["criteria"];
  passAt?: number;
  failAt?: number;
};

export type ChoiceCheck = CheckBase & {
  type: "choice";
  criteria: ChoiceCriteria;
  options: Record<string, MappedVerdict>;
  confidenceFloor?: number;
};

export type ScoreCheck = CheckBase & {
  type: "score";
  criteria: ScoreCriteria;
  passAt: number;
  failAt: number;
  confidenceFloor?: number;
};

export type Check = NoulCheck | ChoiceCheck | ScoreCheck;

export interface CheckerDefinition {
  id: CheckerId;
  version: number;
  subject: string;
  approval: Approval;
  questions: readonly Check[];
}

export type ApprovedDefinition = CheckerDefinition & {
  approval: Extract<Approval, { status: "approved" }>;
};

export type JevAnswer = NoulResponse | ChoiceResponse | ScoreResponse;

export interface ItemResult {
  id: QuestionId;
  verdict: Verdict;
  reason: string;
  answer?: JevAnswer;
}

export interface CheckReport {
  definition: { id: CheckerId; version: number };
  items: ItemResult[];
  usage: Usage;
  timing: { wallMs: number; jevMs: number };
}
