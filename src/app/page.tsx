import Link from "next/link";
import { prisma } from "@/lib/db";

async function getCounts() {
  try {
    const [watchlist, reports, ideas, trades] = await Promise.all([
      prisma.watchlistItem.count(),
      prisma.researchReport.count(),
      prisma.tradeIdea.count({ where: { status: "open" } }),
      prisma.paperTrade.count(),
    ]);
    return { watchlist, reports, ideas, trades };
  } catch {
    return { watchlist: 0, reports: 0, ideas: 0, trades: 0 };
  }
}

export default async function Dashboard() {
  const counts = await getCounts();
  const cards = [
    { label: "Watchlist tickers", value: counts.watchlist, href: "/watchlist" },
    { label: "Research reports", value: counts.reports, href: "/watchlist" },
    { label: "Open trade ideas", value: counts.ideas, href: "/ideas" },
    { label: "Paper trades", value: counts.trades, href: "/portfolio" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equity Research Co-Pilot</h1>
        <p className="text-muted text-sm mt-1">
          Local-first research, news monitoring, and paper-trading. No live trading. No leverage.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card hover:border-accent transition">
            <div className="card-title">{c.label}</div>
            <div className="text-3xl font-semibold">{c.value}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card">
          <div className="card-title">Getting started</div>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Add a ticker on the <Link className="text-accent" href="/watchlist">Watchlist</Link>.</li>
            <li>Open the ticker page to pull a live quote, filings and news.</li>
            <li>Run an AI research report — review the bull, bear and risks before any action.</li>
            <li>Promote any thesis to a Trade Idea, then optionally paper-trade it.</li>
          </ol>
        </div>
        <div className="card">
          <div className="card-title">Safety posture</div>
          <ul className="text-sm space-y-1 list-disc list-inside text-muted">
            <li>No broker integration. Paper trading only.</li>
            <li>No leverage, options, CFDs, or crypto in v1.</li>
            <li>Every agent decision is logged with sources for audit.</li>
            <li>Every trade idea ships with stop-loss + invalidation + liquidity check.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
