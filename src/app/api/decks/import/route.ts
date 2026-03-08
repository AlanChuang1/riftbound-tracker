import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const RUNE_DOMAINS = ["Calm", "Chaos", "Order", "Mind", "Fury", "Body"];

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

  // Parse sectioned deck list format
  const lines = (deckList as string).split("\n").map((l: string) => l.trim());

  let currentSection = "MainDeck";
  const sections: Record<string, { name: string; quantity: number }[]> = {
    Legend: [],
    Champion: [],
    MainDeck: [],
    Battlefields: [],
    RunePool: [],
  };

  for (const line of lines) {
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    // Check for section headers
    const headerMatch = line.match(/^(Legend|Champion|MainDeck|Main\s*Deck|Battlefields|Rune\s*Pool)\s*:?\s*$/i);
    if (headerMatch) {
      const header = headerMatch[1].replace(/\s+/g, "");
      if (/legend/i.test(header)) currentSection = "Legend";
      else if (/champion/i.test(header)) currentSection = "Champion";
      else if (/main/i.test(header)) currentSection = "MainDeck";
      else if (/battlefield/i.test(header)) currentSection = "Battlefields";
      else if (/rune/i.test(header)) currentSection = "RunePool";
      continue;
    }

    // Parse card line: "2x Card Name" or "2 Card Name" or "Card Name"
    const match = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (match) {
      sections[currentSection].push({
        quantity: parseInt(match[1]),
        name: match[2].trim(),
      });
    } else {
      sections[currentSection].push({ quantity: 1, name: line });
    }
  }

  // Parse rune pool
  const runes: Record<string, number> = {};
  for (const entry of sections.RunePool) {
    const runeDomain = RUNE_DOMAINS.find(
      (d) => entry.name.toLowerCase().includes(d.toLowerCase())
    );
    if (runeDomain) {
      runes[runeDomain] = (runes[runeDomain] || 0) + entry.quantity;
    }
  }

  // Combine all card entries (non-rune) for matching
  const cardEntries = [
    ...sections.Legend,
    ...sections.Champion,
    ...sections.MainDeck,
    ...sections.Battlefields,
  ];

  if (cardEntries.length === 0 && Object.keys(runes).length === 0) {
    return NextResponse.json(
      { error: "No valid cards found in deck list" },
      { status: 400 }
    );
  }

  // Match card names to database
  const allCards = await prisma.card.findMany({
    select: { id: true, name: true, type: true, supertype: true },
  });

  const matched: { cardId: string; quantity: number; name: string }[] = [];
  const unmatched: string[] = [];

  for (const entry of cardEntries) {
    const card = allCards.find(
      (c) => c.name.toLowerCase() === entry.name.toLowerCase()
    );
    if (card) {
      matched.push({ cardId: card.id, quantity: entry.quantity, name: card.name });
    } else {
      unmatched.push(entry.name);
    }
  }

  // Determine champion name from matched Champion section entries
  const championEntry = sections.Champion[0];
  const championName = championEntry
    ? allCards.find((c) => c.name.toLowerCase() === championEntry.name.toLowerCase())?.name || championEntry.name
    : undefined;

  // Create deck with matched cards
  const deck = await prisma.deck.create({
    data: {
      userId,
      name,
      champion: championName,
      runes: Object.keys(runes).length > 0 ? runes : undefined,
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
