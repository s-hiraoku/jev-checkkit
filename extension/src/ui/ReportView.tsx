import { PAGE_QUESTION_IDS, SITE_QUESTION_IDS, worstVerdict } from "../lib/groups.js";
import type { StoredRecord } from "../lib/session.js";
import { ItemList } from "./ItemList.js";
import { Lane } from "./bits.js";

export function ReportView({ record, compact = false }: { record: StoredRecord; compact?: boolean }) {
  const site = worstVerdict(record.report.items, SITE_QUESTION_IDS);
  const page = worstVerdict(record.report.items, PAGE_QUESTION_IDS);
  return (
    <div>
      <div className="lanes">
        <Lane title="Site" verdict={site} />
        <Lane title="Page" verdict={page} />
      </div>
      <p className="url" style={{ marginTop: 10 }}>
        {record.snapshot.title || "(無題)"}
        <br />
        {record.snapshot.url}
      </p>
      {compact ? null : (
        <p className="lede">
          {record.snapshot.wordCount} 語 · 外部ホスト {record.snapshot.citationCount} · HTTPS {record.snapshot.isHttps ? "あり" : "なし"} · 著者
          {record.snapshot.hasAuthor ? "あり" : "なし"}
        </p>
      )}
      <ItemList items={record.report.items} />
      {compact ? null : (
        <p className="lede">
          Jev {record.report.timing.jevMs} ms · 入力 {record.report.usage.input_tokens} / 出力 {record.report.usage.output_tokens}
        </p>
      )}
    </div>
  );
}
