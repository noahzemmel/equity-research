import type { Quote } from "@/lib/types";

const QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const PROFILE_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function jsonFetch(url: string, timeoutMs = 6000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json,text/plain,*/*" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  const sym = symbol.toUpperCase();
  try {
    const data = await jsonFetch(`${QUOTE_URL}?symbols=${encodeURIComponent(sym)}`);
    const r = data?.quoteResponse?.result?.[0];
    if (!r) throw new Error("No result");
    return {
      symbol: sym,
      price: Number(r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice),
      changePct: Number(r.regularMarketChangePercent ?? null),
      marketCap: r.marketCap != null ? Number(r.marketCap) : null,
      currency: r.currency ?? null,
      asOf: new Date((r.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      source: "yahoo",
      name: r.longName ?? r.shortName ?? null,
      exchange: r.fullExchangeName ?? r.exchange ?? null,
      sector: null,
      industry: null,
    };
  } catch (e) {
    // Fallback: deterministic mock so the UI is still usable offline / when Yahoo is rate-limiting.
    const hash = [...sym].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100003, 7);
    const price = 50 + (hash % 450);
    const changePct = ((hash % 600) - 300) / 100;
    return {
      symbol: sym,
      price,
      changePct,
      marketCap: price * 1e9,
      currency: "USD",
      asOf: new Date().toISOString(),
      source: "mock",
      name: `${sym} Inc.`,
      exchange: "MOCK",
      sector: null,
      industry: null,
    };
  }
}

export async function fetchProfile(symbol: string): Promise<{
  sector: string | null;
  industry: string | null;
  longBusinessSummary: string | null;
}> {
  const sym = symbol.toUpperCase();
  try {
    const url = `${PROFILE_URL}/${encodeURIComponent(sym)}?modules=assetProfile,summaryProfile`;
    const data = await jsonFetch(url);
    const p =
      data?.quoteSummary?.result?.[0]?.assetProfile ??
      data?.quoteSummary?.result?.[0]?.summaryProfile ??
      {};
    return {
      sector: p.sector ?? null,
      industry: p.industry ?? null,
      longBusinessSummary: p.longBusinessSummary ?? null,
    };
  } catch {
    return { sector: null, industry: null, longBusinessSummary: null };
  }
}
