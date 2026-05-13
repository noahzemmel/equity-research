import { prisma } from "@/lib/db";
import { fetchQuote, fetchProfile } from "@/data-sources/yahoo";
import { fetchNews } from "@/data-sources/rssNews";
import { fetchFilings } from "@/data-sources/secEdgar";
import { tavilySearch, tavilyEnabled } from "@/data-sources/tavily";
import { defineAgent, z } from "./base";

const Input = z.object({ symbol: z.string() });
const Output = z.object({
  symbol: z.string(),
  name: z.string().nullable(),
  exchange: z.string().nullable(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  longBusinessSummary: z.string().nullable(),
  quote: z
    .object({
      price: z.number(),
      changePct: z.number().nullable(),
      marketCap: z.number().nullable(),
      currency: z.string().nullable(),
      source: z.string(),
      asOf: z.string(),
    })
    .nullable(),
  news: z.array(z.object({ title: z.string(), url: z.string(), source: z.string().nullable().optional(), publishedAt: z.string().nullable().optional() })),
  filings: z.array(z.object({ form: z.string(), title: z.string().nullable().optional(), filedAt: z.string().nullable().optional(), url: z.string() })),
  webResearch: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      score: z.number().optional(),
      publishedDate: z.string().nullable().optional(),
    }),
  ),
  webAnswer: z.string().nullable(),
  sources: z.array(z.string()),
});
export type CollectorInput = z.infer<typeof Input>;
export type CollectorOutput = z.infer<typeof Output>;

export const DataCollectorAgent = defineAgent({
  name: "DataCollectorAgent",
  input: Input,
  output: Output,
  async run({ symbol }) {
    const sym = symbol.toUpperCase();
    // Tavily query is tuned for fundamentals + catalysts rather than headlines (RSS already covers those).
    const tavilyQuery = `${sym} stock recent earnings results guidance and analyst commentary`;
    const [quoteR, profileR, newsR, filingsR, webR] = await Promise.allSettled([
      fetchQuote(sym),
      fetchProfile(sym),
      fetchNews(sym, 15),
      fetchFilings(sym, 10),
      tavilyEnabled()
        ? tavilySearch(tavilyQuery, { maxResults: 5, days: 45, includeAnswer: true })
        : Promise.resolve({ results: [], answer: undefined as string | undefined }),
    ]);
    const quote = quoteR.status === "fulfilled" ? quoteR.value : null;
    const profile = profileR.status === "fulfilled" ? profileR.value : null;
    const news = newsR.status === "fulfilled" ? newsR.value : [];
    const filings = filingsR.status === "fulfilled" ? filingsR.value : [];
    const web = webR.status === "fulfilled" ? webR.value : { results: [], answer: undefined };

    // Persist what we got so the rest of the app benefits.
    await prisma.ticker.upsert({
      where: { symbol: sym },
      create: {
        symbol: sym,
        name: quote?.name ?? null,
        exchange: quote?.exchange ?? null,
        sector: profile?.sector ?? quote?.sector ?? null,
        industry: profile?.industry ?? null,
        currency: quote?.currency ?? null,
      },
      update: {
        name: quote?.name ?? undefined,
        exchange: quote?.exchange ?? undefined,
        sector: profile?.sector ?? undefined,
        industry: profile?.industry ?? undefined,
        currency: quote?.currency ?? undefined,
      },
    });
    if (quote) {
      await prisma.quoteSnapshot.create({
        data: {
          symbol: sym,
          price: quote.price,
          changePct: quote.changePct,
          marketCap: quote.marketCap,
          currency: quote.currency,
          asOf: new Date(quote.asOf),
          source: quote.source,
        },
      });
    }
    for (const it of news) {
      try {
        await prisma.newsItem.upsert({
          where: { symbol_url: { symbol: sym, url: it.url } },
          create: {
            symbol: sym,
            title: it.title,
            url: it.url,
            source: it.source ?? null,
            publishedAt: it.publishedAt ? new Date(it.publishedAt) : null,
            summary: it.summary ?? null,
          },
          update: {},
        });
      } catch {}
    }
    for (const it of filings) {
      try {
        await prisma.filing.upsert({
          where: { symbol_url: { symbol: sym, url: it.url } },
          create: {
            symbol: sym,
            form: it.form,
            title: it.title ?? null,
            filedAt: it.filedAt ? new Date(it.filedAt) : null,
            accession: it.accession ?? null,
            url: it.url,
          },
          update: {},
        });
      } catch {}
    }

    const sources: string[] = [];
    if (quote) sources.push(`yahoo-quote:${quote.source}`);
    if (profile?.longBusinessSummary) sources.push("yahoo-profile");
    if (news.length) sources.push("rss-news");
    if (filings.length) sources.push("sec-edgar");
    if (web.results.length) sources.push("tavily");
    // Append the URLs themselves so the audit log shows what the LLM actually saw.
    for (const w of web.results) sources.push(`tavily:${w.url}`);

    return {
      symbol: sym,
      name: quote?.name ?? null,
      exchange: quote?.exchange ?? null,
      sector: profile?.sector ?? quote?.sector ?? null,
      industry: profile?.industry ?? null,
      longBusinessSummary: profile?.longBusinessSummary ?? null,
      quote: quote
        ? {
            price: quote.price,
            changePct: quote.changePct,
            marketCap: quote.marketCap,
            currency: quote.currency,
            source: quote.source,
            asOf: quote.asOf,
          }
        : null,
      news: news.map((n) => ({
        title: n.title,
        url: n.url,
        source: n.source ?? null,
        publishedAt: n.publishedAt ?? null,
      })),
      filings: filings.map((f) => ({
        form: f.form,
        title: f.title ?? null,
        filedAt: f.filedAt ?? null,
        url: f.url,
      })),
      webResearch: web.results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        publishedDate: r.publishedDate ?? null,
      })),
      webAnswer: web.answer ?? null,
      sources,
    };
  },
});
