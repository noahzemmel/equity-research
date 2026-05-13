import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(_req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  await prisma.watchlistItem.deleteMany({ where: { symbol } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: { params: { symbol: string } }) {
  const symbol = ctx.params.symbol.toUpperCase();
  const body = await req.json().catch(() => ({}));
  const notes = typeof body?.notes === "string" ? body.notes : undefined;
  const item = await prisma.watchlistItem.update({ where: { symbol }, data: { notes } });
  return NextResponse.json({ ok: true, item });
}
