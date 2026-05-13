import { prisma } from "@/lib/db";
import { WatchlistClient } from "@/components/WatchlistClient";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const items = await prisma.watchlistItem.findMany({
    include: { ticker: { include: { quotes: { orderBy: { asOf: "desc" }, take: 1 } } } },
    orderBy: { createdAt: "desc" },
  });
  const initial = items.map((i) => ({
    symbol: i.symbol,
    notes: i.notes,
    name: i.ticker.name,
    sector: i.ticker.sector,
    exchange: i.ticker.exchange,
    lastQuote: i.ticker.quotes[0]
      ? {
          price: i.ticker.quotes[0].price,
          changePct: i.ticker.quotes[0].changePct,
          marketCap: i.ticker.quotes[0].marketCap,
          asOf: i.ticker.quotes[0].asOf.toISOString(),
        }
      : null,
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Watchlist</h1>
          <p className="text-sm text-muted">Add tickers to research and monitor.</p>
        </div>
      </div>
      <WatchlistClient initial={initial} />
    </div>
  );
}
