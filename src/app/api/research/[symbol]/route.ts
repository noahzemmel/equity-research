import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runResearchPipeline } from "@/agents/orchestrator";

export const maxDuration = 60;

export async function GET(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  const report = await prisma.researchReport.findFirst({
    where: { symbol },
    orderBy: { asOf: "desc" },
  });
  return NextResponse.json({ symbol, report });
}

export async function POST(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  try {
    const result = await runResearchPipeline(symbol);
    return NextResponse.json({ ok: true, reportId: result.reportId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
