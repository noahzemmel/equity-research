import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PaperTradingAgent } from "@/agents/PaperTradingAgent";
import { computePortfolio } from "@/lib/portfolio";
import { fetchQuote } from "@/data-sources/yahoo";

const Body = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: "Set confirm:true to promote this idea to a paper trade." }),
  }),
  overrideQuantity: z.number().positive().optional(),
});

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const idea = await prisma.tradeIdea.findUnique({ where: { id: ctx.params.id } });
  if (!idea) return NextResponse.json({ ok: false, error: "Idea not found" }, { status: 404 });
  if (idea.direction !== "long") {
    return NextResponse.json(
      { ok: false, error: "Short ideas cannot be executed in v1 (no shorting in paper trading)." },
      { status: 400 },
    );
  }
  if (idea.status !== "open") {
    return NextResponse.json({ ok: false, error: `Idea status is '${idea.status}', not open.` }, { status: 400 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const stats = await computePortfolio(false);
  let quantity = parsed.data.overrideQuantity ?? 0;
  if (!quantity) {
    const quote = await fetchQuote(idea.symbol);
    const maxNotional = (idea.maxPositionPct / 100) * stats.equity;
    quantity = Math.max(1, Math.floor(maxNotional / quote.price));
  }

  const res = await PaperTradingAgent(
    {
      symbol: idea.symbol,
      side: "buy",
      quantity,
      ideaId: idea.id,
      notes: `Promoted from idea: ${idea.thesis.slice(0, 80)}`,
    },
    { symbol: idea.symbol },
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  await prisma.tradeIdea.update({ where: { id: idea.id }, data: { status: "acted" } });
  return NextResponse.json({ ok: true, trade: res.data });
}
