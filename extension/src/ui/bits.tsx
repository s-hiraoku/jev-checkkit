import type { JevAnswer, Verdict } from "../lib/checkkit.js";
import { choiceLabel, VERDICT_LABELS } from "../lib/labels.js";

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  return <span className={`chip chip-${verdict}`}>{VERDICT_LABELS[verdict]}</span>;
}

export function Lane({ title, verdict }: { title: string; verdict: Verdict }) {
  return (
    <div className="lane">
      <strong>{title}</strong>
      <div className={`verdict verdict-${verdict}`}>{VERDICT_LABELS[verdict]}</div>
    </div>
  );
}

export function Needle({ value }: { value: number }) {
  const left = `${Math.min(100, Math.max(0, value * 100))}%`;
  return (
    <div className="needle" aria-hidden="true">
      <i style={{ left }} />
    </div>
  );
}

export function AnswerView({ id, answer }: { id: string; answer?: JevAnswer }) {
  if (answer === undefined) return null;
  if (answer.type === "noul") {
    return (
      <>
        <Needle value={answer.noul} />
        <p>noul {answer.noul.toFixed(2)}</p>
      </>
    );
  }
  if (answer.type === "choice") {
    return <p>{choiceLabel(id, answer.choice)} · 確信度 {answer.confidence.toFixed(2)}</p>;
  }
  return (
    <>
      <Needle value={answer.score / 2} />
      <p>score {answer.score.toFixed(2)} · 確信度 {answer.confidence.toFixed(2)}</p>
    </>
  );
}
