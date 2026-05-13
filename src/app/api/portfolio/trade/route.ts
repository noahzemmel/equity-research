import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaperTradingAgent } from "@/agents/PaperTradingAgent";

const Body = z.object({
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
  ideaId: z.string().optional(),
  notes: z.string().optional(),
  confirm: z.literal(true, {
    errorMap: () => ({ message: "Trade must include confirm:true to proceed (paper-trade safety gate)." }),
  }),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { confirm, ...trade } = parsed.data;
  const res = await PaperTradingAgent(trade, { symbol: trade.symbol });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, trade: res.data });
}
