# Equity Research Co-Pilot

Local-first AI equity research workbench. Builds structured research reports,
monitors filings and news, and supports paper trading with explicit risk
controls. **It never connects to a broker and never executes real trades.**

## Hard safety rules (v1)

- No broker integration, ever.
- No leverage, options, CFDs, or crypto.
- Paper trading only, with explicit "not financial advice" disclaimers.
- Every agent decision is logged with sources for audit.

## Quickstart

```bash
cp .env.example .env.local      # fill in keys you have (all optional)
npm install
npx prisma generate
npx prisma db push              # creates prisma/dev.db
npm run db:seed                 # optional: a few seed tickers
npm run dev                     # http://localhost:3000
```

## What works in each stage

- Stage 1 — App shell, Prisma+SQLite schema, watchlist CRUD, dashboard, ticker
  detail page reading cached data, settings page.
- Stage 2 — Live quotes (Yahoo), SEC EDGAR filings, RSS news.
- Stage 3 — Research agents pipeline producing a structured report.
- Stage 4 — Paper portfolio with P&L, win rate, drawdown.
- Stage 5 — Trade ideas with stop-loss/invalidation/liquidity gates.
- Stage 6 — Scheduled background refresh for watchlist + news.

## LLM provider

The LLM is abstracted in `src/lib/llm.ts`. It auto-selects from
`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. If neither is set the agents fall back
to a deterministic offline stub — the UI remains usable but reports are
clearly marked `offline`.
