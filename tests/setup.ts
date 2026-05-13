import { beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";

beforeEach(async () => {
  // Wipe in FK-safe order before each test.
  await prisma.paperTrade.deleteMany();
  await prisma.paperPosition.deleteMany();
  await prisma.tradeIdea.deleteMany();
  await prisma.researchReport.deleteMany();
  await prisma.newsItem.deleteMany();
  await prisma.filing.deleteMany();
  await prisma.quoteSnapshot.deleteMany();
  await prisma.watchlistItem.deleteMany();
  await prisma.agentLog.deleteMany();
  await prisma.paperAccount.deleteMany();
  await prisma.ticker.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
