import { prisma } from "@/lib/db";
import { computePortfolio } from "@/lib/portfolio";
import { PortfolioClient } from "@/components/PortfolioClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const stats = await computePortfolio(false);
  const trades = await prisma.paperTrade.findMany({
    orderBy: { executedAt: "desc" },
    take: 50,
  });
  const tradeRows = trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    commission: t.commission,
    realizedPnL: t.realizedPnL,
    executedAt: t.executedAt.toISOString(),
    notes: t.notes,
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Paper portfolio</h1>
          <p className="text-sm text-muted">
            Simulated only — no broker integration.{" "}
            <Link href="/watchlist" className="text-accent">Watchlist</Link> ·{" "}
            <Link href="/ideas" className="text-accent">Trade ideas</Link>
          </p>
        </div>
      </div>
      <PortfolioClient initialStats={stats} initialTrades={tradeRows} />
    </div>
  );
}
