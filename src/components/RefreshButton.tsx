"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton({ symbol, label = "Refresh data" }: { symbol: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/ticker/${symbol}/refresh`, { method: "POST" });
      const json = await res.json();
      if (json?.ok) {
        setMsg(`refreshed · news ${json.counts.news} · filings ${json.counts.filings}`);
      } else {
        setMsg(`error · ${json?.error ?? "unknown"}`);
      }
      start(() => router.refresh());
    } catch (e) {
      setMsg("network error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <button className="btn" onClick={go} disabled={busy}>
        {busy ? "Refreshing…" : label}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
