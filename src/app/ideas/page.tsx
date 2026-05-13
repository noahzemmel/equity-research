import { prisma } from "@/lib/db";
import { IdeasClient } from "@/components/IdeasClient";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const ideas = await prisma.tradeIdea.findMany({
    orderBy: { createdAt: "desc" },
    include: { ticker: { include: { quotes: { orderBy: { asOf: "desc" }, take: 1 } } } },
  });
  const rows = ideas.map((i) => ({
    id: i.id,
    symbol: i.symbol,
    name: i.ticker.name,
    sector: i.ticker.sector,
    direction: i.direction,
    thesis: i.thesis,
    entry: i.entry,
    stopLoss: i.stopLoss,
    target: i.target,
    maxPositionPct: i.maxPositionPct,
    invalidation: i.invalidation,
    downsideScenarios: i.downsideScenarios,
    liquidityWarning: i.liquidityWarning,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    lastPrice: i.ticker.quotes[0]?.price ?? null,
  }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Trade ideas</h1>
        <p className="text-sm text-muted">Risk-controlled, human-reviewed. Promoting an idea executes a paper trade only.</p>
      </div>
      <div className="card text-xs leading-relaxed border-warn/40 bg-warn/5 text-ink">
        <strong className="text-warn">Reminder.</strong> Every idea must show position sizing, stop-loss, invalidation conditions,
        downside scenarios, and a liquidity check. Promotion only fills a paper trade — no real broker is ever called. This is not
        financial advice.
      </div>
      <IdeasClient initial={rows} />
    </div>
  );
}
