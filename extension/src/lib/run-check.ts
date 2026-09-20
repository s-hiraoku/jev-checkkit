import { TypeSafeClient } from "@typesafe-ai/sdk";
import { evaluate, liveGateway, parseDefinition, type CheckReport, type JevGateway } from "./checkkit.js";
import { snapshotToState, type PageSnapshot } from "./page-state.js";

export function loadDefinition(raw: unknown) {
  return parseDefinition(raw);
}

export function createLiveJev(apiKey: string): JevGateway {
  return liveGateway(
    () =>
      new TypeSafeClient({
        apiKey,
        logLevel: "off",
        dangerouslyAllowBrowser: true,
        timeout: 30_000,
      }),
  );
}

export async function checkSnapshot(snapshot: PageSnapshot, definitionRaw: unknown, jev: JevGateway): Promise<CheckReport> {
  return evaluate(loadDefinition(definitionRaw), snapshotToState(snapshot), jev);
}
