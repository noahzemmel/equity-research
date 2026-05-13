import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

/**
 * Runs once before the whole test suite. Wipes any prior test DB and
 * re-applies the Prisma schema against the dedicated test SQLite file.
 */
export async function setup() {
  const testDb = path.resolve(__dirname, "..", "prisma", "test.db");
  if (existsSync(testDb)) unlinkSync(testDb);

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });
}

export async function teardown() {
  // Keep the file around for post-mortem; comment out the next line to retain it.
  const testDb = path.resolve(__dirname, "..", "prisma", "test.db");
  if (existsSync(testDb)) unlinkSync(testDb);
}
