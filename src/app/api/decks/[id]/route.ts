import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;

  const deck = await prisma.deck.findFirst({
    where: { id, userId },
    include: { cards: { include: { card: true } } },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json(deck);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;
  const { name, description, champion, cards } = await req.json();

  const deck = await prisma.deck.findFirst({ where: { id, userId } });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (cards) {
      await tx.deckCard.deleteMany({ where: { deckId: id } });
      await tx.deckCard.createMany({
        data: cards.map((c: { cardId: string; quantity: number }) => ({
          deckId: id,
          cardId: c.cardId,
          quantity: c.quantity || 1,
        })),
      });
    }

    return tx.deck.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(champion !== undefined && { champion }),
      },
      include: { cards: { include: { card: true } } },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;

  await prisma.deck.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
