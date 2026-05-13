import { XMLParser } from "fast-xml-parser";
import type { News } from "@/lib/types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function yahooRss(symbol: string) {
  return `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
}
function googleRss(symbol: string) {
  // Google News RSS keyed on the symbol — broad, not always relevant, but free
  return `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + " stock")}&hl=en-US&gl=US&ceid=US:en`;
}

async function fetchText(url: string, timeoutMs = 7000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function parseRss(xml: string, fallbackSource: string): News[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  const arr = Array.isArray(items) ? items : [items];
  return arr
    .map((i: any): News | null => {
      const title = i?.title?.["#text"] ?? i?.title ?? null;
      const link = typeof i?.link === "string" ? i.link : (i?.link?.href ?? i?.link?.["#text"] ?? null);
      const pub = i?.pubDate ?? i?.published ?? i?.updated ?? null;
      const src = i?.source?.["#text"] ?? i?.source ?? fallbackSource;
      if (!title || !link) return null;
      return {
        title: String(title).slice(0, 300),
        url: String(link),
        source: src ? String(src) : fallbackSource,
        publishedAt: pub ? new Date(pub).toISOString() : null,
        summary: i?.description ? String(i.description).replace(/<[^>]+>/g, "").slice(0, 500) : null,
      };
    })
    .filter((x): x is News => !!x);
}

export async function fetchNews(symbol: string, limit = 20): Promise<News[]> {
  const seen = new Map<string, News>();
  for (const [url, source] of [
    [yahooRss(symbol), "Yahoo Finance"],
    [googleRss(symbol), "Google News"],
  ] as const) {
    try {
      const xml = await fetchText(url);
      const items = parseRss(xml, source);
      for (const it of items) {
        if (!seen.has(it.url)) seen.set(it.url, it);
      }
    } catch {
      // try the next source
    }
  }
  return Array.from(seen.values())
    .sort((a, b) => (new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()))
    .slice(0, limit);
}
