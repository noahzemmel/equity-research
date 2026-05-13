import { refreshWatchlist } from "./refreshWatchlist";

const g = globalThis as unknown as {
  __equityResearchScheduler?: {
    started: boolean;
    timer?: NodeJS.Timeout;
    lastTickAt?: string;
    lastTickResults?: unknown;
  };
};

function getMinutes() {
  const n = Number(process.env.SCHEDULER_INTERVAL_MINUTES ?? 30);
  return isFinite(n) && n > 1 ? n : 30;
}

export function startSchedulerIfEnabled() {
  if (process.env.SCHEDULER_ENABLED !== "1") return false;
  if (!g.__equityResearchScheduler) g.__equityResearchScheduler = { started: false };
  if (g.__equityResearchScheduler.started) return true;
  g.__equityResearchScheduler.started = true;
  const ms = getMinutes() * 60 * 1000;
  const tick = async () => {
    try {
      const results = await refreshWatchlist({ news: true, filings: true });
      g.__equityResearchScheduler!.lastTickAt = new Date().toISOString();
      g.__equityResearchScheduler!.lastTickResults = results;
      console.log(`[scheduler] refreshed ${results.length} symbols at ${g.__equityResearchScheduler!.lastTickAt}`);
    } catch (e) {
      console.error("[scheduler] tick failed:", e);
    }
  };
  // First tick after 15s so the dev server boots cleanly
  setTimeout(tick, 15_000);
  g.__equityResearchScheduler.timer = setInterval(tick, ms);
  console.log(`[scheduler] enabled — every ${getMinutes()} min`);
  return true;
}

export function schedulerStatus() {
  return {
    enabled: process.env.SCHEDULER_ENABLED === "1",
    started: !!g.__equityResearchScheduler?.started,
    intervalMinutes: getMinutes(),
    lastTickAt: g.__equityResearchScheduler?.lastTickAt ?? null,
  };
}
