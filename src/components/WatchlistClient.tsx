"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtPct, fmtPrice, fmtMcap } from "@/lib/format";

type Row = {
  symbol: string;
  notes: string | null;
  name: string | null;
  sector: string | null;
  exchange: string | null;
  lastQuote: { price: number; changePct: number | null; marketCap: number | null; asOf: string } | null;
};

export function WatchlistClient({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [symbol, setSymbol] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed) return;
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: trimmed, notes }),
    });
    if (!res.ok) {
      setError("Could not add ticker");
      return;
    }
    setSymbol("");
    setNotes("");
    // Try to fetch a quote in the background so the row populates
    fetch(`/api/ticker/${trimmed}/quote`, { method: "POST" }).catch(() => {});
    start(() => router.refresh());
  }

  async function remove(sym: string) {
    if (!confirm(`Remove ${sym} from watchlist?`)) return;
    await fetch(`/api/watchlist/${sym}`, { method: "DELETE" });
    setRows(rows.filter((r) => r.symbol !== sym));
    start(() => router.refresh());
  }

  async function refresh(sym: string) {
    setRefreshing(sym);
    try {
      await fetch(`/api/ticker/${sym}/quote`, { method: "POST" });
      start(() => router.refresh());
    } finally {
      setRefreshing(null);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="label">Ticker</label>
          <input
            className="input w-32 uppercase"
            placeholder="AAPL"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
        </div>
        <div className="flex flex-col flex-1 min-w-[200px]">
          <label className="label">Notes</label>
          <input
            className="input"
            placeholder="Why are you watching this?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
        {error && <span className="text-neg text-sm">{error}</span>}
      </form>

      <div className="card p-0 overflow-hidden">
        <table className="data">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Sector</th>
              <th className="text-right">Price</th>
              <th className="text-right">Δ%</th>
              <th className="text-right">Mkt Cap</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted text-center py-6">
                  No tickers yet. Add one above.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.symbol}>
                <td>
                  <Link href={`/ticker/${r.symbol}`} className="text-accent font-medium">
                    {r.symbol}
                  </Link>
                </td>
                <td className="text-muted">{r.name ?? "—"}</td>
                <td className="text-muted">{r.sector ?? "—"}</td>
                <td className="text-right font-mono">{fmtPrice(r.lastQuote?.price)}</td>
                <td
                  className={
                    "text-right font-mono " +
                    (r.lastQuote?.changePct == null
                      ? "text-muted"
                      : r.lastQuote.changePct >= 0
                        ? "text-pos"
                        : "text-neg")
                  }
                >
                  {fmtPct(r.lastQuote?.changePct)}
                </td>
                <td className="text-right font-mono text-muted">{fmtMcap(r.lastQuote?.marketCap)}</td>
                <td className="text-muted">{r.notes ?? ""}</td>
                <td className="text-right space-x-1">
                  <button className="btn" onClick={() => refresh(r.symbol)} disabled={refreshing === r.symbol}>
                    {refreshing === r.symbol ? "…" : "↻"}
                  </button>
                  <Link className="btn" href={`/research/${r.symbol}`}>Research</Link>
                  <button className="btn btn-danger" onClick={() => remove(r.symbol)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
