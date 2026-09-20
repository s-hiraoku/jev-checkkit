import type { Check, Verdict } from "./checkkit.js";

export const QUESTION_LABELS: Record<string, string> = {
  identifiable_publisher: "発行元が特定できる",
  site_purpose: "ページの主な目的",
  disclosed_incentives: "利害の開示",
  evidence_for_claims: "主張の根拠",
  separates_fact_and_opinion: "事実と意見の切り分け",
  unsourced_specifics: "出典のない具体値",
  self_consistent: "本文の内部矛盾",
  certainty_matches_evidence: "断定と根拠の釣り合い",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  pass: "通過",
  fail: "要警戒",
  review: "要確認",
  not_applicable: "対象外",
  error: "エラー",
};

export const PURPOSE_LABELS: Record<string, string> = {
  news_reference: "報道・解説",
  opinion_analysis: "意見・分析",
  commercial: "販売・集客",
  satire_entertainment: "風刺・娯楽",
  unclear: "判別できない",
};

export const SPECIFIC_LABELS: Record<string, string> = {
  none: "ない / 出典あり",
  some: "中核以外に少しある",
  many: "中核の数字や引用に出典がない",
};

export function questionLabel(id: string): string {
  return QUESTION_LABELS[id] ?? id;
}

export function choiceLabel(questionId: string, choice: string): string {
  if (questionId === "site_purpose") return PURPOSE_LABELS[choice] ?? choice;
  if (questionId === "unsourced_specifics") return SPECIFIC_LABELS[choice] ?? choice;
  return choice;
}

export function instructionText(check: Check): string {
  return typeof check.instructions === "string" ? check.instructions : JSON.stringify(check.instructions);
}
