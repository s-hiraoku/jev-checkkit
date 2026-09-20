import type { Verdict } from "./checkkit.js";

export const SITE_QUESTION_IDS = ["identifiable_publisher", "site_purpose", "disclosed_incentives"] as const;
export const PAGE_QUESTION_IDS = [
  "evidence_for_claims",
  "separates_fact_and_opinion",
  "unsourced_specifics",
  "self_consistent",
  "certainty_matches_evidence",
] as const;

const RANK: Record<Verdict, number> = {
  fail: 4,
  error: 3,
  review: 2,
  pass: 1,
  not_applicable: 0,
};

export function worstVerdict(items: readonly { id: string; verdict: Verdict }[], ids: readonly string[]): Verdict {
  let worst: Verdict = "not_applicable";
  for (const item of items) {
    if (!ids.includes(item.id)) continue;
    if (RANK[item.verdict] > RANK[worst]) worst = item.verdict;
  }
  return worst;
}
