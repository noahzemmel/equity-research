import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Patch = z.object({ status: z.enum(["open", "acted", "dismissed", "expired"]) });

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const json = await req.json().catch(() => ({}));
  const parsed = Patch.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  const idea = await prisma.tradeIdea.update({ where: { id: ctx.params.id }, data: parsed.data });
  return NextResponse.json({ ok: true, idea });
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  await prisma.tradeIdea.delete({ where: { id: ctx.params.id } });
  return NextResponse.json({ ok: true });
}
