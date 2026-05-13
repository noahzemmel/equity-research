import { defineAgent, z } from "./base";
import { llmComplete } from "@/lib/llm";

const Input = z.object({
  symbol: z.string(),
  filings: z.array(z.object({ form: z.string(), title: z.string().nullable().optional(), filedAt: z.string().nullable().optional(), url: z.string() })),
});
const Output = z.object({
  summary: z.string(),
  recentMaterialFilings: z.array(z.object({ form: z.string(), filedAt: z.string().nullable(), url: z.string(), why: z.string() })),
});

export const FilingAnalysisAgent = defineAgent({
  name: "FilingAnalysisAgent",
  input: Input,
  output: Output,
  async run({ symbol, filings }) {
    if (filings.length === 0) {
      return { summary: "No SEC filings available for this ticker.", recentMaterialFilings: [] };
    }
    const compact = filings
      .slice(0, 12)
      .map((f, i) => `${i + 1}. [${f.form}] ${f.filedAt ?? "?"} — ${f.title ?? ""} — ${f.url}`)
      .join("\n");
    const prompt = `You are a senior equity analyst. From this list of SEC filings for ${symbol}, identify which filings look most material and summarise what an investor should focus on.

Filings (most recent first):
${compact}

Return strict JSON of shape:
{
  "summary": "2-4 sentence narrative",
  "recentMaterialFilings": [
    {"form": "10-Q", "filedAt": "YYYY-MM-DD" or null, "url": "...", "why": "1 sentence on why this matters"}
  ]
}
Only include filings that genuinely matter (earnings, guidance, restatements, insider transactions, 8-K material events). Do not invent filings.`;
    const res = await llmComplete(
      [
        { role: "system", content: "You analyze SEC filings. Return only JSON. Never invent filings." },
        { role: "user", content: prompt },
      ],
      { jsonMode: true, maxTokens: 1200 },
    );
    try {
      const { extractJson } = await import("@/lib/llm");
      const parsed = extractJson<any>(res.text);
      return {
        summary: String(parsed.summary ?? "No summary."),
        recentMaterialFilings: Array.isArray(parsed.recentMaterialFilings)
          ? parsed.recentMaterialFilings
              .filter((x: any) => x && x.url && filings.some((f) => f.url === x.url))
              .slice(0, 5)
              .map((x: any) => ({
                form: String(x.form ?? ""),
                filedAt: x.filedAt ?? null,
                url: String(x.url),
                why: String(x.why ?? ""),
              }))
          : [],
      };
    } catch {
      return {
        summary: filings[0] ? `Most recent filing: ${filings[0].form} on ${filings[0].filedAt ?? "?"}.` : "No filings.",
        recentMaterialFilings: filings.slice(0, 3).map((f) => ({
          form: f.form,
          filedAt: f.filedAt ?? null,
          url: f.url,
          why: "Listed as one of the most recent filings.",
        })),
      };
    }
  },
});
