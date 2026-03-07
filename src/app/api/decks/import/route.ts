import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;
  const { name, deckList } = await req.json();

  if (!name || !deckList) {
    return NextResponse.json(
      { error: "name and deckList are required" },
      { status: 400 }
    );
  }

  // Parse deck list format: "2x Card Name" or "2 Card Name" per line
  const lines = (deckList as string)
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l && !l.startsWith("#") && !l.startsWith("//"));

  const parsedCards: { name: string; quantity: number }[] = [];
  for (const line of lines) {
    const match = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (match) {
      parsedCards.push({ quantity: parseInt(match[1]), name: match[2].trim() });
    } else {
      // Treat as 1x card
      parsedCards.push({ quantity: 1, name: line });
    }
  }

  if (parsedCards.length === 0) {
    return NextResponse.json(
      { error: "No valid cards found in deck list" },
      { status: 400 }
    );
  }

  // Match card names to database
  const allCards = await prisma.card.findMany({
    select: { id: true, name: true },
  });

  const matched: { cardId: string; quantity: number; name: string }[] = [];
  const unmatched: string[] = [];

  for (const pc of parsedCards) {
    const card = allCards.find(
      (c) => c.name.toLowerCase() === pc.name.toLowerCase()
    );
    if (card) {
      matched.push({ cardId: card.id, quantity: pc.quantity, name: card.name });
    } else {
      unmatched.push(pc.name);
    }
  }

  // Create deck with matched cards
  const deck = await prisma.deck.create({
    data: {
      userId,
      name,
      cards: {
        create: matched.map((m) => ({
          cardId: m.cardId,
          quantity: m.quantity,
        })),
      },
    },
    include: { cards: { include: { card: true } } },
  });

  return NextResponse.json({
    deck,
    matched: matched.length,
    unmatched,
  });
}
