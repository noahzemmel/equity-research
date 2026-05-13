import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const AddSchema = z.object({
  symbol: z.string().trim().min(1).max(10).transform((s) => s.toUpperCase()),
  name: z.string().trim().optional(),
  sector: z.string().trim().optional(),
  exchange: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function GET() {
  const items = await prisma.watchlistItem.findMany({
    include: {
      ticker: {
        include: {
          quotes: { orderBy: { asOf: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    items: items.map((i) => ({
      symbol: i.symbol,
      notes: i.notes,
      name: i.ticker.name,
      sector: i.ticker.sector,
      exchange: i.ticker.exchange,
      lastQuote: i.ticker.quotes[0] ?? null,
      updatedAt: i.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const parsed = AddSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { symbol, name, sector, exchange, notes } = parsed.data;

  await prisma.ticker.upsert({
    where: { symbol },
    create: { symbol, name, sector, exchange },
    update: {
      name: name ?? undefined,
      sector: sector ?? undefined,
      exchange: exchange ?? undefined,
    },
  });
  const item = await prisma.watchlistItem.upsert({
    where: { symbol },
    create: { symbol, notes },
    update: { notes: notes ?? undefined },
  });
  return NextResponse.json({ ok: true, item });
}
