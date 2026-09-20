import { extractSnapshot } from "../lib/extract.js";
import { snapshotFingerprint } from "../lib/page-state.js";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    let lastFingerprint = "";
    let timer: ReturnType<typeof setTimeout> | undefined;

    const snapshotNow = (maxChars: number, minWords: number) =>
      extractSnapshot(document, location, maxChars, minWords);

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "EXTRACT") return;
      try {
        const snapshot = snapshotNow(message.maxChars, message.minWords);
        lastFingerprint = snapshotFingerprint(snapshot);
        sendResponse(snapshot);
      } catch (error) {
        sendResponse({ error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    });

    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const snapshot = snapshotNow(10000, 40);
        const fingerprint = snapshotFingerprint(snapshot);
        if (fingerprint === lastFingerprint) return;
        lastFingerprint = fingerprint;
        void chrome.runtime.sendMessage({ type: "PAGE_CHANGED", fingerprint });
      }, 1200);
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  },
});
