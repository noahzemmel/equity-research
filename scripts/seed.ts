import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Tiny .env loader so we don't need a runtime dotenv dep just for scripts.
for (const file of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    if (process.env[k]) continue;
    let v = vRaw.trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "").trim(); // strip inline # comment on unquoted values
    process.env[k] = v;
  }
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const seedSymbols = [
    { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology" },
    { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", sector: "Technology" },
    { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", sector: "Technology" },
  ];
  for (const t of seedSymbols) {
    await prisma.ticker.upsert({
      where: { symbol: t.symbol },
      create: t,
      update: t,
    });
    await prisma.watchlistItem.upsert({
      where: { symbol: t.symbol },
      create: { symbol: t.symbol, notes: "Seeded" },
      update: {},
    });
  }
  await prisma.paperAccount.upsert({
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
  console.log("Seeded watchlist + default paper account.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
