import { prisma } from "@/lib/db";
import { fetchQuote } from "@/data-sources/yahoo";
import { fetchNews } from "@/data-sources/rssNews";
import { fetchFilings } from "@/data-sources/secEdgar";

export type RefreshResult = {
  symbol: string;
  quote: { source: string } | null;
  news: number;
  filings: number;
  error?: string;
};

export async function refreshSymbol(
  symbol: string,
  opts: { news?: boolean; filings?: boolean } = {},
): Promise<RefreshResult> {
  const sym = symbol.toUpperCase();
  const out: RefreshResult = { symbol: sym, quote: null, news: 0, filings: 0 };
  try {
    const quote = await fetchQuote(sym);
    await prisma.ticker.upsert({
      where: { symbol: sym },
      create: { symbol: sym, name: quote.name ?? null, exchange: quote.exchange ?? null, currency: quote.currency ?? null },
      update: { name: quote.name ?? undefined, exchange: quote.exchange ?? undefined, currency: quote.currency ?? undefined },
    });
    await prisma.quoteSnapshot.create({
      data: {
        symbol: sym,
        price: quote.price,
        changePct: quote.changePct,
        marketCap: quote.marketCap,
        currency: quote.currency,
        asOf: new Date(quote.asOf),
        source: quote.source,
      },
    });
    out.quote = { source: quote.source };
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }

  if (opts.news !== false) {
    try {
      const items = await fetchNews(sym, 15);
      for (const it of items) {
        try {
          await prisma.newsItem.upsert({
            where: { symbol_url: { symbol: sym, url: it.url } },
            create: {
              symbol: sym,
              title: it.title,
              url: it.url,
              source: it.source ?? null,
              publishedAt: it.publishedAt ? new Date(it.publishedAt) : null,
              summary: it.summary ?? null,
            },
            update: {},
          });
        } catch {}
      }
      out.news = items.length;
    } catch {}
  }
  if (opts.filings !== false) {
    try {
      const items = await fetchFilings(sym, 10);
      for (const it of items) {
        try {
          await prisma.filing.upsert({
            where: { symbol_url: { symbol: sym, url: it.url } },
            create: {
              symbol: sym,
              form: it.form,
              title: it.title ?? null,
              filedAt: it.filedAt ? new Date(it.filedAt) : null,
              accession: it.accession ?? null,
              url: it.url,
            },
            update: {},
          });
        } catch {}
      }
      out.filings = items.length;
    } catch {}
  }
  return out;
}

export async function refreshWatchlist(opts: { news?: boolean; filings?: boolean } = {}) {
  const items = await prisma.watchlistItem.findMany({ select: { symbol: true } });
  const results: RefreshResult[] = [];
  // Sequential to be gentle on rate-limits.
  for (const w of items) {
    const r = await refreshSymbol(w.symbol, opts);
    results.push(r);
    // small jitter to avoid bursts
    await new Promise((r) => setTimeout(r, 250));
  }
  return results;
}
