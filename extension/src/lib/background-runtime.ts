import { TypeSafeError } from "@typesafe-ai/sdk";
import { parseDefinition } from "./checkkit.js";
import { isInspectableUrl, snapshotFingerprint, type PageSnapshot } from "./page-state.js";
import { checkSnapshot, createLiveJev } from "./run-check.js";
import { DEFAULT_SETTINGS, parseSettings, setupGap, type ExtensionSettings } from "./settings.js";
import type { ClientMessage, SessionPayload, SessionView, StoredRecord } from "./session.js";

const SETTINGS_KEY = "settings";
const HISTORY_KEY = "history";
const HISTORY_LIMIT = 30;

type TabSession =
  | { status: "unsupported"; url: string }
  | { status: "checking"; snapshot: PageSnapshot; fingerprint: string }
  | { status: "ready"; record: StoredRecord; fingerprint: string }
  | { status: "error"; message: string; snapshot?: PageSnapshot; fingerprint?: string };

const tabs = new Map<number, TabSession>();
const inflight = new Map<number, string>();
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let debounceTabId: number | undefined;

function definitionVersion(raw: unknown): number {
  return parseDefinition(raw).version;
}

function questionsOf(raw: unknown) {
  return [...parseDefinition(raw).questions];
}

async function readSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return parseSettings(stored[SETTINGS_KEY]);
}

async function writeSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function readHistory(): Promise<StoredRecord[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(stored[HISTORY_KEY]) ? (stored[HISTORY_KEY] as StoredRecord[]) : [];
}

async function writeHistory(history: StoredRecord[]): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(0, HISTORY_LIMIT) });
}

function publicSettings(settings: ExtensionSettings): ExtensionSettings {
  return settings;
}

async function payload(definitionRaw: unknown, tabId: number | undefined): Promise<SessionPayload> {
  const settings = await readSettings();
  const history = await readHistory();
  const version = definitionVersion(definitionRaw);
  return {
    view: viewFor(settings, version, tabId === undefined ? undefined : tabs.get(tabId)),
    questions: questionsOf(definitionRaw),
    history,
    settings: publicSettings(settings),
    definitionVersion: version,
  };
}

function viewFor(settings: ExtensionSettings, version: number, session: TabSession | undefined): SessionView {
  const gap = setupGap(settings, version);
  if (gap !== null) return { status: "needs-setup", reason: gap, definitionVersion: version };
  if (session === undefined) return { status: "idle", followTab: settings.followTab };
  if (session.status === "unsupported") return session;
  if (session.status === "checking") return { status: "checking", snapshot: session.snapshot };
  if (session.status === "ready") return { status: "ready", record: session.record };
  return { status: "error", message: session.message, snapshot: session.snapshot };
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

async function broadcast(definitionRaw: unknown): Promise<void> {
  const tabId = await activeTabId();
  const next = await payload(definitionRaw, tabId);
  try {
    await chrome.runtime.sendMessage({ type: "SESSION_UPDATED", session: next });
  } catch {
    return;
  }
}

async function extractTab(tabId: number, settings: ExtensionSettings): Promise<PageSnapshot> {
  const snapshot = (await chrome.tabs.sendMessage(tabId, {
    type: "EXTRACT",
    maxChars: settings.maxChars,
    minWords: settings.minWords,
  })) as PageSnapshot | { error: string };
  if (snapshot && typeof snapshot === "object" && "error" in snapshot) throw new Error(snapshot.error);
  return snapshot as PageSnapshot;
}

function errorMessage(error: unknown): string {
  if (error instanceof TypeSafeError) return "Jev への送信に失敗しました。キーとネットワークを確認してください。";
  if (error instanceof Error) {
    if (error.message.includes("Could not establish connection")) {
      return "このページからは本文を取れません。再読み込みしてから検査してください。";
    }
    return error.message;
  }
  return String(error);
}

async function checkTab(definitionRaw: unknown, tabId: number, force: boolean): Promise<void> {
  const settings = await readSettings();
  const version = definitionVersion(definitionRaw);
  const gap = setupGap(settings, version);
  if (gap !== null) {
    await broadcast(definitionRaw);
    return;
  }
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? "";
  if (!isInspectableUrl(url)) {
    tabs.set(tabId, { status: "unsupported", url });
    await broadcast(definitionRaw);
    return;
  }
  let snapshot: PageSnapshot;
  try {
    snapshot = await extractTab(tabId, settings);
  } catch (error) {
    tabs.set(tabId, { status: "error", message: errorMessage(error) });
    await broadcast(definitionRaw);
    return;
  }
  const fingerprint = snapshotFingerprint(snapshot);
  const previous = tabs.get(tabId);
  if (!force && previous?.status === "ready" && previous.fingerprint === fingerprint) return;
  if (inflight.get(tabId) === fingerprint) return;
  inflight.set(tabId, fingerprint);
  tabs.set(tabId, { status: "checking", snapshot, fingerprint });
  await broadcast(definitionRaw);
  try {
    const report = await checkSnapshot(snapshot, definitionRaw, createLiveJev(settings.apiKey.trim()));
    const record: StoredRecord = {
      id: crypto.randomUUID(),
      tabId,
      snapshot,
      report,
      createdAt: new Date().toISOString(),
    };
    tabs.set(tabId, { status: "ready", record, fingerprint });
    const history = await readHistory();
    await writeHistory([record, ...history.filter((item) => item.id !== record.id)]);
  } catch (error) {
    tabs.set(tabId, { status: "error", message: errorMessage(error), snapshot, fingerprint });
  } finally {
    if (inflight.get(tabId) === fingerprint) inflight.delete(tabId);
  }
  await broadcast(definitionRaw);
}

function schedule(definitionRaw: unknown, tabId: number, debounceMs: number): void {
  debounceTabId = tabId;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (debounceTabId !== undefined) void checkTab(definitionRaw, debounceTabId, false);
  }, debounceMs);
}

export function startBackground(definitionRaw: unknown): void {
  parseDefinition(definitionRaw);
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.runtime.onInstalled.addListener(() => {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void (async () => {
      const settings = await readSettings();
      if (settings.followTab) schedule(definitionRaw, tabId, settings.debounceMs);
      else await broadcast(definitionRaw);
    })();
  });

  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== "complete") return;
    void (async () => {
      const settings = await readSettings();
      if (settings.followTab) schedule(definitionRaw, tabId, settings.debounceMs);
    })();
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabs.delete(tabId);
    inflight.delete(tabId);
  });

  chrome.runtime.onMessage.addListener((message: ClientMessage, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    void (async () => {
      try {
        if (message.type === "GET_SESSION") {
          sendResponse(await payload(definitionRaw, (await activeTabId()) ?? tabId));
          return;
        }
        if (message.type === "SAVE_SETTINGS") {
          const next = parseSettings(message.settings);
          const previous = await readSettings();
          await writeSettings({ ...DEFAULT_SETTINGS, ...previous, ...next, apiKey: next.apiKey, approver: next.approver });
          sendResponse(await payload(definitionRaw, await activeTabId()));
          await broadcast(definitionRaw);
          return;
        }
        if (message.type === "CHECK_NOW") {
          const id = (await activeTabId()) ?? tabId;
          if (id === undefined) throw new Error("検査するタブがありません。");
          await checkTab(definitionRaw, id, true);
          sendResponse(await payload(definitionRaw, id));
          return;
        }
        if (message.type === "OPEN_DETAILS") {
          const current = await payload(definitionRaw, await activeTabId());
          const id = message.id ?? (current.view.status === "ready" ? current.view.record.id : undefined);
          const url = chrome.runtime.getURL(`/details.html${id ? `?id=${encodeURIComponent(id)}` : ""}`);
          await chrome.tabs.create({ url });
          sendResponse({ ok: true });
          return;
        }
        if (message.type === "OPEN_OPTIONS") {
          await chrome.runtime.openOptionsPage();
          sendResponse({ ok: true });
          return;
        }
        if (message.type === "PAGE_CHANGED" && tabId !== undefined) {
          const settings = await readSettings();
          if (settings.followTab && settings.recheckOnChange) schedule(definitionRaw, tabId, settings.debounceMs);
          sendResponse({ ok: true });
          return;
        }
        sendResponse({ error: `unknown message ${message.type}` });
      } catch (error) {
        sendResponse({ error: errorMessage(error) });
      }
    })();
    return true;
  });
}
