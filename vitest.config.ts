import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    env: {
      // Isolated SQLite test DB (relative to prisma/ per Prisma convention).
      DATABASE_URL: "file:./test.db",
      // Force the offline LLM stub so tests never make network calls.
      LLM_PROVIDER: "offline",
      // Tavily disabled (no key) — keeps tests hermetic.
      TAVILY_API_KEY: "",
      PAPER_STARTING_CASH: "100000",
      PAPER_COMMISSION_BPS: "2",
      PAPER_SLIPPAGE_BPS: "5",
    },
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
