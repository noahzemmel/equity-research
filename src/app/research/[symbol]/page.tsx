import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate, fmtPct, fmtPrice, fmtMcap } from "@/lib/format";
import { ResearchRunner } from "@/components/ResearchRunner";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { key: "businessOverview", label: "Business overview" },
  { key: "revenueModel", label: "Revenue model" },
  { key: "recentNews", label: "Recent news" },
  { key: "earningsSummary", label: "Latest earnings" },
  { key: "bullCase", label: "Bull case" },
  { key: "bearCase", label: "Bear case" },
  { key: "keyRisks", label: "Key risks" },
  { key: "catalysts", label: "Upcoming catalysts" },
  { key: "valuation", label: "Valuation snapshot" },
  { key: "comps", label: "Comparable companies" },
] as const;

function viewClass(v: string) {
  if (v === "high-conviction") return "text-pos";
  if (v === "watch") return "text-warn";
  return "text-neg";
}

export default async function ResearchPage({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase();
  const ticker = await prisma.ticker.findUnique({
    where: { symbol },
    include: { quotes: { orderBy: { asOf: "desc" }, take: 1 } },
  });
  const report = await prisma.researchReport.findFirst({
    where: { symbol },
    orderBy: { asOf: "desc" },
  });
  const q = ticker?.quotes[0] ?? null;
  let sources: string[] = [];
  if (report) {
    try {
      sources = JSON.parse(report.sources);
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Research · <Link href={`/ticker/${symbol}`} className="text-accent">{symbol}</Link>
          </h1>
          <p className="text-sm text-muted">
            {ticker?.name ?? "Unknown"}{ticker?.sector ? ` · ${ticker.sector}` : ""}
            {report ? ` · last run ${fmtDate(report.asOf)}` : " · no report yet"}
          </p>
        </div>
        <ResearchRunner symbol={symbol} hasReport={!!report} />
      </div>

      {q && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card"><div className="card-title">Price</div><div className="text-xl font-mono">{fmtPrice(q.price)}</div></div>
          <div className="card"><div className="card-title">Daily Δ</div><div className={"text-xl font-mono " + (q.changePct == null ? "" : q.changePct >= 0 ? "text-pos" : "text-neg")}>{fmtPct(q.changePct)}</div></div>
          <div className="card"><div className="card-title">Market cap</div><div className="text-xl font-mono">{fmtMcap(q.marketCap)}</div></div>
          <div className="card"><div className="card-title">Quote source</div><div className="text-xl font-mono">{q.source}</div></div>
        </div>
      )}

      {!report ? (
        <div className="card text-muted text-sm">
          No research report yet. Click "Run research" — the pipeline ingests filings (SEC EDGAR), news (RSS), and a
          quote, then runs the analysis agents.
        </div>
      ) : (
        <>
          <div className="card">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="card-title">Final view</div>
                <div className={"text-2xl font-semibold " + viewClass(report.finalView)}>
                  {report.finalView}
                </div>
              </div>
              <div>
                <div className="card-title">Confidence</div>
                <div className="text-2xl font-mono">{(report.confidence * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="card-title">Model</div>
                <div className="text-sm font-mono">{report.llmProvider} · {report.llmModel}</div>
              </div>
              <div>
                <div className="card-title">As of</div>
                <div className="text-sm font-mono">{fmtDate(report.asOf)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {SECTIONS.map(({ key, label }) => (
              <div key={key} className="card">
                <div className="card-title">{label}</div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {(report as any)[key] || <span className="text-muted">—</span>}
                </p>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Sources used</div>
            {sources.length === 0 ? (
              <p className="text-sm text-muted">No source tags recorded.</p>
            ) : (
              <>
                <ul className="text-xs text-muted flex flex-wrap gap-1">
                  {sources
                    .filter((s) => !s.startsWith("tavily:"))
                    .map((s, i) => (
                      <li key={i} className="tag">{s}</li>
                    ))}
                </ul>
                {sources.some((s) => s.startsWith("tavily:")) && (
                  <>
                    <div className="text-xs text-muted mt-3 mb-1">Web pages ingested (Tavily)</div>
                    <ul className="text-xs space-y-1">
                      {sources
                        .filter((s) => s.startsWith("tavily:"))
                        .map((s, i) => {
                          const url = s.replace(/^tavily:/, "");
                          return (
                            <li key={i}>
                              <a className="text-accent" href={url} target="_blank" rel="noreferrer">{url}</a>
                            </li>
                          );
                        })}
                    </ul>
                  </>
                )}
              </>
            )}
            <p className="text-xs text-muted mt-3">
              Every agent step (input + output + duration) is logged to the local <code>AgentLog</code> table for audit.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
