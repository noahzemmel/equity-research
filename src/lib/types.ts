import { z } from "zod";

export const FinalView = z.enum(["avoid", "watch", "high-conviction"]);
export type FinalView = z.infer<typeof FinalView>;

export const ResearchReportSchema = z.object({
  symbol: z.string(),
  businessOverview: z.string(),
  revenueModel: z.string(),
  recentNews: z.string(),
  earningsSummary: z.string(),
  bullCase: z.string(),
  bearCase: z.string(),
  keyRisks: z.string(),
  catalysts: z.string(),
  valuation: z.string(),
  comps: z.string(),
  finalView: FinalView,
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
});
export type ResearchReportPayload = z.infer<typeof ResearchReportSchema>;

export const TradeIdeaSchema = z.object({
  symbol: z.string(),
  direction: z.enum(["long", "short"]),
  thesis: z.string(),
  entry: z.number().nullable(),
  stopLoss: z.number().nullable(),
  target: z.number().nullable(),
  maxPositionPct: z.number().min(0).max(100),
  invalidation: z.string(),
  downsideScenarios: z.string(),
  liquidityWarning: z.string().optional().default(""),
});
export type TradeIdeaPayload = z.infer<typeof TradeIdeaSchema>;

export const QuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  changePct: z.number().nullable(),
  marketCap: z.number().nullable(),
  currency: z.string().nullable(),
  asOf: z.string(),
  source: z.string(),
  name: z.string().nullable().optional(),
  exchange: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const NewsItemPayload = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});
export type News = z.infer<typeof NewsItemPayload>;

export const FilingPayload = z.object({
  form: z.string(),
  title: z.string().nullable().optional(),
  filedAt: z.string().nullable().optional(),
  accession: z.string().nullable().optional(),
  url: z.string(),
  summary: z.string().nullable().optional(),
});
export type FilingItem = z.infer<typeof FilingPayload>;
