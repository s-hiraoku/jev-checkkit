import type { ItemResult } from "./types.js";

export function exitCodeFor(items: readonly ItemResult[]): 0 | 1 | 2 {
  if (items.some((item) => item.verdict === "fail")) return 1;
  if (items.some((item) => item.verdict === "review" || item.verdict === "error")) return 2;
  return 0;
}

export function startTimer(): () => number {
  const started = performance.now();
  return () => Math.round(performance.now() - started);
}
