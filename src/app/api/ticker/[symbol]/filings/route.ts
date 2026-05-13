import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchFilings } from "@/data-sources/secEdgar";

export async function GET(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  const filings = await prisma.filing.findMany({
    where: { symbol },
    orderBy: { filedAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ symbol, filings });
}

export async function POST(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  await prisma.ticker.upsert({ where: { symbol }, create: { symbol }, update: {} });
  const items = await fetchFilings(symbol);
  let inserted = 0;
  for (const it of items) {
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
        update: {
          form: it.form,
          title: it.title ?? undefined,
          filedAt: it.filedAt ? new Date(it.filedAt) : undefined,
          accession: it.accession ?? undefined,
        },
      });
      inserted++;
    } catch {
      // skip
    }
  }
  return NextResponse.json({ ok: true, inserted, fetched: items.length });
}
