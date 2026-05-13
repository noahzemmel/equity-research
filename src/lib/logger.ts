import { prisma } from "./db";

export async function logAgent(args: {
  agent: string;
  symbol?: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  status: "ok" | "error";
  error?: string;
  sources?: string[];
}) {
  try {
    await prisma.agentLog.create({
      data: {
        agent: args.agent,
        symbol: args.symbol ?? null,
        input: JSON.stringify(args.input ?? {}),
        output: JSON.stringify(args.output ?? {}),
        durationMs: args.durationMs,
        status: args.status,
        error: args.error ?? null,
        sources: args.sources ? JSON.stringify(args.sources) : null,
      },
    });
  } catch (e) {
    console.error("[logAgent] failed:", e);
  }
}
