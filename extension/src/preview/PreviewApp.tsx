import { useEffect, useState } from "react";
import type { Bridge } from "../lib/bridge.js";
import { DetailsApp } from "../ui/DetailsApp.js";
import { OptionsApp } from "../ui/OptionsApp.js";
import { SidePanelApp } from "../ui/SidePanelApp.js";
import { createPreviewBridge } from "./mock.js";

const SCENES = [
  ["pass", "通過例"],
  ["fail", "要警戒例"],
  ["setup", "初期設定"],
] as const;

function pageFromHash(): "side" | "options" | "details" {
  if (window.location.hash === "#options") return "options";
  if (window.location.hash === "#details") return "details";
  return "side";
}

export function PreviewApp() {
  const [scene, setScene] = useState("pass");
  const [page, setPage] = useState(pageFromHash);
  const [bridge, setBridge] = useState<Bridge | null>(null);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void createPreviewBridge(scene).then((next) => {
      if (!cancelled) setBridge(next);
    });
    return () => {
      cancelled = true;
    };
  }, [scene]);

  return (
    <div>
      <nav className="row" style={{ padding: 12, borderBottom: "1px solid var(--line)", background: "var(--card)" }}>
        {SCENES.map(([id, label]) => (
          <button key={id} className={scene === id ? "btn" : "btn secondary"} type="button" onClick={() => setScene(id)}>
            {label}
          </button>
        ))}
        <button className={page === "side" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#side"; setPage("side"); }}>
          側面パネル
        </button>
        <button className={page === "options" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#options"; setPage("options"); }}>
          設定
        </button>
        <button className={page === "details" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#details"; setPage("details"); }}>
          詳細
        </button>
      </nav>
      {bridge === null ? <p className="shell">プレビューを組み立てています…</p> : null}
      {bridge !== null && page === "side" ? <div style={{ maxWidth: 380 }}><SidePanelApp bridge={bridge} /></div> : null}
      {bridge !== null && page === "options" ? <OptionsApp bridge={bridge} /> : null}
      {bridge !== null && page === "details" ? <DetailsApp bridge={bridge} /> : null}
    </div>
  );
}
