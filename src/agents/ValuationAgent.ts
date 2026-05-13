import { defineAgent, z } from "./base";
import { llmComplete, extractJson } from "@/lib/llm";

const Input = z.object({
  symbol: z.string(),
  name: z.string().nullable(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  quote: z
    .object({
      price: z.number(),
      changePct: z.number().nullable(),
      marketCap: z.number().nullable(),
      currency: z.string().nullable(),
    })
    .nullable(),
});
const Output = z.object({
  snapshot: z.string(),
  comps: z.array(z.string()),
  valuationView: z.string(),
});

export const ValuationAgent = defineAgent({
  name: "ValuationAgent",
  input: Input,
  output: Output,
  async run(input) {
    const { symbol, name, sector, industry, quote } = input;
    const known = [
      `Symbol: ${symbol}`,
      `Name: ${name ?? "unknown"}`,
      `Sector: ${sector ?? "unknown"}`,
      `Industry: ${industry ?? "unknown"}`,
      `Last price: ${quote ? quote.price + " " + (quote.currency ?? "") : "unknown"}`,
      `Market cap: ${quote?.marketCap ?? "unknown"}`,
    ].join("\n");
    const prompt = `You are a valuation analyst. Based on what we know, write a short valuation snapshot, suggest 3-6 reasonable peer comparables (well-known tickers in the same sub-industry), and give a one-sentence view ("expensive", "fair", "cheap", "no signal").

Known facts:
${known}

Return strict JSON:
{
  "snapshot": "2-4 sentences mentioning what's known and what's missing",
  "comps": ["TICKER1", "TICKER2", "..."],
  "valuationView": "1-2 sentences"
}
If you don't have enough information for a multiple-based view, say so. Never invent specific multiples.`;
    const res = await llmComplete(
      [
        { role: "system", content: "You're an equity valuation analyst. Output JSON only, never invent specific financial numbers." },
        { role: "user", content: prompt },
      ],
      { jsonMode: true, maxTokens: 800 },
    );
    try {
      const parsed = extractJson<any>(res.text);
      return {
        snapshot: String(parsed.snapshot ?? ""),
        comps: Array.isArray(parsed.comps) ? parsed.comps.slice(0, 8).map((s: any) => String(s).toUpperCase()) : [],
        valuationView: String(parsed.valuationView ?? ""),
      };
    } catch {
      return {
        snapshot: `Valuation snapshot for ${symbol} not available; only market cap and price were known.`,
        comps: [],
        valuationView: "Insufficient data for a valuation view.",
      };
    }
  },
});
