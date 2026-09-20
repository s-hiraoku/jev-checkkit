import { useEffect, useState } from "react";
import type { Bridge } from "../lib/bridge.js";
import { DEFAULT_SETTINGS } from "../lib/settings.js";
import type { SessionPayload } from "../lib/session.js";
import { ReportView } from "./ReportView.js";

export function SidePanelApp({ bridge }: { bridge: Bridge }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    bridge
      .getSession()
      .then((next) => {
        setSession(next);
        setError(null);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));

  useEffect(() => {
    void refresh();
    return bridge.subscribe(() => {
      void refresh();
    });
  }, [bridge]);

  if (session === null && error === null) return <main className="shell">読み込み中…</main>;
  const view = session?.view;

  return (
    <main className="shell">
      <div>
        <p className="kicker">Jev checker</p>
        <h1>信憑性検査</h1>
        <p className="lede">表示中のタブを追跡し、発行元と本文を分けて見ます。一つの点数にはしません。</p>
      </div>

      {error ? <p className="notice fail">{error}</p> : null}

      {view?.status === "needs-setup" ? (
        <div className="notice">
          {view.reason === "approval"
            ? "設定でチェックリスト全体を承認するまで検査しません。"
            : "TypeSafe の API キーがまだありません。"}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" type="button" onClick={() => void bridge.openOptions()}>
              設定を開く
            </button>
          </div>
        </div>
      ) : null}

      {view?.status === "unsupported" ? (
        <p className="notice">http(s) のページだけを検査します。今の URL は {view.url || "（不明）"} です。</p>
      ) : null}

      {view?.status === "idle" ? (
        <p className="lede">{view.followTab ? "タブを開くと自動で検査します。" : "追跡はオフです。必要なときに検査してください。"}</p>
      ) : null}

      {view?.status === "checking" ? (
        <p className="lede">検査中… {view.snapshot.title || view.snapshot.hostname}</p>
      ) : null}

      {view?.status === "error" ? <p className="notice fail">{view.message}</p> : null}

      {view?.status === "ready" ? <ReportView record={view.record} compact /> : null}

      <div className="row">
        <button className="btn" type="button" onClick={() => void bridge.checkNow().then(setSession).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)))}>
          今のタブを検査
        </button>
        <button className="btn secondary" type="button" onClick={() => void bridge.openDetails()}>
          詳細
        </button>
        <button className="btn secondary" type="button" onClick={() => void bridge.openOptions()}>
          設定
        </button>
      </div>
      <p className="foot">判定は根拠です。ページの遮断、公開、外部送信はしません。追跡 {session?.settings.followTab ?? DEFAULT_SETTINGS.followTab ? "オン" : "オフ"}</p>
    </main>
  );
}
