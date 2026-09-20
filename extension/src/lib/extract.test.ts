import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { collectOutbound, extractSnapshot, wordCount } from "./extract.js";

test("wordCount ignores surrounding space", () => {
  assert.equal(wordCount("  one two  three "), 3);
  assert.equal(wordCount("   "), 0);
});

test("collectOutbound keeps foreign http hosts and drops the page host", () => {
  const { hosts, citationCount } = collectOutbound(
    ["https://doi.example.org/10.1", "/local", "https://news.example.org/same", "mailto:x@y"],
    "news.example.org",
  );
  assert.deepEqual(hosts, ["doi.example.org"]);
  assert.equal(citationCount, 1);
});

test("extractSnapshot prefers article text, records author, and flags a short body", () => {
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><head>
      <title>Bridge delay</title>
      <meta name="author" content="Mina Ito" />
      <meta property="og:site_name" content="Example News" />
    </head><body>
      <nav>Home Sports</nav>
      <article>The bureau delayed the opening. <a href="https://transport.example.gov/memo">memo</a></article>
    </body></html>`,
    { url: "https://news.example.org/reports/bridge-delay" },
  );
  const snapshot = extractSnapshot(dom.window.document, dom.window.location, 1000, 40, () => "2026-09-20T00:00:00.000Z");
  assert.equal(snapshot.author, "Mina Ito");
  assert.equal(snapshot.siteName, "Example News");
  assert.equal(snapshot.hasAuthor, true);
  assert.equal(snapshot.hasBody, false);
  assert.equal(snapshot.isHttps, true);
  assert.match(snapshot.text, /bureau delayed/);
  assert.equal(snapshot.text.includes("Home Sports"), false);
  assert.deepEqual(snapshot.outboundHosts, ["transport.example.gov"]);
});
