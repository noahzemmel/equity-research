import { schedulerStatus, startSchedulerIfEnabled } from "@/jobs/scheduler";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  // Start scheduler when settings page is visited; idempotent.
  startSchedulerIfEnabled();
  const sched = schedulerStatus();
  const envState = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    TAVILY_API_KEY: !!process.env.TAVILY_API_KEY,
    SEC_USER_AGENT: !!process.env.SEC_USER_AGENT,
    DATABASE_URL: !!process.env.DATABASE_URL,
    JOBS_SECRET: !!process.env.JOBS_SECRET,
  };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="card">
        <div className="card-title">Environment</div>
        <p className="text-sm text-muted mb-3">
          Edit <code>.env.local</code> at the project root, then restart <code>npm run dev</code>.
        </p>
        <table className="data">
          <thead><tr><th>Variable</th><th>Status</th><th>Used for</th></tr></thead>
          <tbody>
            <tr><td>OPENAI_API_KEY</td><td>{envState.OPENAI_API_KEY ? "set" : "missing"}</td><td>Research agent LLM</td></tr>
            <tr><td>ANTHROPIC_API_KEY</td><td>{envState.ANTHROPIC_API_KEY ? "set" : "missing"}</td><td>Research agent LLM (alt)</td></tr>
            <tr><td>TAVILY_API_KEY</td><td>{envState.TAVILY_API_KEY ? "set" : "missing"}</td><td>Optional web research</td></tr>
            <tr><td>SEC_USER_AGENT</td><td>{envState.SEC_USER_AGENT ? "set" : "missing"}</td><td>SEC EDGAR fair-use header</td></tr>
            <tr><td>DATABASE_URL</td><td>{envState.DATABASE_URL ? "set" : "missing"}</td><td>SQLite location</td></tr>
            <tr><td>JOBS_SECRET</td><td>{envState.JOBS_SECRET ? "set" : "missing"}</td><td>Auth for /api/jobs/refresh</td></tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title">Background scheduler</div>
        <p className="text-sm text-muted">
          Set <code>SCHEDULER_ENABLED=1</code> in <code>.env.local</code> to refresh the watchlist
          periodically while the dev server is running. Default interval is 30 minutes
          (<code>SCHEDULER_INTERVAL_MINUTES</code>).
        </p>
        <table className="data mt-3">
          <tbody>
            <tr><td>Enabled</td><td>{sched.enabled ? "yes" : "no"}</td></tr>
            <tr><td>Started in this process</td><td>{sched.started ? "yes" : "no"}</td></tr>
            <tr><td>Interval</td><td>{sched.intervalMinutes} min</td></tr>
            <tr><td>Last tick</td><td>{sched.lastTickAt ?? "—"}</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-muted mt-2">
          You can also trigger refresh manually:{" "}
          <code>curl -X POST -H "x-jobs-secret: $JOBS_SECRET" http://localhost:3001/api/jobs/refresh</code>
        </p>
      </div>
      <div className="card text-sm text-muted">
        <strong className="text-warn">Hard safety rules:</strong> this app never integrates with a
        broker, never executes real trades, and supports paper trading only. No leverage, options,
        CFDs or crypto in v1.
      </div>
    </div>
  );
}
