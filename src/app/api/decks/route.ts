import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET() {
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;

  const decks = await prisma.deck.findMany({
    where: { userId },
    include: {
      cards: { include: { card: true } },
      _count: { select: { cards: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(decks);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;
  const { name, description, champion } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const deck = await prisma.deck.create({
    data: { userId, name, description, champion },
  });

  return NextResponse.json(deck, { status: 201 });
}
