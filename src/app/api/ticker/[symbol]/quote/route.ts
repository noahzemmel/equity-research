import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchQuote } from "@/data-sources/yahoo";

export async function GET(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  const latest = await prisma.quoteSnapshot.findFirst({
    where: { symbol },
    orderBy: { asOf: "desc" },
  });
  return NextResponse.json({ symbol, quote: latest });
}

export async function POST(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  try {
    const q = await fetchQuote(symbol);
    await prisma.ticker.upsert({
      where: { symbol },
      create: {
        symbol,
        name: q.name ?? null,
        exchange: q.exchange ?? null,
        sector: q.sector ?? null,
        industry: q.industry ?? null,
        currency: q.currency ?? null,
      },
      update: {
        name: q.name ?? undefined,
        exchange: q.exchange ?? undefined,
        sector: q.sector ?? undefined,
        industry: q.industry ?? undefined,
        currency: q.currency ?? undefined,
      },
    });
    const snap = await prisma.quoteSnapshot.create({
      data: {
        symbol,
        price: q.price,
        changePct: q.changePct,
        marketCap: q.marketCap,
        currency: q.currency,
        asOf: new Date(q.asOf),
        source: q.source,
      },
    });
    return NextResponse.json({ ok: true, quote: snap });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
