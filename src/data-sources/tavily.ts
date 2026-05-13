export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string | null;
};

const TAVILY_URL = "https://api.tavily.com/search";

export type TavilyOptions = {
  maxResults?: number;
  /** Restrict to the last N days. Default 30. */
  days?: number;
  /** "basic" (fast) or "advanced" (more thorough, slower, more credits). */
  depth?: "basic" | "advanced";
  /** If true, ask Tavily for a synthesized one-paragraph answer. */
  includeAnswer?: boolean;
  /** Optional include/exclude domains to nudge result quality. */
  includeDomains?: string[];
  excludeDomains?: string[];
};

export type TavilyResponse = {
  results: TavilyResult[];
  answer?: string;
};

/**
 * Tavily web-search wrapper.
 *
 * Soft-fails to an empty result set when TAVILY_API_KEY isn't set or the API
 * call fails — callers should always check `results.length > 0` before relying
 * on web context.
 */
export async function tavilySearch(query: string, opts: TavilyOptions = {}): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { results: [] };

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: opts.depth ?? "basic",
        max_results: opts.maxResults ?? 5,
        days: opts.days ?? 30,
        include_answer: opts.includeAnswer ?? false,
        include_domains: opts.includeDomains,
        exclude_domains: opts.excludeDomains,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return { results: [] };
    const data = (await res.json()) as any;
    const results = Array.isArray(data?.results)
      ? data.results.slice(0, opts.maxResults ?? 5).map((r: any) => ({
          title: String(r.title ?? "").slice(0, 300),
          url: String(r.url ?? ""),
          content: String(r.content ?? "").slice(0, 800),
          score: typeof r.score === "number" ? r.score : undefined,
          publishedDate: r.published_date ?? null,
        }))
      : [];
    return {
      results,
      answer: typeof data?.answer === "string" ? data.answer : undefined,
    };
  } catch {
    return { results: [] };
  } finally {
    clearTimeout(timeout);
  }
}

export function tavilyEnabled(): boolean {
  return !!process.env.TAVILY_API_KEY;
}
