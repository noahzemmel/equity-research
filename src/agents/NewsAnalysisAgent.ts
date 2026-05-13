import { defineAgent, z } from "./base";
import { llmComplete, extractJson } from "@/lib/llm";

const Input = z.object({
  symbol: z.string(),
  news: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      source: z.string().nullable().optional(),
      publishedAt: z.string().nullable().optional(),
    }),
  ),
});
const Output = z.object({
  summary: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  highlights: z.array(z.object({ title: z.string(), url: z.string(), takeaway: z.string() })),
});

export const NewsAnalysisAgent = defineAgent({
  name: "NewsAnalysisAgent",
  input: Input,
  output: Output,
  async run({ symbol, news }) {
    if (news.length === 0) {
      return { summary: "No recent news headlines found.", sentiment: "neutral", highlights: [] };
    }
    const compact = news
      .slice(0, 15)
      .map((n, i) => `${i + 1}. [${n.source ?? "RSS"}] ${n.publishedAt ?? "?"} — ${n.title} — ${n.url}`)
      .join("\n");
    const prompt = `You are an equity analyst. Summarise this batch of recent news headlines for ${symbol}.

Headlines:
${compact}

Return strict JSON:
{
  "summary": "3-5 sentence narrative of the news flow, NOT a list",
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "highlights": [{"title": "...", "url": "<must be one of the urls above>", "takeaway": "1 sentence why it matters"}]
}
Pick at most 4 highlights and only use URLs from the list above.`;
    const res = await llmComplete(
      [
        { role: "system", content: "You analyze news. Return only valid JSON. Never invent URLs or events." },
        { role: "user", content: prompt },
      ],
      { jsonMode: true, maxTokens: 1200 },
    );
    try {
      const parsed = extractJson<any>(res.text);
      const allowedUrls = new Set(news.map((n) => n.url));
      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights
            .filter((h: any) => h && h.url && allowedUrls.has(h.url))
            .slice(0, 4)
            .map((h: any) => ({
              title: String(h.title ?? ""),
              url: String(h.url),
              takeaway: String(h.takeaway ?? ""),
            }))
        : [];
      const sentiment = ["positive", "neutral", "negative", "mixed"].includes(parsed.sentiment)
        ? parsed.sentiment
        : "neutral";
      return { summary: String(parsed.summary ?? ""), sentiment, highlights };
    } catch {
      return {
        summary: `Saw ${news.length} recent headlines for ${symbol}.`,
        sentiment: "neutral",
        highlights: news.slice(0, 3).map((n) => ({ title: n.title, url: n.url, takeaway: "Recent headline." })),
      };
    }
  },
});
