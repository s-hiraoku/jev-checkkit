import type { ItemResult } from "../lib/checkkit.js";
import { questionLabel } from "../lib/labels.js";
import { AnswerView, VerdictChip } from "./bits.js";

export function ItemList({ items }: { items: readonly ItemResult[] }) {
  return (
    <div>
      {items.map((item) => (
        <article className="item" key={item.id}>
          <div>
            <strong>{questionLabel(item.id)}</strong>
            <p>{item.reason}</p>
            <AnswerView id={item.id} answer={item.answer} />
          </div>
          <VerdictChip verdict={item.verdict} />
        </article>
      ))}
    </div>
  );
}
