import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchQuote, fetchProfile } from "@/data-sources/yahoo";
import { fetchNews } from "@/data-sources/rssNews";
import { fetchFilings } from "@/data-sources/secEdgar";

export async function POST(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  const started = Date.now();

  // Run all three sources in parallel; tolerate partial failure.
  const [quoteR, profileR, newsR, filingsR] = await Promise.allSettled([
    fetchQuote(symbol),
    fetchProfile(symbol),
    fetchNews(symbol),
    fetchFilings(symbol),
  ]);

  const quote = quoteR.status === "fulfilled" ? quoteR.value : null;
  const profile = profileR.status === "fulfilled" ? profileR.value : null;
  const news = newsR.status === "fulfilled" ? newsR.value : [];
  const filings = filingsR.status === "fulfilled" ? filingsR.value : [];

  await prisma.ticker.upsert({
    where: { symbol },
    create: {
      symbol,
      name: quote?.name ?? null,
      exchange: quote?.exchange ?? null,
      sector: profile?.sector ?? quote?.sector ?? null,
      industry: profile?.industry ?? null,
      currency: quote?.currency ?? null,
    },
    update: {
      name: quote?.name ?? undefined,
      exchange: quote?.exchange ?? undefined,
      sector: profile?.sector ?? undefined,
      industry: profile?.industry ?? undefined,
      currency: quote?.currency ?? undefined,
    },
  });

  if (quote) {
    await prisma.quoteSnapshot.create({
      data: {
        symbol,
        price: quote.price,
        changePct: quote.changePct,
        marketCap: quote.marketCap,
        currency: quote.currency,
        asOf: new Date(quote.asOf),
        source: quote.source,
      },
    });
  }

  for (const it of news) {
    try {
      await prisma.newsItem.upsert({
        where: { symbol_url: { symbol, url: it.url } },
        create: {
          symbol,
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

  for (const it of filings) {
    try {
      await prisma.filing.upsert({
        where: { symbol_url: { symbol, url: it.url } },
        create: {
          symbol,
          form: it.form,
          title: it.title ?? null,
          filedAt: it.filedAt ? new Date(it.filedAt) : null,
          accession: it.accession ?? null,
          url: it.url,
          summary: it.summary ?? null,
        },
        update: {},
      });
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - started,
    counts: { news: news.length, filings: filings.length, quote: quote ? 1 : 0 },
    sources: {
      quote: quote?.source ?? null,
      profile: profile?.longBusinessSummary ? "yahoo" : null,
      news: news.length > 0 ? "rss" : null,
      filings: filings.length > 0 ? "sec-edgar" : null,
    },
  });
}
