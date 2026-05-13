"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtPrice, fmtDate } from "@/lib/format";

type IdeaRow = {
  id: string;
  symbol: string;
  name: string | null;
  sector: string | null;
  direction: string;
  thesis: string;
  entry: number | null;
  stopLoss: number | null;
  target: number | null;
  maxPositionPct: number;
  invalidation: string;
  downsideScenarios: string;
  liquidityWarning: string | null;
  status: string;
  createdAt: string;
  lastPrice: number | null;
};

export function IdeasClient({ initial }: { initial: IdeaRow[] }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState(initial);
  const [filter, setFilter] = useState<"all" | "open" | "acted" | "dismissed">("open");
  const [form, setForm] = useState({
    symbol: "",
    direction: "long" as "long" | "short",
    thesis: "",
    entry: "",
    stopLoss: "",
    target: "",
    maxPositionPct: "5",
    invalidation: "",
    downsideScenarios: "",
    liquidityWarning: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const visible = ideas.filter((i) => filter === "all" || i.status === filter);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const payload = {
      symbol: form.symbol,
      direction: form.direction,
      thesis: form.thesis,
      entry: form.entry ? Number(form.entry) : null,
      stopLoss: form.stopLoss ? Number(form.stopLoss) : null,
      target: form.target ? Number(form.target) : null,
      maxPositionPct: Number(form.maxPositionPct),
      invalidation: form.invalidation,
      downsideScenarios: form.downsideScenarios,
      liquidityWarning: form.liquidityWarning,
    };
    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.ok) {
      setErr(typeof json.error === "string" ? json.error : "Could not create idea (check required fields).");
      return;
    }
    setIdeas([
      { ...json.idea, name: null, sector: null, lastPrice: null, createdAt: json.idea.createdAt },
      ...ideas,
    ]);
    setForm({ ...form, symbol: "", thesis: "", entry: "", stopLoss: "", target: "", invalidation: "", downsideScenarios: "", liquidityWarning: "" });
    start(() => router.refresh());
  }

  async function setStatus(id: string, status: "dismissed" | "expired" | "open") {
    await fetch(`/api/ideas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setIdeas(ideas.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  async function promote(id: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/ideas/${id}/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert("Could not promote idea: " + (json.error || "unknown"));
        return;
      }
      alert(
        `Filled ${json.trade.side} ${json.trade.quantity} ${json.trade.symbol} @ $${json.trade.fillPrice.toFixed(2)} (paper trade).`,
      );
      setIdeas(ideas.map((i) => (i.id === id ? { ...i, status: "acted" } : i)));
      start(() => router.refresh());
    } finally {
      setActing(null);
      setConfirmingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <details className="card">
        <summary className="cursor-pointer text-sm font-medium">+ New trade idea</summary>
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div>
            <div className="label">Symbol</div>
            <input className="input w-full uppercase" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} required />
          </div>
          <div>
            <div className="label">Direction</div>
            <select className="input w-full" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as "long" | "short" })}>
              <option value="long">Long</option>
              <option value="short">Short (tracked only — paper engine does not execute shorts)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="label">Thesis</div>
            <textarea className="input w-full" rows={2} value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} required />
          </div>
          <div><div className="label">Entry</div><input className="input w-full" value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })} placeholder="optional"/></div>
          <div><div className="label">Stop-loss</div><input className="input w-full" value={form.stopLoss} onChange={(e) => setForm({ ...form, stopLoss: e.target.value })} placeholder="required for execution"/></div>
          <div><div className="label">Target</div><input className="input w-full" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
          <div><div className="label">Max position %</div><input className="input w-full" value={form.maxPositionPct} onChange={(e) => setForm({ ...form, maxPositionPct: e.target.value })} /></div>
          <div className="md:col-span-2"><div className="label">Invalidation</div><textarea className="input w-full" rows={2} value={form.invalidation} onChange={(e) => setForm({ ...form, invalidation: e.target.value })} required /></div>
          <div className="md:col-span-2"><div className="label">Downside scenarios</div><textarea className="input w-full" rows={2} value={form.downsideScenarios} onChange={(e) => setForm({ ...form, downsideScenarios: e.target.value })} required /></div>
          <div className="md:col-span-2"><div className="label">Liquidity warning (if any)</div><input className="input w-full" value={form.liquidityWarning} onChange={(e) => setForm({ ...form, liquidityWarning: e.target.value })} /></div>
          <div className="md:col-span-2 flex items-center gap-2">
            <button className="btn btn-primary">Save idea</button>
            {err && <span className="text-sm text-neg">{err}</span>}
          </div>
        </form>
      </details>

      <div className="flex gap-2 text-sm">
        {(["open", "acted", "dismissed", "all"] as const).map((f) => (
          <button key={f} className={"btn " + (filter === f ? "btn-primary" : "")} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 && <div className="card text-muted text-sm">No ideas in this filter.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {visible.map((idea) => {
          const downsidePct = idea.entry && idea.stopLoss ? ((idea.stopLoss - idea.entry) / idea.entry) * 100 : null;
          const upsidePct = idea.entry && idea.target ? ((idea.target - idea.entry) / idea.entry) * 100 : null;
          return (
            <div key={idea.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/ticker/${idea.symbol}`} className="text-accent text-lg font-semibold">{idea.symbol}</Link>
                  <span className={"ml-2 tag " + (idea.direction === "short" ? "text-neg" : "text-pos")}>{idea.direction}</span>
                  <span className="ml-2 tag">{idea.status}</span>
                  <div className="text-xs text-muted mt-1">Created {fmtDate(idea.createdAt)} · sized to {idea.maxPositionPct}% of portfolio</div>
                </div>
                <div className="text-right text-xs text-muted">
                  Last {fmtPrice(idea.lastPrice)}
                </div>
              </div>
              <p className="text-sm">{idea.thesis}</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-muted">Entry</span><div className="font-mono">{fmtPrice(idea.entry)}</div></div>
                <div><span className="text-muted">Stop</span><div className="font-mono text-neg">{fmtPrice(idea.stopLoss)} {downsidePct != null && `(${downsidePct.toFixed(1)}%)`}</div></div>
                <div><span className="text-muted">Target</span><div className="font-mono text-pos">{fmtPrice(idea.target)} {upsidePct != null && `(${upsidePct.toFixed(1)}%)`}</div></div>
              </div>
              <div className="text-xs space-y-1">
                <p><span className="text-muted">Invalidation:</span> {idea.invalidation}</p>
                <p><span className="text-muted">Downside:</span> {idea.downsideScenarios}</p>
                {idea.liquidityWarning && (
                  <p className="text-warn"><span className="text-muted">Liquidity:</span> {idea.liquidityWarning}</p>
                )}
              </div>
              <div className="border-t border-edge pt-2 text-[11px] text-muted leading-snug">
                Not financial advice. Promoting opens a <strong>paper trade</strong> only — no broker is ever called.
              </div>
              {idea.status === "open" && (
                <div className="flex gap-2 pt-1">
                  {idea.direction === "long" && (
                    confirmingId === idea.id ? (
                      <>
                        <span className="text-xs text-warn self-center">Confirm paper trade</span>
                        <button className="btn btn-primary" onClick={() => promote(idea.id)} disabled={acting === idea.id}>
                          {acting === idea.id ? "Filling…" : "Yes, promote"}
                        </button>
                        <button className="btn" onClick={() => setConfirmingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-primary" onClick={() => setConfirmingId(idea.id)}>Promote to paper trade</button>
                    )
                  )}
                  <button className="btn" onClick={() => setStatus(idea.id, "dismissed")}>Dismiss</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
