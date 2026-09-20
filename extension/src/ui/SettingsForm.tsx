import { useState } from "react";
import type { Check } from "../lib/checkkit.js";
import type { ExtensionSettings } from "../lib/settings.js";
import { ChecklistView } from "./ChecklistView.js";

interface Props {
  settings: ExtensionSettings;
  questions: readonly Check[];
  definitionVersion: number;
  onSave: (settings: ExtensionSettings) => Promise<void>;
}

export function SettingsForm({ settings, questions, definitionVersion, onSave }: Props) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const approved = draft.approver.trim() !== "" && draft.ackedVersion === definitionVersion;

  const update = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        void onSave(draft)
          .then(() => setMessage("保存しました。"))
          .catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)))
          .finally(() => setBusy(false));
      }}
    >
      <p className="kicker">Settings</p>
      <h1>設定</h1>
      <p className="lede">キーは拡張のストレージにだけ置き、Jev への 1 回の問い合わせ以外には使いません。ログには出しません。</p>

      <label className="field">
        <span>TypeSafe API キー</span>
        <input
          type="password"
          autoComplete="off"
          value={draft.apiKey}
          onChange={(event) => update("apiKey", event.target.value)}
        />
      </label>

      <label className="toggle">
        <input type="checkbox" checked={draft.followTab} onChange={(event) => update("followTab", event.target.checked)} />
        表示中のタブを追跡して検査する
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={draft.recheckOnChange}
          onChange={(event) => update("recheckOnChange", event.target.checked)}
        />
        本文が変わったら再検査する
      </label>
      <label className="field">
        <span>再検査までの待ち（ミリ秒）</span>
        <input
          type="number"
          value={draft.debounceMs}
          onChange={(event) => update("debounceMs", Number(event.target.value))}
        />
      </label>
      <label className="field">
        <span>Jev に送る本文の上限（文字）</span>
        <input type="number" value={draft.maxChars} onChange={(event) => update("maxChars", Number(event.target.value))} />
      </label>
      <label className="field">
        <span>本文とみなす最小語数</span>
        <input type="number" value={draft.minWords} onChange={(event) => update("minWords", Number(event.target.value))} />
      </label>

      <ChecklistView questions={questions} />

      <label className="field">
        <span>承認者の名前</span>
        <input value={draft.approver} onChange={(event) => update("approver", event.target.value)} />
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={approved}
          onChange={(event) => update("ackedVersion", event.target.checked ? definitionVersion : null)}
        />
        上のチェックリスト全体を承認する。判定は根拠であり、公開・送信・遮断の許可ではない。
      </label>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={busy}>
          設定を保存
        </button>
        {message ? <p className="lede">{message}</p> : null}
      </div>
    </form>
  );
}
