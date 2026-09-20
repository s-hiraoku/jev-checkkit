import type { ExtensionSettings } from "./settings.js";
import type { SessionPayload, StoredRecord } from "./session.js";

export interface Bridge {
  getSession(): Promise<SessionPayload>;
  saveSettings(settings: ExtensionSettings): Promise<SessionPayload>;
  checkNow(): Promise<SessionPayload>;
  openDetails(id?: string): Promise<void>;
  openOptions(): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

export function liveBridge(): Bridge {
  const send = async <T>(message: object): Promise<T> => {
    const reply = (await chrome.runtime.sendMessage(message)) as T | { error?: string };
    if (reply && typeof reply === "object" && "error" in reply && reply.error) throw new Error(reply.error);
    return reply as T;
  };
  return {
    getSession: () => send<SessionPayload>({ type: "GET_SESSION" }),
    saveSettings: (settings) => send<SessionPayload>({ type: "SAVE_SETTINGS", settings }),
    checkNow: () => send<SessionPayload>({ type: "CHECK_NOW" }),
    openDetails: async (id) => {
      await send({ type: "OPEN_DETAILS", id });
    },
    openOptions: async () => {
      await send({ type: "OPEN_OPTIONS" });
    },
    subscribe: (onChange) => {
      const listener = (message: { type?: string }) => {
        if (message.type === "SESSION_UPDATED") onChange();
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    },
  };
}

export function recordById(history: readonly StoredRecord[], id: string | null): StoredRecord | undefined {
  if (id === null) return history[0];
  return history.find((record) => record.id === id) ?? history[0];
}
