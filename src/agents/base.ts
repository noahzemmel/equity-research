import { z, ZodSchema } from "zod";
import { logAgent } from "@/lib/logger";

export type AgentContext = {
  symbol?: string;
  sources?: string[];
};

export type AgentResult<O> = {
  ok: boolean;
  data?: O;
  error?: string;
  durationMs: number;
  agent: string;
};

/**
 * defineAgent wraps a typed step in:
 *  - zod validation of input + output
 *  - timing
 *  - DB-backed audit log via AgentLog
 *  - error capture (returns ok=false instead of throwing)
 */
export function defineAgent<I, O>(args: {
  name: string;
  input: ZodSchema<I>;
  output: ZodSchema<O>;
  run: (input: I, ctx: AgentContext) => Promise<O>;
}) {
  return async (rawInput: unknown, ctx: AgentContext = {}): Promise<AgentResult<O>> => {
    const t0 = Date.now();
    const parsed = args.input.safeParse(rawInput);
    if (!parsed.success) {
      const error = `Input validation failed for ${args.name}: ${JSON.stringify(parsed.error.flatten())}`;
      const durationMs = Date.now() - t0;
      await logAgent({
        agent: args.name,
        symbol: ctx.symbol,
        input: rawInput,
        output: { error },
        durationMs,
        status: "error",
        error,
        sources: ctx.sources,
      });
      return { ok: false, error, durationMs, agent: args.name };
    }
    try {
      const out = await args.run(parsed.data, ctx);
      const outParse = args.output.safeParse(out);
      if (!outParse.success) {
        const error = `Output validation failed for ${args.name}: ${JSON.stringify(outParse.error.flatten())}`;
        const durationMs = Date.now() - t0;
        await logAgent({
          agent: args.name,
          symbol: ctx.symbol,
          input: rawInput,
          output: out,
          durationMs,
          status: "error",
          error,
          sources: ctx.sources,
        });
        return { ok: false, error, durationMs, agent: args.name };
      }
      const durationMs = Date.now() - t0;
      await logAgent({
        agent: args.name,
        symbol: ctx.symbol,
        input: rawInput,
        output: outParse.data,
        durationMs,
        status: "ok",
        sources: ctx.sources,
      });
      return { ok: true, data: outParse.data, durationMs, agent: args.name };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const durationMs = Date.now() - t0;
      await logAgent({
        agent: args.name,
        symbol: ctx.symbol,
        input: rawInput,
        output: { error: msg },
        durationMs,
        status: "error",
        error: msg,
        sources: ctx.sources,
      });
      return { ok: false, error: msg, durationMs, agent: args.name };
    }
  };
}

export { z };
