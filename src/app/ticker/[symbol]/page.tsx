import { prisma } from "@/lib/db";
import Link from "next/link";
import { fmtPct, fmtPrice, fmtMcap, fmtDate } from "@/lib/format";
import { RefreshButton } from "@/components/RefreshButton";

export const dynamic = "force-dynamic";

export default async function TickerPage({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase();
  const ticker = await prisma.ticker.findUnique({
    where: { symbol },
    include: {
      quotes: { orderBy: { asOf: "desc" }, take: 1 },
      news: { orderBy: { publishedAt: "desc" }, take: 12 },
      filings: { orderBy: { filedAt: "desc" }, take: 12 },
      reports: { orderBy: { asOf: "desc" }, take: 1 },
    },
  });
  const q = ticker?.quotes[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{symbol}</h1>
          <p className="text-sm text-muted">
            {ticker?.name ?? "Unknown company"}
            {ticker?.exchange ? ` · ${ticker.exchange}` : ""}
            {ticker?.sector ? ` · ${ticker.sector}` : ""}
            {ticker?.industry ? ` · ${ticker.industry}` : ""}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <RefreshButton symbol={symbol} />
          <Link className="btn btn-primary" href={`/research/${symbol}`}>Run research</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card"><div className="card-title">Price</div><div className="text-2xl font-mono">{fmtPrice(q?.price)}</div></div>
        <div className="card"><div className="card-title">Daily Δ</div><div className={"text-2xl font-mono " + (q?.changePct == null ? "" : q.changePct >= 0 ? "text-pos" : "text-neg")}>{fmtPct(q?.changePct)}</div></div>
        <div className="card"><div className="card-title">Market cap</div><div className="text-2xl font-mono">{fmtMcap(q?.marketCap)}</div></div>
        <div className="card">
          <div className="card-title">As of</div>
          <div className="text-sm font-mono">{q ? fmtDate(q.asOf) : "—"}</div>
          <div className="text-xs text-muted">source: {q?.source ?? "—"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card">
          <div className="card-title">Recent filings</div>
          {ticker?.filings.length ? (
            <ul className="text-sm space-y-1.5">
              {ticker.filings.map((f) => (
                <li key={f.id} className="flex justify-between gap-3 items-baseline">
                  <a className="text-accent truncate" href={f.url} target="_blank" rel="noreferrer">
                    <span className="tag mr-2">{f.form}</span>
                    {f.title ?? "Filing"}
                  </a>
                  <span className="text-muted text-xs whitespace-nowrap">{fmtDate(f.filedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No filings cached. Click "Refresh data" — SEC EDGAR (US tickers).</p>
          )}
        </div>
        <div className="card">
          <div className="card-title">Recent news</div>
          {ticker?.news.length ? (
            <ul className="text-sm space-y-1.5">
              {ticker.news.map((n) => (
                <li key={n.id} className="flex justify-between gap-3 items-baseline">
                  <a className="text-accent truncate" href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
                  <span className="text-muted text-xs whitespace-nowrap">{fmtDate(n.publishedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No news cached. Click "Refresh data" — Yahoo & Google News RSS.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Latest research report</div>
        {ticker?.reports[0] ? (
          <Link href={`/research/${symbol}`} className="text-accent text-sm">
            View report from {fmtDate(ticker.reports[0].asOf)} ({ticker.reports[0].finalView}, confidence{" "}
            {(ticker.reports[0].confidence * 100).toFixed(0)}%)
          </Link>
        ) : (
          <p className="text-sm text-muted">No report yet. Click "Run research" to generate one (Stage 3).</p>
        )}
      </div>
    </div>
  );
}
