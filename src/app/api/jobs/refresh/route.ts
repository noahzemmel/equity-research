import { NextRequest, NextResponse } from "next/server";
import { refreshWatchlist } from "@/jobs/refreshWatchlist";
import { schedulerStatus, startSchedulerIfEnabled } from "@/jobs/scheduler";

// Side-effect: start the in-process scheduler on first hit when enabled.
startSchedulerIfEnabled();

function authorized(req: NextRequest): boolean {
  const expected = process.env.JOBS_SECRET;
  if (!expected) return false; // require an explicit secret
  const header = req.headers.get("x-jobs-secret");
  return !!header && header === expected;
}

export async function GET() {
  return NextResponse.json({ scheduler: schedulerStatus() });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Missing or wrong x-jobs-secret header. Set JOBS_SECRET in .env.local." },
      { status: 401 },
    );
  }
  const url = new URL(req.url);
  const includeNews = url.searchParams.get("news") !== "0";
  const includeFilings = url.searchParams.get("filings") !== "0";
  const results = await refreshWatchlist({ news: includeNews, filings: includeFilings });
  return NextResponse.json({ ok: true, count: results.length, results });
}
