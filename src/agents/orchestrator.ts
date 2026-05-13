import { prisma } from "@/lib/db";
import { DataCollectorAgent } from "./DataCollectorAgent";
import { FilingAnalysisAgent } from "./FilingAnalysisAgent";
import { NewsAnalysisAgent } from "./NewsAnalysisAgent";
import { ValuationAgent } from "./ValuationAgent";
import { RiskAgent } from "./RiskAgent";
import { ReportWriterAgent } from "./ReportWriterAgent";

export async function runResearchPipeline(symbol: string) {
  const sym = symbol.toUpperCase();
  const ctx = { symbol: sym, sources: [] as string[] };

  const collected = await DataCollectorAgent({ symbol: sym }, ctx);
  if (!collected.ok || !collected.data) {
    throw new Error(`DataCollectorAgent failed: ${collected.error}`);
  }
  const data = collected.data;
  ctx.sources.push(...data.sources);

  const [filings, news, valuation] = await Promise.all([
    FilingAnalysisAgent({ symbol: sym, filings: data.filings }, ctx),
    NewsAnalysisAgent({ symbol: sym, news: data.news }, ctx),
    ValuationAgent(
      {
        symbol: sym,
        name: data.name,
        sector: data.sector,
        industry: data.industry,
        quote: data.quote
          ? {
              price: data.quote.price,
              changePct: data.quote.changePct,
              marketCap: data.quote.marketCap,
              currency: data.quote.currency,
            }
          : null,
      },
      ctx,
    ),
  ]);

  const risk = await RiskAgent(
    {
      symbol: sym,
      sector: data.sector,
      businessSummary: data.longBusinessSummary,
      newsSummary: news.ok ? news.data!.summary : null,
      filingsSummary: filings.ok ? filings.data!.summary : null,
      marketCap: data.quote?.marketCap ?? null,
    },
    ctx,
  );

  const report = await ReportWriterAgent(
    {
      symbol: sym,
      name: data.name,
      sector: data.sector,
      industry: data.industry,
      businessSummary: data.longBusinessSummary,
      newsSummary: news.ok ? news.data!.summary : "No recent news available.",
      newsSentiment: news.ok ? news.data!.sentiment : "neutral",
      filingsSummary: filings.ok ? filings.data!.summary : "No SEC filings available.",
      valuationSnapshot: valuation.ok ? valuation.data!.snapshot : "No valuation snapshot available.",
      valuationView: valuation.ok ? valuation.data!.valuationView : "n/a",
      comps: valuation.ok ? valuation.data!.comps : [],
      riskKeyRisks: risk.ok ? risk.data!.keyRisks : "Standard equity risks.",
      riskDownsideScenarios: risk.ok ? risk.data!.downsideScenarios : "",
      quote: data.quote
        ? {
            price: data.quote.price,
            changePct: data.quote.changePct,
            marketCap: data.quote.marketCap,
            source: data.quote.source,
          }
        : null,
      webResearch: data.webResearch,
      webAnswer: data.webAnswer,
      sources: ctx.sources,
    },
    ctx,
  );

  if (!report.ok || !report.data) {
    throw new Error(`ReportWriterAgent failed: ${report.error}`);
  }

  const r = report.data;
  const saved = await prisma.researchReport.create({
    data: {
      symbol: sym,
      businessOverview: r.businessOverview,
      revenueModel: r.revenueModel,
      recentNews: r.recentNews,
      earningsSummary: r.earningsSummary,
      bullCase: r.bullCase,
      bearCase: r.bearCase,
      keyRisks: r.keyRisks,
      catalysts: r.catalysts,
      valuation: r.valuation,
      comps: r.comps,
      finalView: r.finalView,
      confidence: r.confidence,
      sources: JSON.stringify(r.sources),
      llmProvider: r.llmProvider,
      llmModel: r.llmModel,
      raw: JSON.stringify(r),
    },
  });

  return {
    reportId: saved.id,
    report: r,
    risk: risk.ok ? risk.data : null,
    news: news.ok ? news.data : null,
    filings: filings.ok ? filings.data : null,
  };
}
