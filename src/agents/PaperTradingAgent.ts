import { defineAgent, z } from "./base";
import { prisma } from "@/lib/db";
import { fetchQuote } from "@/data-sources/yahoo";

const Input = z.object({
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
  ideaId: z.string().optional(),
  notes: z.string().optional(),
});
const Output = z.object({
  tradeId: z.string(),
  symbol: z.string(),
  side: z.string(),
  quantity: z.number(),
  fillPrice: z.number(),
  commission: z.number(),
  realizedPnL: z.number(),
  cashAfter: z.number(),
});

/**
 * Executes a paper trade against the simulated account.
 *
 * SAFETY: this only writes to local DB tables. There is no broker SDK, no API
 * call to any external trading venue, and no code path that could be repurposed
 * to send real orders. See `feedback_no_real_trading.md` in memory.
 */
export const PaperTradingAgent = defineAgent({
  name: "PaperTradingAgent",
  input: Input,
  output: Output,
  async run({ symbol, side, quantity, ideaId, notes }) {
    const sym = symbol.toUpperCase();
    const account = await prisma.paperAccount.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        startingCash: Number(process.env.PAPER_STARTING_CASH ?? 100_000),
        cash: Number(process.env.PAPER_STARTING_CASH ?? 100_000),
        commissionBps: Number(process.env.PAPER_COMMISSION_BPS ?? 2),
        slippageBps: Number(process.env.PAPER_SLIPPAGE_BPS ?? 5),
      },
      update: {},
    });

    const quote = await fetchQuote(sym);
    const slippage = (account.slippageBps / 10_000) * quote.price;
    const fillPrice = side === "buy" ? quote.price + slippage : quote.price - slippage;
    const gross = fillPrice * quantity;
    const commission = (account.commissionBps / 10_000) * gross;

    // Position math
    const position = await prisma.paperPosition.findUnique({ where: { symbol: sym } });
    let realizedPnL = 0;
    if (side === "buy") {
      if (gross + commission > account.cash) {
        throw new Error(
          `Insufficient cash. Need $${(gross + commission).toFixed(2)}, have $${account.cash.toFixed(2)}.`,
        );
      }
      if (position) {
        const newQty = position.quantity + quantity;
        const newAvg = (position.avgPrice * position.quantity + fillPrice * quantity) / newQty;
        await prisma.paperPosition.update({
          where: { symbol: sym },
          data: { quantity: newQty, avgPrice: newAvg },
        });
      } else {
        await prisma.ticker.upsert({ where: { symbol: sym }, create: { symbol: sym }, update: {} });
        await prisma.paperPosition.create({
          data: { symbol: sym, quantity, avgPrice: fillPrice },
        });
      }
      await prisma.paperAccount.update({
        where: { id: "default" },
        data: { cash: account.cash - gross - commission },
      });
    } else {
      // sell
      if (!position || position.quantity < quantity) {
        throw new Error(`Cannot sell ${quantity} of ${sym}; only ${position?.quantity ?? 0} held (no shorting in v1).`);
      }
      realizedPnL = (fillPrice - position.avgPrice) * quantity - commission;
      const newQty = position.quantity - quantity;
      if (newQty <= 0) {
        await prisma.paperPosition.delete({ where: { symbol: sym } });
      } else {
        await prisma.paperPosition.update({
          where: { symbol: sym },
          data: { quantity: newQty },
        });
      }
      await prisma.paperAccount.update({
        where: { id: "default" },
        data: { cash: account.cash + gross - commission },
      });
    }

    const trade = await prisma.paperTrade.create({
      data: {
        symbol: sym,
        side,
        quantity,
        price: fillPrice,
        commission,
        notes: notes ?? null,
        ideaId: ideaId ?? null,
        realizedPnL,
      },
    });
    const refreshed = await prisma.paperAccount.findUnique({ where: { id: "default" } });
    return {
      tradeId: trade.id,
      symbol: sym,
      side,
      quantity,
      fillPrice,
      commission,
      realizedPnL,
      cashAfter: refreshed?.cash ?? 0,
    };
  },
});
