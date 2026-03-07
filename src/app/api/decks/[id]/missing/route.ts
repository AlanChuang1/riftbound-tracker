import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET(
  req: NextRequest,
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

  // Get user's collection
  const collection = await prisma.collectionCard.findMany({
    where: { userId },
    select: { cardId: true, quantity: true },
  });

  const collectionMap = new Map<string, number>();
  for (const cc of collection) {
    collectionMap.set(cc.cardId, (collectionMap.get(cc.cardId) || 0) + cc.quantity);
  }

  // Compare deck needs vs collection
  const missing: { card: typeof deck.cards[0]["card"]; needed: number; owned: number }[] = [];

  for (const dc of deck.cards) {
    const owned = collectionMap.get(dc.cardId) || 0;
    if (owned < dc.quantity) {
      missing.push({
        card: dc.card,
        needed: dc.quantity,
        owned,
      });
    }
  }

  const totalMissing = missing.reduce((sum, m) => sum + (m.needed - m.owned), 0);

  return NextResponse.json({
    missing,
    totalMissing,
    totalDeckCards: deck.cards.reduce((sum, dc) => sum + dc.quantity, 0),
    totalOwned: deck.cards.reduce((sum, dc) => sum + Math.min(dc.quantity, collectionMap.get(dc.cardId) || 0), 0),
  });
}
