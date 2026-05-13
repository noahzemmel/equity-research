import { defineAgent, z } from "./base";
import { llmComplete, extractJson } from "@/lib/llm";

const Input = z.object({
  symbol: z.string(),
  sector: z.string().nullable(),
  businessSummary: z.string().nullable(),
  newsSummary: z.string().nullable(),
  filingsSummary: z.string().nullable(),
  marketCap: z.number().nullable(),
});
const Output = z.object({
  keyRisks: z.string(),
  downsideScenarios: z.string(),
  liquidityWarning: z.string(),
});

export const RiskAgent = defineAgent({
  name: "RiskAgent",
  input: Input,
  output: Output,
  async run(input) {
    const ctx = [
      `Symbol: ${input.symbol}`,
      `Sector: ${input.sector ?? "unknown"}`,
      `Market cap: ${input.marketCap ?? "unknown"}`,
      `Business summary: ${input.businessSummary ?? "n/a"}`,
      `News summary: ${input.newsSummary ?? "n/a"}`,
      `Filings summary: ${input.filingsSummary ?? "n/a"}`,
    ].join("\n");
    const prompt = `You are a risk analyst. Read this context and produce:
- keyRisks: 3-6 bullet-point sentences (joined into a single string with "• " bullets) covering business, financial, regulatory and execution risks.
- downsideScenarios: 2-3 plausible negative scenarios with brief impact descriptions.
- liquidityWarning: one short sentence if mkt cap < $2B or if there are signs of low liquidity, otherwise empty string.

Context:
${ctx}

Return strict JSON:
{"keyRisks": "...", "downsideScenarios": "...", "liquidityWarning": "..."}`;
    const res = await llmComplete(
      [
        { role: "system", content: "You are an equity risk analyst. Output JSON only. Be specific to this company." },
        { role: "user", content: prompt },
      ],
      { jsonMode: true, maxTokens: 900 },
    );
    try {
      const parsed = extractJson<any>(res.text);
      let liq = String(parsed.liquidityWarning ?? "");
      // Always force a liquidity warning if mkt cap is small.
      if (input.marketCap != null && input.marketCap < 2e9 && !liq) {
        liq = `Market cap is approximately ${(input.marketCap / 1e9).toFixed(2)}B — small-cap liquidity risk, position size with care.`;
      }
      return {
        keyRisks: String(parsed.keyRisks ?? ""),
        downsideScenarios: String(parsed.downsideScenarios ?? ""),
        liquidityWarning: liq,
      };
    } catch {
      return {
        keyRisks: "Standard equity risks apply: macro, sector, execution and regulatory.",
        downsideScenarios: "Sustained earnings miss or guidance cut could drive a multi-quarter de-rating.",
        liquidityWarning:
          input.marketCap != null && input.marketCap < 2e9
            ? "Small-cap liquidity risk — size positions cautiously."
            : "",
      };
    }
  },
});
