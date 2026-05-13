import type { FilingItem } from "@/lib/types";

const UA = process.env.SEC_USER_AGENT || "ai-equity-research-agent (no-contact@example.com)";

const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const SUBMISSIONS_URL = (cik10: string) => `https://data.sec.gov/submissions/CIK${cik10}.json`;

let TICKER_CACHE: Record<string, string> | null = null;
let TICKER_CACHE_AT = 0;

async function fetchJSON(url: string, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`SEC ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function loadTickerMap(): Promise<Record<string, string>> {
  if (TICKER_CACHE && Date.now() - TICKER_CACHE_AT < 24 * 60 * 60 * 1000) return TICKER_CACHE;
  const data = await fetchJSON(TICKER_MAP_URL, 10000);
  const map: Record<string, string> = {};
  for (const k of Object.keys(data)) {
    const row = data[k];
    if (row?.ticker && row?.cik_str != null) {
      map[String(row.ticker).toUpperCase()] = String(row.cik_str).padStart(10, "0");
    }
  }
  TICKER_CACHE = map;
  TICKER_CACHE_AT = Date.now();
  return map;
}

export async function fetchFilings(symbol: string, limit = 15): Promise<FilingItem[]> {
  const sym = symbol.toUpperCase();
  try {
    const map = await loadTickerMap();
    const cik = map[sym];
    if (!cik) return [];
    const sub = await fetchJSON(SUBMISSIONS_URL(cik));
    const recent = sub?.filings?.recent;
    if (!recent) return [];
    const out: FilingItem[] = [];
    const len = Math.min(recent.accessionNumber?.length ?? 0, limit);
    for (let i = 0; i < len; i++) {
      const accession: string = recent.accessionNumber[i];
      const form: string = recent.form[i] ?? "";
      const filedAt: string = recent.filingDate[i];
      const primary: string = recent.primaryDocument[i] ?? "";
      const accNoDashes = accession.replace(/-/g, "");
      const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accNoDashes}/${primary}`;
      out.push({
        form,
        title: recent.primaryDocDescription?.[i] ?? form,
        filedAt: filedAt ? new Date(filedAt).toISOString() : null,
        accession,
        url,
        summary: null,
      });
    }
    return out;
  } catch (e) {
    // Soft-fail with empty list; caller will surface this.
    return [];
  }
}
