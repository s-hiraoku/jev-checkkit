export interface ExtensionSettings {
  apiKey: string;
  approver: string;
  ackedVersion: number | null;
  followTab: boolean;
  recheckOnChange: boolean;
  debounceMs: number;
  maxChars: number;
  minWords: number;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiKey: "",
  approver: "",
  ackedVersion: null,
  followTab: true,
  recheckOnChange: true,
  debounceMs: 1500,
  maxChars: 10000,
  minWords: 40,
};

function finiteInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function parseSettings(raw: unknown): ExtensionSettings {
  const record = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    apiKey: typeof record.apiKey === "string" ? record.apiKey : "",
    approver: typeof record.approver === "string" ? record.approver : "",
    ackedVersion: typeof record.ackedVersion === "number" && Number.isInteger(record.ackedVersion) ? record.ackedVersion : null,
    followTab: record.followTab !== false,
    recheckOnChange: record.recheckOnChange !== false,
    debounceMs: finiteInt(record.debounceMs, DEFAULT_SETTINGS.debounceMs, 250, 15000),
    maxChars: finiteInt(record.maxChars, DEFAULT_SETTINGS.maxChars, 500, 20000),
    minWords: finiteInt(record.minWords, DEFAULT_SETTINGS.minWords, 10, 400),
  };
}

export function setupGap(settings: ExtensionSettings, definitionVersion: number): "api-key" | "approval" | null {
  if (settings.approver.trim() === "" || settings.ackedVersion !== definitionVersion) return "approval";
  if (settings.apiKey.trim() === "") return "api-key";
  return null;
}
