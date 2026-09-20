import type { Check, CheckReport } from "./checkkit.js";
import type { PageSnapshot } from "./page-state.js";

export interface StoredRecord {
  id: string;
  tabId: number;
  snapshot: PageSnapshot;
  report: CheckReport;
  createdAt: string;
}

export type SessionView =
  | { status: "needs-setup"; reason: "api-key" | "approval"; definitionVersion: number }
  | { status: "unsupported"; url: string }
  | { status: "idle"; followTab: boolean }
  | { status: "checking"; snapshot: PageSnapshot }
  | { status: "ready"; record: StoredRecord }
  | { status: "error"; message: string; snapshot?: PageSnapshot };

export interface SessionPayload {
  view: SessionView;
  questions: Check[];
  history: StoredRecord[];
  settings: import("./settings.js").ExtensionSettings;
  definitionVersion: number;
}

export type ClientMessage =
  | { type: "GET_SESSION" }
  | { type: "CHECK_NOW" }
  | { type: "SAVE_SETTINGS"; settings: unknown }
  | { type: "OPEN_DETAILS"; id?: string }
  | { type: "OPEN_OPTIONS" }
  | { type: "EXTRACT"; maxChars: number; minWords: number }
  | { type: "PAGE_CHANGED"; fingerprint: string };

export type ServerMessage = { type: "SESSION_UPDATED" };
