import assert from "node:assert/strict";
import { test } from "node:test";
import type { Verdict } from "./checkkit.js";
import { PAGE_QUESTION_IDS, SITE_QUESTION_IDS, worstVerdict } from "./groups.js";

const item = (id: string, verdict: Verdict) => ({ id, verdict });

test("worstVerdict prefers fail over review over pass and ignores the other lane", () => {
  const items = [
    item("identifiable_publisher", "pass"),
    item("site_purpose", "review"),
    item("disclosed_incentives", "pass"),
    item("evidence_for_claims", "fail"),
    item("self_consistent", "pass"),
  ];
  assert.equal(worstVerdict(items, SITE_QUESTION_IDS), "review");
  assert.equal(worstVerdict(items, PAGE_QUESTION_IDS), "fail");
  assert.equal(worstVerdict([item("self_consistent", "not_applicable")], PAGE_QUESTION_IDS), "not_applicable");
});
