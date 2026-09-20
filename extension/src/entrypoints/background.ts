import definitionRaw from "../../../fixtures/page-credibility.checker.json" with { type: "json" };
import { startBackground } from "../lib/background-runtime.js";

export default defineBackground(() => {
  startBackground(definitionRaw);
});
