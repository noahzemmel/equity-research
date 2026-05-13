import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const StartingCash = Number(process.env.PAPER_STARTING_CASH ?? 100_000);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "RESET") {
    return NextResponse.json(
      { ok: false, error: "Pass confirm: \"RESET\" to reset the paper account." },
      { status: 400 },
    );
  }
  await prisma.paperPosition.deleteMany();
  await prisma.paperTrade.deleteMany();
  await prisma.paperAccount.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      startingCash: StartingCash,
      cash: StartingCash,
      commissionBps: Number(process.env.PAPER_COMMISSION_BPS ?? 2),
      slippageBps: Number(process.env.PAPER_SLIPPAGE_BPS ?? 5),
    },
    update: { startingCash: StartingCash, cash: StartingCash },
  });
  return NextResponse.json({ ok: true });
}
