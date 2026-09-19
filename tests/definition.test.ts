import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DefinitionError, parseDefinition } from "../src/index.js";

const load = (file: string): unknown => JSON.parse(readFileSync(new URL(`../fixtures/${file}`, import.meta.url), "utf8"));

const approved = (): Record<string, unknown> => load("sample-approved.checker.json") as Record<string, unknown>;

const refused = (raw: unknown): DefinitionError => {
  try {
    parseDefinition(raw);
  } catch (error) {
    if (error instanceof DefinitionError) return error;
    throw error;
  }
  assert.fail("parseDefinition accepted the definition");
};

test("a draft definition is refused with kind unapproved and the message names approval", () => {
  const error = refused(load("sample-draft.checker.json"));
  assert.equal(error.kind, "unapproved");
  assert.match(error.message, /approval/);
});

test("the approved fixture parses into four questions in file order", () => {
  const definition = parseDefinition(approved());
  assert.equal(definition.id, "sample-paragraph");
  assert.equal(definition.version, 1);
  assert.equal(definition.approval.status, "approved");
  assert.equal(definition.questions.length, 4);
  assert.deepEqual(
    definition.questions.map((question) => [question.id, question.type]),
    [
      ["one_claim", "noul"],
      ["tone", "choice"],
      ["clarity", "score"],
      ["cites_source", "noul"],
    ],
  );
});

test("a duplicate question id is refused and the message names the id", () => {
  const raw = approved();
  const questions = raw.questions as Record<string, unknown>[];
  questions[2]!.id = "one_claim";
  const error = refused(raw);
  assert.equal(error.kind, "duplicate-id");
  assert.equal(error.message, 'questions[2].id "one_claim" repeats an earlier question id');
});

test("an empty question set is refused", () => {
  const error = refused({ ...approved(), questions: [] });
  assert.equal(error.kind, "empty");
  assert.match(error.message, /questions/);
});

test("a malformed question names the offending field", () => {
  const raw = approved();
  const questions = raw.questions as Record<string, unknown>[];
  delete questions[1]!.options;
  const error = refused(raw);
  assert.equal(error.kind, "malformed");
  assert.equal(error.message, "questions[1].options must be an object mapping labels to pass, fail, or review");
});

test("a passAt at or below failAt is refused for noul and score", () => {
  const raw = approved();
  const questions = raw.questions as Record<string, unknown>[];
  questions[0]!.passAt = 0.2;
  questions[0]!.failAt = 0.2;
  assert.equal(refused(raw).message, "questions[0].passAt 0.2 must be greater than questions[0].failAt 0.2");
  const score = approved();
  (score.questions as Record<string, unknown>[])[2]!.passAt = 0.4;
  assert.equal(refused(score).message, "questions[2].passAt 0.4 must be greater than questions[2].failAt 0.5");
});

test("an approved definition with a bad approval record is malformed, not unapproved", () => {
  const error = refused({ ...approved(), approval: { status: "approved", at: "2026-09-19T00:00:00Z" } });
  assert.equal(error.kind, "malformed");
  assert.equal(error.message, "approval.by must be a non-empty string");
});
