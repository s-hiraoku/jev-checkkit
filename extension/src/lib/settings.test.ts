import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SETTINGS, parseSettings, setupGap } from "./settings.js";

test("parseSettings fills defaults and clamps ranges", () => {
  const parsed = parseSettings({ debounceMs: 10, maxChars: 999999, followTab: false });
  assert.equal(parsed.debounceMs, 250);
  assert.equal(parsed.maxChars, 20000);
  assert.equal(parsed.followTab, false);
  assert.equal(parsed.recheckOnChange, true);
  assert.equal(parsed.apiKey, "");
});

test("setupGap asks for the whole-list approval before it asks for a key", () => {
  assert.equal(setupGap(DEFAULT_SETTINGS, 1), "approval");
  assert.equal(setupGap({ ...DEFAULT_SETTINGS, approver: "ada", ackedVersion: 1 }, 1), "api-key");
  assert.equal(setupGap({ ...DEFAULT_SETTINGS, approver: "ada", ackedVersion: 0, apiKey: "sk" }, 1), "approval");
  assert.equal(setupGap({ ...DEFAULT_SETTINGS, approver: "ada", ackedVersion: 1, apiKey: "sk" }, 1), null);
});
