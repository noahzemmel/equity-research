import { prisma } from "./db";
import { fetchQuote } from "@/data-sources/yahoo";

export type PortfolioStats = {
  startingCash: number;
  cash: number;
  positionsValue: number;
  equity: number;
  totalReturnPct: number;
  realizedPnL: number;
  unrealizedPnL: number;
  numTrades: number;
  numClosedTrades: number;
  numWins: number;
  winRate: number;
  avgGain: number;
  avgLoss: number;
  maxDrawdownPct: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    avgPrice: number;
    lastPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPct: number;
    source: string;
  }>;
};

export async function computePortfolio(refreshQuotes = true): Promise<PortfolioStats> {
  const account = await prisma.paperAccount.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      startingCash: Number(process.env.PAPER_STARTING_CASH ?? 100_000),
      cash: Number(process.env.PAPER_STARTING_CASH ?? 100_000),
      commissionBps: Number(process.env.PAPER_COMMISSION_BPS ?? 2),
      slippageBps: Number(process.env.PAPER_SLIPPAGE_BPS ?? 5),
    },
    update: {},
  });

  const positions = await prisma.paperPosition.findMany();
  const positionRows: PortfolioStats["positions"] = [];

  for (const p of positions) {
    let lastPrice = p.avgPrice;
    let source = "stale";
    if (refreshQuotes) {
      try {
        const q = await fetchQuote(p.symbol);
        lastPrice = q.price;
        source = q.source;
        await prisma.quoteSnapshot.create({
          data: {
            symbol: p.symbol,
            price: q.price,
            changePct: q.changePct,
            marketCap: q.marketCap,
            currency: q.currency,
            asOf: new Date(q.asOf),
            source: q.source,
          },
        });
      } catch {
        const cached = await prisma.quoteSnapshot.findFirst({
          where: { symbol: p.symbol },
          orderBy: { asOf: "desc" },
        });
        if (cached) {
          lastPrice = cached.price;
          source = `cached:${cached.source}`;
        }
      }
    } else {
      const cached = await prisma.quoteSnapshot.findFirst({
        where: { symbol: p.symbol },
        orderBy: { asOf: "desc" },
      });
      if (cached) {
        lastPrice = cached.price;
        source = `cached:${cached.source}`;
      }
    }
    const marketValue = lastPrice * p.quantity;
    const unrealizedPnL = (lastPrice - p.avgPrice) * p.quantity;
    const unrealizedPct = p.avgPrice > 0 ? ((lastPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
    positionRows.push({
      symbol: p.symbol,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      lastPrice,
      marketValue,
      unrealizedPnL,
      unrealizedPct,
      source,
    });
  }

  const positionsValue = positionRows.reduce((a, r) => a + r.marketValue, 0);
  const unrealizedPnL = positionRows.reduce((a, r) => a + r.unrealizedPnL, 0);
  const equity = account.cash + positionsValue;

  const trades = await prisma.paperTrade.findMany({ orderBy: { executedAt: "asc" } });
  const realizedPnL = trades.reduce((a, t) => a + t.realizedPnL, 0);
  const closed = trades.filter((t) => t.side === "sell");
  const wins = closed.filter((t) => t.realizedPnL > 0);
  const losses = closed.filter((t) => t.realizedPnL < 0);
  const avgGain = wins.length ? wins.reduce((a, t) => a + t.realizedPnL, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, t) => a + t.realizedPnL, 0) / losses.length : 0;
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;

  // Max drawdown on a simple equity curve (cash-after-each-trade + 0 positions baseline).
  // This understates intraday drawdown but is fine for paper analytics.
  let runningCash = account.startingCash;
  let peak = runningCash;
  let maxDD = 0;
  for (const t of trades) {
    const gross = t.price * t.quantity;
    if (t.side === "buy") runningCash -= gross + t.commission;
    else runningCash += gross - t.commission;
    if (runningCash > peak) peak = runningCash;
    const dd = peak > 0 ? ((peak - runningCash) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  }

  const totalReturnPct = ((equity - account.startingCash) / account.startingCash) * 100;

  return {
    startingCash: account.startingCash,
    cash: account.cash,
    positionsValue,
    equity,
    totalReturnPct,
    realizedPnL,
    unrealizedPnL,
    numTrades: trades.length,
    numClosedTrades: closed.length,
    numWins: wins.length,
    winRate,
    avgGain,
    avgLoss,
    maxDrawdownPct: maxDD,
    positions: positionRows,
  };
}
