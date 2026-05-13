import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { llmComplete, extractJson } from "@/lib/llm";
import { TradeIdeaSchema } from "@/lib/types";

const Body = z.object({ symbol: z.string().transform((s) => s.toUpperCase()) });

/**
 * Builds a trade idea draft from the most recent ResearchReport for the symbol.
 * The LLM is asked to choose direction + thesis + risk parameters; the offline
 * stub returns a deterministic skeleton so the UI is still usable.
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  const symbol = parsed.data.symbol;
  const report = await prisma.researchReport.findFirst({
    where: { symbol },
    orderBy: { asOf: "desc" },
  });
  if (!report) return NextResponse.json({ ok: false, error: "No report yet for " + symbol }, { status: 404 });
  const quote = await prisma.quoteSnapshot.findFirst({ where: { symbol }, orderBy: { asOf: "desc" } });
  const price = quote?.price ?? null;

  const prompt = `You are a portfolio manager translating a research report into a single concrete trade idea.

Report inputs (${symbol}, view=${report.finalView}, confidence=${report.confidence}):
- bullCase: ${report.bullCase}
- bearCase: ${report.bearCase}
- keyRisks: ${report.keyRisks}
- catalysts: ${report.catalysts}
- valuation: ${report.valuation}
- latestPrice: ${price ?? "unknown"}

Return strict JSON (no prose):
{
  "symbol": "${symbol}",
  "direction": "long" | "short",
  "thesis": "1-3 sentences summarising the trade rationale",
  "entry": number-or-null (suggested entry price near current),
  "stopLoss": number-or-null (typically 8-15% below entry for long),
  "target": number-or-null (12-month target if you have one),
  "maxPositionPct": number between 1 and 10 (smaller if confidence is low),
  "invalidation": "1-2 sentences on what would break the thesis",
  "downsideScenarios": "1-2 plausible downsides with magnitude",
  "liquidityWarning": "string, empty if not applicable"
}

Rules:
- If report.finalView is 'avoid' OR confidence < 0.3, pick direction='short' OR refuse by setting maxPositionPct=0 and explaining in the thesis.
- Never invent earnings or guidance dates.
- If latestPrice is "unknown", set entry/stopLoss/target to null.`;

  const res = await llmComplete(
    [
      { role: "system", content: "You produce paper-trading ideas as strict JSON. Be conservative on sizing." },
      { role: "user", content: prompt },
    ],
    { jsonMode: true, maxTokens: 800 },
  );
  let draft: any;
  try {
    draft = extractJson<any>(res.text);
  } catch {
    draft = {};
  }

  // Deterministic floor: if LLM was offline or refused, fall back to view-driven heuristic.
  const fallback = {
    symbol,
    direction: report.finalView === "avoid" ? "short" : "long",
    thesis:
      report.finalView === "high-conviction"
        ? `High-conviction long based on report dated ${report.asOf.toISOString().slice(0, 10)}.`
        : report.finalView === "watch"
          ? `Watchlist long, partial size only.`
          : `Avoid — bear setup. Manual review required before any action.`,
    entry: price,
    stopLoss: price ? price * 0.9 : null,
    target: price ? price * 1.2 : null,
    maxPositionPct: report.finalView === "high-conviction" ? 5 : report.finalView === "watch" ? 2 : 0,
    invalidation: `Thesis invalidated if: (a) ${report.keyRisks.split(/[•\n.]/)[0] || "core driver reverses"}; (b) close below stop-loss.`,
    downsideScenarios: report.bearCase.slice(0, 240) || "Earnings miss or de-rating.",
    liquidityWarning: "",
  };

  const merged = {
    symbol,
    direction: draft.direction === "short" || draft.direction === "long" ? draft.direction : fallback.direction,
    thesis: typeof draft.thesis === "string" && draft.thesis.length > 10 ? draft.thesis : fallback.thesis,
    entry: typeof draft.entry === "number" ? draft.entry : fallback.entry,
    stopLoss: typeof draft.stopLoss === "number" ? draft.stopLoss : fallback.stopLoss,
    target: typeof draft.target === "number" ? draft.target : fallback.target,
    maxPositionPct:
      typeof draft.maxPositionPct === "number" ? Math.max(0, Math.min(10, draft.maxPositionPct)) : fallback.maxPositionPct,
    invalidation: typeof draft.invalidation === "string" && draft.invalidation.length > 10 ? draft.invalidation : fallback.invalidation,
    downsideScenarios:
      typeof draft.downsideScenarios === "string" && draft.downsideScenarios.length > 10
        ? draft.downsideScenarios
        : fallback.downsideScenarios,
    liquidityWarning: typeof draft.liquidityWarning === "string" ? draft.liquidityWarning : fallback.liquidityWarning,
  };
  const ideaPayload = TradeIdeaSchema.parse(merged);

  const idea = await prisma.tradeIdea.create({
    data: { ...ideaPayload, reportId: report.id },
  });
  return NextResponse.json({ ok: true, idea });
}
