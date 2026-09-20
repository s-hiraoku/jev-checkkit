import type { PageSnapshot } from "./page-state.js";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "NAV", "FOOTER", "ASIDE", "SVG", "IFRAME", "CANVAS"]);

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export function collectOutbound(hrefs: readonly string[], pageHost: string): { hosts: string[]; citationCount: number } {
  const hosts = new Set<string>();
  for (const href of hrefs) {
    try {
      const url = new URL(href);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (url.hostname === pageHost || url.hostname.endsWith(`.${pageHost}`)) continue;
      hosts.add(url.hostname);
    } catch {
      continue;
    }
  }
  return { hosts: [...hosts].sort(), citationCount: hosts.size };
}

export function metaContent(doc: ParentNode, names: readonly string[]): string {
  for (const name of names) {
    const element = doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    const value = element?.getAttribute("content")?.trim();
    if (value) return value;
  }
  return "";
}

export function collectText(root: ParentNode, maxChars: number): string {
  const parts: string[] = [];
  let used = 0;
  const walk = (node: Node): void => {
    if (used >= maxChars) return;
    if (node.nodeType === 3) {
      const text = node.textContent?.replace(/\s+/g, " ").trim();
      if (!text) return;
      parts.push(text);
      used += text.length + 1;
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (SKIP_TAGS.has(element.tagName)) return;
    if (element.getAttribute("aria-hidden") === "true") return;
    for (const child of element.childNodes) walk(child);
  };
  walk(root as unknown as Node);
  return parts.join(" ").slice(0, maxChars);
}

export function extractSnapshot(
  doc: Document,
  loc: Pick<Location, "href" | "hostname" | "protocol">,
  maxChars: number,
  minWords: number,
  now = (): string => new Date().toISOString(),
): PageSnapshot {
  const author = metaContent(doc, ["author", "article:author", "byl", "citation_author"]);
  const publishedAt = metaContent(doc, ["article:published_time", "date", "pubdate", "dc.date"]);
  const siteName = metaContent(doc, ["og:site_name", "application-name"]);
  const metaDescription = metaContent(doc, ["description", "og:description"]);
  const root = doc.querySelector("article, [role=main], main") ?? doc.body;
  const hrefs = [...(root ?? doc).querySelectorAll("a[href]")].map((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    try {
      return new URL(href, loc.href).href;
    } catch {
      return "";
    }
  });
  const { hosts, citationCount } = collectOutbound(hrefs, loc.hostname);
  const text = collectText(root ?? doc.body, maxChars);
  const words = wordCount(text);
  return {
    url: loc.href,
    hostname: loc.hostname,
    protocol: loc.protocol,
    title: (doc.title ?? "").trim(),
    metaDescription,
    author,
    publishedAt,
    siteName,
    language: doc.documentElement.getAttribute("lang") ?? "",
    isHttps: loc.protocol === "https:",
    hasAuthor: author.length > 0,
    hasPublishedAt: publishedAt.length > 0,
    hasBody: words >= minWords,
    wordCount: words,
    citationCount,
    outboundHosts: hosts,
    text,
    extractedAt: now(),
  };
}
