import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computePortfolio } from "@/lib/portfolio";

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const stats = await computePortfolio(refresh);
  const trades = await prisma.paperTrade.findMany({
    orderBy: { executedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ stats, trades });
}
