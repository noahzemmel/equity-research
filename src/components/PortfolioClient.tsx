"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney, fmtPct, fmtPrice } from "@/lib/format";
import type { PortfolioStats } from "@/lib/portfolio";

type TradeRow = {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  commission: number;
  realizedPnL: number;
  executedAt: string;
  notes: string | null;
};

export function PortfolioClient({
  initialStats,
  initialTrades,
}: {
  initialStats: PortfolioStats;
  initialTrades: TradeRow[];
}) {
  const router = useRouter();
  const [stats, setStats] = useState<PortfolioStats>(initialStats);
  const [trades, setTrades] = useState<TradeRow[]>(initialTrades);
  const [refreshing, setRefreshing] = useState(false);
  const [tradeForm, setTradeForm] = useState({ symbol: "", side: "buy" as "buy" | "sell", quantity: "1" });
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeOk, setTradeOk] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/portfolio?refresh=1");
      const json = await res.json();
      setStats(json.stats);
      setTrades(json.trades);
    } finally {
      setRefreshing(false);
    }
  }

  async function executeTrade() {
    setTradeError(null);
    setTradeOk(null);
    const qty = Number(tradeForm.quantity);
    if (!tradeForm.symbol || !(qty > 0)) {
      setTradeError("Enter a symbol and a positive quantity.");
      return;
    }
    const res = await fetch("/api/portfolio/trade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol: tradeForm.symbol.toUpperCase(),
        side: tradeForm.side,
        quantity: qty,
        confirm: true,
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      setTradeError(typeof json.error === "string" ? json.error : "Trade failed.");
      return;
    }
    setTradeOk(
      `Filled ${json.trade.side} ${json.trade.quantity} ${json.trade.symbol} @ $${json.trade.fillPrice.toFixed(2)} · commission $${json.trade.commission.toFixed(2)}`,
    );
    setTradeForm({ ...tradeForm, quantity: "1" });
    setShowConfirm(false);
    await refresh();
    router.refresh();
  }

  async function resetAccount() {
    if (!confirm("Reset paper account, wipe all positions and trades? This cannot be undone.")) return;
    const res = await fetch("/api/portfolio/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "RESET" }),
    });
    if (!res.ok) {
      alert("Reset failed.");
      return;
    }
    await refresh();
    router.refresh();
  }

  const totalPnL = stats.realizedPnL + stats.unrealizedPnL;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Equity" value={fmtMoney(stats.equity)} hint={`cash ${fmtMoney(stats.cash)}`} />
        <Stat label="Total return" value={fmtPct(stats.totalReturnPct)} klass={stats.totalReturnPct >= 0 ? "text-pos" : "text-neg"} hint={`from ${fmtMoney(stats.startingCash)}`} />
        <Stat label="Realized P&L" value={fmtMoney(stats.realizedPnL)} klass={stats.realizedPnL >= 0 ? "text-pos" : "text-neg"} hint={`unrealized ${fmtMoney(stats.unrealizedPnL)}`} />
        <Stat label="Max drawdown" value={fmtPct(-stats.maxDrawdownPct)} klass={stats.maxDrawdownPct > 0 ? "text-neg" : ""} hint={`${stats.numTrades} trades`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Win rate" value={`${stats.winRate.toFixed(0)}%`} hint={`${stats.numWins}/${stats.numClosedTrades} closed`} />
        <Stat label="Avg gain" value={fmtMoney(stats.avgGain)} klass="text-pos" />
        <Stat label="Avg loss" value={fmtMoney(stats.avgLoss)} klass="text-neg" />
        <Stat label="P&L total" value={fmtMoney(totalPnL)} klass={totalPnL >= 0 ? "text-pos" : "text-neg"} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="card-title m-0">Quick paper trade</div>
          <div className="flex gap-2">
            <button className="btn" onClick={refresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh quotes"}</button>
            <button className="btn btn-danger" onClick={resetAccount}>Reset account</button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="label">Symbol</div>
            <input className="input w-32 uppercase" value={tradeForm.symbol} onChange={(e) => setTradeForm({ ...tradeForm, symbol: e.target.value })} placeholder="AAPL" />
          </div>
          <div>
            <div className="label">Side</div>
            <select className="input" value={tradeForm.side} onChange={(e) => setTradeForm({ ...tradeForm, side: e.target.value as "buy" | "sell" })}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <div>
            <div className="label">Quantity</div>
            <input className="input w-24" type="number" min="0" step="1" value={tradeForm.quantity} onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })} />
          </div>
          {!showConfirm ? (
            <button className="btn btn-primary" onClick={() => setShowConfirm(true)}>Review trade</button>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-warn">Confirm — this is a paper trade (no real broker, no real money).</span>
              <button className="btn btn-primary" onClick={executeTrade}>Confirm</button>
              <button className="btn" onClick={() => setShowConfirm(false)}>Cancel</button>
            </div>
          )}
        </div>
        {tradeError && <div className="text-sm text-neg mt-2">{tradeError}</div>}
        {tradeOk && <div className="text-sm text-pos mt-2">{tradeOk}</div>}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 card-title border-b border-edge">Open positions</div>
        <table className="data">
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Avg cost</th>
              <th className="text-right">Last</th>
              <th className="text-right">Market value</th>
              <th className="text-right">Unrealized P&L</th>
              <th className="text-right">Unrealized %</th>
              <th>Quote source</th>
            </tr>
          </thead>
          <tbody>
            {stats.positions.length === 0 && (
              <tr><td colSpan={8} className="text-muted text-center py-6">No open positions.</td></tr>
            )}
            {stats.positions.map((p) => (
              <tr key={p.symbol}>
                <td className="text-accent">{p.symbol}</td>
                <td className="text-right font-mono">{p.quantity}</td>
                <td className="text-right font-mono">{fmtPrice(p.avgPrice)}</td>
                <td className="text-right font-mono">{fmtPrice(p.lastPrice)}</td>
                <td className="text-right font-mono">{fmtMoney(p.marketValue)}</td>
                <td className={"text-right font-mono " + (p.unrealizedPnL >= 0 ? "text-pos" : "text-neg")}>{fmtMoney(p.unrealizedPnL)}</td>
                <td className={"text-right font-mono " + (p.unrealizedPct >= 0 ? "text-pos" : "text-neg")}>{fmtPct(p.unrealizedPct)}</td>
                <td className="text-muted text-xs">{p.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 card-title border-b border-edge">Trade history</div>
        <table className="data">
          <thead>
            <tr>
              <th>When</th><th>Symbol</th><th>Side</th>
              <th className="text-right">Qty</th><th className="text-right">Price</th>
              <th className="text-right">Commission</th><th className="text-right">Realized P&L</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr><td colSpan={8} className="text-muted text-center py-6">No trades yet.</td></tr>
            )}
            {trades.map((t) => (
              <tr key={t.id}>
                <td className="font-mono text-xs">{new Date(t.executedAt).toISOString().replace("T", " ").slice(0, 16)}</td>
                <td className="text-accent">{t.symbol}</td>
                <td className={t.side === "buy" ? "text-pos" : "text-neg"}>{t.side}</td>
                <td className="text-right font-mono">{t.quantity}</td>
                <td className="text-right font-mono">{fmtPrice(t.price)}</td>
                <td className="text-right font-mono text-muted">{fmtMoney(t.commission)}</td>
                <td className={"text-right font-mono " + (t.realizedPnL > 0 ? "text-pos" : t.realizedPnL < 0 ? "text-neg" : "text-muted")}>{fmtMoney(t.realizedPnL)}</td>
                <td className="text-muted">{t.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, klass }: { label: string; value: string; hint?: string; klass?: string }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className={"text-2xl font-mono " + (klass ?? "")}>{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}
