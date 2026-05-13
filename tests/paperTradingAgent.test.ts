import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetchQuote BEFORE importing the agent so the agent's import resolves to our mock.
vi.mock("@/data-sources/yahoo", () => ({
  fetchQuote: vi.fn(),
  fetchProfile: vi.fn(),
}));

import { PaperTradingAgent } from "@/agents/PaperTradingAgent";
import { fetchQuote } from "@/data-sources/yahoo";
import { prisma } from "@/lib/db";

const mockQuote = fetchQuote as unknown as ReturnType<typeof vi.fn>;

function setQuote(price: number) {
  mockQuote.mockResolvedValue({
    symbol: "TEST",
    price,
    changePct: 0,
    marketCap: 1e10,
    currency: "USD",
    asOf: new Date().toISOString(),
    source: "mock",
    name: "TEST Inc",
    exchange: "TEST",
    sector: null,
    industry: null,
  });
}

const STARTING_CASH = 100_000;
const COMMISSION_BPS = 2; // = 0.0002
const SLIPPAGE_BPS = 5; // = 0.0005

function buyFill(price: number) {
  return price * (1 + SLIPPAGE_BPS / 10_000);
}
function sellFill(price: number) {
  return price * (1 - SLIPPAGE_BPS / 10_000);
}
function commission(fillPrice: number, qty: number) {
  return (COMMISSION_BPS / 10_000) * fillPrice * qty;
}

describe("PaperTradingAgent", () => {
  beforeEach(() => {
    mockQuote.mockReset();
  });

  it("buy creates a position with slippage-adjusted fill price and decrements cash by gross+commission", async () => {
    setQuote(100);
    const res = await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 10 });
    expect(res.ok).toBe(true);

    const expectedFill = buyFill(100);
    const expectedComm = commission(expectedFill, 10);

    expect(res.data!.fillPrice).toBeCloseTo(expectedFill, 6);
    expect(res.data!.commission).toBeCloseTo(expectedComm, 6);
    expect(res.data!.realizedPnL).toBe(0);

    const acc = await prisma.paperAccount.findUnique({ where: { id: "default" } });
    expect(acc!.cash).toBeCloseTo(STARTING_CASH - expectedFill * 10 - expectedComm, 4);

    const pos = await prisma.paperPosition.findUnique({ where: { symbol: "TEST" } });
    expect(pos!.quantity).toBe(10);
    expect(pos!.avgPrice).toBeCloseTo(expectedFill, 6);
  });

  it("rejects a buy when cost exceeds available cash", async () => {
    setQuote(20_000); // 10 shares = $200k + slip + commission, more than $100k cash
    const res = await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 10 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Insufficient cash/i);

    const pos = await prisma.paperPosition.findUnique({ where: { symbol: "TEST" } });
    expect(pos).toBeNull();
    const acc = await prisma.paperAccount.findUnique({ where: { id: "default" } });
    expect(acc!.cash).toBe(STARTING_CASH); // unchanged
  });

  it("averages cost correctly across multiple buys at different prices", async () => {
    setQuote(100);
    await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 10 });
    setQuote(200);
    await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 10 });

    const pos = await prisma.paperPosition.findUnique({ where: { symbol: "TEST" } });
    expect(pos!.quantity).toBe(20);
    // weighted avg of the two slippage-adjusted fills
    const expectedAvg = (buyFill(100) * 10 + buyFill(200) * 10) / 20;
    expect(pos!.avgPrice).toBeCloseTo(expectedAvg, 6);
  });

  it("sell realizes P&L = (sellFill - avgCost) * qty - commission, and increments cash by gross - commission", async () => {
    setQuote(100);
    const buy = await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 10 });
    expect(buy.ok).toBe(true);

    setQuote(120);
    const sell = await PaperTradingAgent({ symbol: "TEST", side: "sell", quantity: 10 });
    expect(sell.ok).toBe(true);

    const expectedSellFill = sellFill(120);
    const expectedSellComm = commission(expectedSellFill, 10);
    const expectedRealized = (expectedSellFill - buyFill(100)) * 10 - expectedSellComm;

    expect(sell.data!.fillPrice).toBeCloseTo(expectedSellFill, 6);
    expect(sell.data!.commission).toBeCloseTo(expectedSellComm, 6);
    expect(sell.data!.realizedPnL).toBeCloseTo(expectedRealized, 4);

    // Cash math: starting - buyCost - buyComm + sellGross - sellComm
    const buyCost = buyFill(100) * 10;
    const buyComm = commission(buyFill(100), 10);
    const sellGross = expectedSellFill * 10;
    const acc = await prisma.paperAccount.findUnique({ where: { id: "default" } });
    expect(acc!.cash).toBeCloseTo(STARTING_CASH - buyCost - buyComm + sellGross - expectedSellComm, 4);
  });

  it("rejects sell beyond held quantity (no shorting in v1)", async () => {
    setQuote(100);
    await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 5 });

    setQuote(110);
    const res = await PaperTradingAgent({ symbol: "TEST", side: "sell", quantity: 10 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no shorting/i);

    const pos = await prisma.paperPosition.findUnique({ where: { symbol: "TEST" } });
    expect(pos!.quantity).toBe(5); // unchanged
  });

  it("selling exact held quantity removes the position row", async () => {
    setQuote(100);
    await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 5 });
    await PaperTradingAgent({ symbol: "TEST", side: "sell", quantity: 5 });

    const pos = await prisma.paperPosition.findUnique({ where: { symbol: "TEST" } });
    expect(pos).toBeNull();
  });

  it("partial sells leave the average cost unchanged on the remaining lot", async () => {
    setQuote(100);
    await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 10 });

    setQuote(110);
    await PaperTradingAgent({ symbol: "TEST", side: "sell", quantity: 4 });

    const pos = await prisma.paperPosition.findUnique({ where: { symbol: "TEST" } });
    expect(pos!.quantity).toBe(6);
    expect(pos!.avgPrice).toBeCloseTo(buyFill(100), 6); // avg cost preserved
  });

  it("records a paperTrade row per action with side + price + commission stored", async () => {
    setQuote(100);
    await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 3, notes: "from-test" });
    setQuote(105);
    await PaperTradingAgent({ symbol: "TEST", side: "sell", quantity: 3 });

    const trades = await prisma.paperTrade.findMany({ orderBy: { executedAt: "asc" } });
    expect(trades).toHaveLength(2);
    expect(trades[0].side).toBe("buy");
    expect(trades[0].notes).toBe("from-test");
    expect(trades[0].realizedPnL).toBe(0);
    expect(trades[1].side).toBe("sell");
    expect(trades[1].realizedPnL).toBeGreaterThan(0); // price went up
    expect(trades[1].commission).toBeGreaterThan(0);
  });

  it("writes an AgentLog entry for every invocation (ok and error paths)", async () => {
    setQuote(100);
    await PaperTradingAgent({ symbol: "TEST", side: "buy", quantity: 1 });
    await PaperTradingAgent({ symbol: "TEST", side: "sell", quantity: 5 }); // fails: only 1 held

    const logs = await prisma.agentLog.findMany({ where: { agent: "PaperTradingAgent" } });
    expect(logs).toHaveLength(2);
    const ok = logs.find((l) => l.status === "ok");
    const err = logs.find((l) => l.status === "error");
    expect(ok).toBeTruthy();
    expect(err).toBeTruthy();
    expect(err!.error).toMatch(/no shorting/i);
  });

  it("safety: no real-broker SDK is reachable from PaperTradingAgent", async () => {
    // This is a structural sanity test, not a behavior test. The agent module
    // should only depend on local DB + yahoo (mocked here). If anyone adds a
    // broker SDK to the dependency tree, this assertion is the canary.
    const mod = await import("@/agents/PaperTradingAgent");
    const src = (mod as any).PaperTradingAgent.toString();
    // Verify the agent doesn't reference any known broker SDK keywords
    expect(src).not.toMatch(/alpaca/i);
    expect(src).not.toMatch(/interactivebrokers/i);
    expect(src).not.toMatch(/ibkr/i);
    expect(src).not.toMatch(/tradier/i);
  });
});
