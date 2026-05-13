import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Create = z.object({
  symbol: z.string().transform((s) => s.toUpperCase()),
  direction: z.enum(["long", "short"]).default("long"),
  thesis: z.string().min(5),
  entry: z.number().nullable().optional(),
  stopLoss: z.number().nullable().optional(),
  target: z.number().nullable().optional(),
  maxPositionPct: z.number().min(0).max(100).default(5),
  invalidation: z.string().min(5),
  downsideScenarios: z.string().min(5),
  liquidityWarning: z.string().optional().default(""),
  reportId: z.string().optional(),
});

export async function GET() {
  const ideas = await prisma.tradeIdea.findMany({
    orderBy: { createdAt: "desc" },
    include: { ticker: { include: { quotes: { orderBy: { asOf: "desc" }, take: 1 } } } },
  });
  return NextResponse.json({
    ideas: ideas.map((i) => ({
      ...i,
      lastQuote: i.ticker.quotes[0]
        ? { price: i.ticker.quotes[0].price, changePct: i.ticker.quotes[0].changePct, asOf: i.ticker.quotes[0].asOf.toISOString() }
        : null,
      name: i.ticker.name,
      sector: i.ticker.sector,
    })),
  });
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const parsed = Create.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  // Short ideas are written down for tracking but cannot be executed in paper trading (no shorting in v1).
  await prisma.ticker.upsert({ where: { symbol: parsed.data.symbol }, create: { symbol: parsed.data.symbol }, update: {} });
  const idea = await prisma.tradeIdea.create({ data: parsed.data });
  return NextResponse.json({ ok: true, idea });
}
