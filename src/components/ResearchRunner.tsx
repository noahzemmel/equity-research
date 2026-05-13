"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ResearchRunner({ symbol, hasReport }: { symbol: string; hasReport: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  async function go() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/research/${symbol}`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) setErr(json.error || "Unknown error");
      else start(() => router.refresh());
    } catch (e) {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }
  async function makeIdea() {
    setIdeaBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/ideas/from-report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const json = await res.json();
      if (!json.ok) setErr(typeof json.error === "string" ? json.error : "Failed");
      else setMsg("Idea created — see /ideas");
    } finally {
      setIdeaBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button className="btn btn-primary" onClick={go} disabled={busy}>
        {busy ? "Running pipeline…" : hasReport ? "Re-run research" : "Run research"}
      </button>
      {hasReport && (
        <button className="btn" onClick={makeIdea} disabled={ideaBusy}>
          {ideaBusy ? "Drafting idea…" : "Generate trade idea"}
        </button>
      )}
      {msg && <span className="text-sm text-pos">{msg}</span>}
      {err && <span className="text-sm text-neg">{err}</span>}
    </div>
  );
}
