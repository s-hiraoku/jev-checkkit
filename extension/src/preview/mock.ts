import { parseDefinition, replayGateway, type JevAnswer } from "../lib/checkkit.js";
import type { Bridge } from "../lib/bridge.js";
import type { PageSnapshot } from "../lib/page-state.js";
import { checkSnapshot } from "../lib/run-check.js";
import { DEFAULT_SETTINGS, parseSettings, type ExtensionSettings } from "../lib/settings.js";
import type { SessionPayload, StoredRecord } from "../lib/session.js";
import definitionRaw from "../../../fixtures/page-credibility.checker.json";
import failReplay from "../../../fixtures/replay/page-credibility-fail.json";
import passReplay from "../../../fixtures/replay/page-credibility-pass.json";

interface ReplayFile {
  state: Omit<PageSnapshot, "extractedAt">;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

function toSnapshot(state: Omit<PageSnapshot, "extractedAt">): PageSnapshot {
  return { ...state, extractedAt: "2026-09-20T00:00:00.000Z" };
}

async function recordFrom(replay: ReplayFile, id: string): Promise<StoredRecord> {
  const snapshot = toSnapshot(replay.state);
  const report = await checkSnapshot(snapshot, definitionRaw, replayGateway(replay.answers, replay.usage));
  return { id, tabId: 1, snapshot, report, createdAt: "2026-09-20T00:00:00.000Z" };
}

export async function createPreviewBridge(scene: string): Promise<Bridge> {
  const pass = await recordFrom(passReplay as ReplayFile, "preview-pass");
  const fail = await recordFrom(failReplay as ReplayFile, "preview-fail");
  let settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    apiKey: scene === "setup" ? "" : "sk-preview",
    approver: scene === "setup" ? "" : "preview",
    ackedVersion: scene === "setup" ? null : 1,
    followTab: true,
  };
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const payload = (): SessionPayload => {
    const parsed = parseSettings(settings);
    const questions = [...parseDefinition(definitionRaw).questions];
    if (scene === "setup" && (parsed.ackedVersion !== 1 || parsed.apiKey.trim() === "")) {
      return {
        view: {
          status: "needs-setup",
          reason: parsed.ackedVersion !== 1 ? "approval" : "api-key",
          definitionVersion: 1,
        },
        questions,
        history: [pass, fail],
        settings: parsed,
        definitionVersion: 1,
      };
    }
    return {
      view: { status: "ready", record: scene === "fail" ? fail : pass },
      questions,
      history: [pass, fail],
      settings: parsed,
      definitionVersion: 1,
    };
  };

  return {
    getSession: async () => payload(),
    saveSettings: async (next) => {
      settings = parseSettings(next);
      notify();
      return payload();
    },
    checkNow: async () => payload(),
    openDetails: async () => {
      window.location.hash = "#details";
    },
    openOptions: async () => {
      window.location.hash = "#options";
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}
