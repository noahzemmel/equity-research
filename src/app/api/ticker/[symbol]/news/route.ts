import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchNews } from "@/data-sources/rssNews";

export async function GET(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  const news = await prisma.newsItem.findMany({
    where: { symbol },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ symbol, news });
}

export async function POST(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  // make sure ticker row exists
  await prisma.ticker.upsert({ where: { symbol }, create: { symbol }, update: {} });
  const items = await fetchNews(symbol);
  let inserted = 0;
  for (const it of items) {
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
        update: {
          title: it.title,
          summary: it.summary ?? undefined,
          publishedAt: it.publishedAt ? new Date(it.publishedAt) : undefined,
        },
      });
      inserted++;
    } catch {
      // skip
    }
  }
  return NextResponse.json({ ok: true, inserted, fetched: items.length });
}
