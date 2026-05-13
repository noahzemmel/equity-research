import { defineAgent, z } from "./base";
import { llmComplete, extractJson } from "@/lib/llm";
import { ResearchReportSchema } from "@/lib/types";

const Input = z.object({
  symbol: z.string(),
  name: z.string().nullable(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  businessSummary: z.string().nullable(),
  newsSummary: z.string(),
  newsSentiment: z.string(),
  filingsSummary: z.string(),
  valuationSnapshot: z.string(),
  valuationView: z.string(),
  comps: z.array(z.string()),
  riskKeyRisks: z.string(),
  riskDownsideScenarios: z.string(),
  quote: z
    .object({
      price: z.number(),
      changePct: z.number().nullable(),
      marketCap: z.number().nullable(),
      source: z.string(),
    })
    .nullable(),
  webResearch: z.array(
    z.object({ title: z.string(), url: z.string(), content: z.string(), publishedDate: z.string().nullable().optional() }),
  ),
  webAnswer: z.string().nullable(),
  sources: z.array(z.string()),
});

const Output = ResearchReportSchema.extend({
  llmProvider: z.enum(["openai", "anthropic", "offline"]),
  llmModel: z.string(),
});

export const ReportWriterAgent = defineAgent({
  name: "ReportWriterAgent",
  input: Input,
  output: Output,
  async run(input) {
    const webBlock = input.webResearch.length
      ? input.webResearch
          .map(
            (w, i) =>
              `  [${i + 1}] ${w.title}${w.publishedDate ? " (" + w.publishedDate + ")" : ""}\n      ${w.url}\n      ${w.content.replace(/\s+/g, " ").slice(0, 400)}`,
          )
          .join("\n")
      : "  (no web research available)";

    const block = [
      `Symbol: ${input.symbol}`,
      `Name: ${input.name ?? "unknown"}`,
      `Sector / Industry: ${input.sector ?? "?"} / ${input.industry ?? "?"}`,
      `Business summary: ${input.businessSummary ?? "n/a"}`,
      `Quote: ${input.quote ? `${input.quote.price} (Δ ${input.quote.changePct ?? "?"}%) marketCap=${input.quote.marketCap ?? "?"} source=${input.quote.source}` : "n/a"}`,
      `News summary (sentiment=${input.newsSentiment}): ${input.newsSummary}`,
      `Filings summary: ${input.filingsSummary}`,
      `Web research (Tavily) — synthesized answer: ${input.webAnswer ?? "n/a"}`,
      `Web research results:\n${webBlock}`,
      `Valuation snapshot: ${input.valuationSnapshot}`,
      `Valuation view: ${input.valuationView}`,
      `Comps suggested: ${input.comps.join(", ") || "none"}`,
      `Key risks: ${input.riskKeyRisks}`,
      `Downside scenarios: ${input.riskDownsideScenarios}`,
    ].join("\n");

    const prompt = `You are writing a buy-side equity research note for ${input.symbol}.

Combine the inputs below into a single, balanced report. Be specific, avoid generic boilerplate, and never invent financial metrics. Quote-source is "${input.quote?.source ?? "n/a"}" — if it is "mock", say in the report that price data was unavailable and treat the valuation snapshot as illustrative.

Inputs:
${block}

Return strict JSON exactly matching this shape:
{
  "symbol": "${input.symbol}",
  "businessOverview": "...",
  "revenueModel": "...",
  "recentNews": "...",
  "earningsSummary": "...",
  "bullCase": "...",
  "bearCase": "...",
  "keyRisks": "...",
  "catalysts": "...",
  "valuation": "...",
  "comps": "...",
  "finalView": "avoid" | "watch" | "high-conviction",
  "confidence": number between 0 and 1 (low if quote source is mock or news is sparse),
  "sources": ${JSON.stringify(input.sources)}
}

Rules:
- 'comps' should be a short paragraph that explains the comparable companies.
- 'catalysts' should reference specific upcoming events when possible (next earnings, product cycles, regulatory dates).
- 'finalView' is your overall take.
- Set 'confidence' to <= 0.4 if quote source is "mock" OR there are no filings OR no news.`;

    const res = await llmComplete(
      [
        { role: "system", content: "You write equity research reports. Return only valid JSON matching the shape requested." },
        { role: "user", content: prompt },
      ],
      { jsonMode: true, maxTokens: 2500 },
    );
    const parsed = extractJson<any>(res.text);
    parsed.symbol = input.symbol;
    if (typeof parsed.confidence !== "number") parsed.confidence = 0.3;
    if (!Array.isArray(parsed.sources)) parsed.sources = input.sources;
    // Force lower confidence when underlying inputs are weak.
    const weak =
      (input.quote?.source ?? "") === "mock" ||
      input.newsSummary.toLowerCase().includes("no recent news") ||
      input.filingsSummary.toLowerCase().includes("no sec filings");
    if (weak && parsed.confidence > 0.4) parsed.confidence = 0.4;
    parsed.llmProvider = res.provider;
    parsed.llmModel = res.model;
    return parsed;
  },
});
