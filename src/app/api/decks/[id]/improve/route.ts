import { NextRequest, NextResponse } from "next/server";
import { generateWithFallback } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "collection";

  const deck = await prisma.deck.findFirst({
    where: { id, userId },
    include: { cards: { include: { card: true } } },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const deckDescription = deck.cards
    .map(
      (dc) =>
        `${dc.quantity}x ${dc.card.name} (${dc.card.type}, ${dc.card.faction}, Cost: ${dc.card.cost ?? "N/A"}, Power: ${dc.card.power ?? "N/A"}, Rarity: ${dc.card.rarity})`
    )
    .join("\n");

  let collectionSection = "";

  if (mode === "collection") {
    const deckCardIds = deck.cards.map((dc) => dc.cardId);
    const collection = await prisma.collectionCard.findMany({
      where: {
        userId,
        cardId: { notIn: deckCardIds },
      },
      include: { card: true },
    });

    const collectionDescription = collection
      .map(
        (cc) =>
          `${cc.quantity}x ${cc.card.name} (${cc.card.type}, ${cc.card.faction}, Cost: ${cc.card.cost ?? "N/A"}, Power: ${cc.card.power ?? "N/A"}, Rarity: ${cc.card.rarity})`
      )
      .join("\n");

    collectionSection = `### Available cards in collection (not in deck):
${collectionDescription || "No additional cards available"}

**Important:** Only suggest cards from the available collection above.`;
  } else {
    collectionSection = `**Mode:** General advice — suggest the best possible cards regardless of what the user owns. You may recommend any Riftbound card that exists.`;
  }

  const prompt = `You are an expert Riftbound (League of Legends TCG) deck builder and strategist.

## Current Deck: "${deck.name}"
${deck.champion ? `Champion: ${deck.champion}` : "No champion set"}

### Cards in deck:
${deckDescription || "Empty deck"}

${collectionSection}

## Task
Analyze this deck and suggest improvements. Consider:
1. Mana curve optimization
2. Synergies with the deck's champion/theme
3. Cards that should be removed and why
4. Cards that should be added and why
5. Overall strategy tips

Format your response as:
### Deck Analysis
(Brief overview of deck strengths and weaknesses)

### Suggested Swaps
For each swap:
- **Remove:** [Card Name] - [reason]
- **Add:** [Card Name] - [reason]

### Strategy Tips
(2-3 actionable tips for playing this deck better)`;

  const { text: analysis } = await generateWithFallback([prompt]);

  return NextResponse.json({ analysis });
}
