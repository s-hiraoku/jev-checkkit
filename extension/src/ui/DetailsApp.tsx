import { useEffect, useMemo, useState } from "react";
import { recordById, type Bridge } from "../lib/bridge.js";
import type { SessionPayload } from "../lib/session.js";
import { ReportView } from "./ReportView.js";

function requestedId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

export function DetailsApp({ bridge }: { bridge: Bridge }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useMemo(() => requestedId(), []);

  useEffect(() => {
    void bridge
      .getSession()
      .then(setSession)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
    return bridge.subscribe(() => {
      void bridge.getSession().then(setSession);
    });
  }, [bridge]);

  if (session === null) return <main className="shell wide">{error ?? "読み込み中…"}</main>;
  const record = recordById(session.history, id);

  return (
    <main className="shell wide">
      <div>
        <p className="kicker">Details</p>
        <h1>検査の詳細</h1>
        <p className="lede">保存したレポートは判断材料です。ここから公開や送信はできません。</p>
      </div>
      {record ? <ReportView record={record} /> : <p className="notice">まだ検査結果がありません。側面パネルから今のタブを検査してください。</p>}
      {record ? (
        <section className="card">
          <h2>送った本文</h2>
          <p className="lede">{record.snapshot.text}</p>
        </section>
      ) : null}
      <section>
        <h2>履歴</h2>
        <div className="history">
          {session.history.map((item) => (
            <a key={item.id} href={`?id=${encodeURIComponent(item.id)}`}>
              <strong>{item.snapshot.title || item.snapshot.hostname}</strong>
              <div className="url">{item.snapshot.url}</div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
