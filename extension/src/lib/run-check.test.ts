import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { replayGateway } from "./checkkit.js";
import { checkSnapshot } from "./run-check.js";
import type { PageSnapshot } from "./page-state.js";

const definition = JSON.parse(readFileSync(new URL("../../../fixtures/page-credibility.checker.json", import.meta.url), "utf8"));
const replay = JSON.parse(readFileSync(new URL("../../../fixtures/replay/page-credibility-pass.json", import.meta.url), "utf8")) as {
  state: PageSnapshot;
  answers: Parameters<typeof replayGateway>[0];
  usage: Parameters<typeof replayGateway>[1];
};

test("checkSnapshot maps a page snapshot onto the approved definition", async () => {
  const snapshot: PageSnapshot = { ...replay.state, extractedAt: "2026-09-20T00:00:00.000Z" };
  const report = await checkSnapshot(snapshot, definition, replayGateway(replay.answers, replay.usage));
  assert.equal(report.definition.id, "page-credibility");
  assert.equal(report.items.every((item) => item.verdict === "pass"), true);
});
