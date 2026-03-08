import { NextRequest, NextResponse } from "next/server";
import { generateWithFallback } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const image = formData.get("image") as File;

  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const bytes = await image.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = image.type;

  // Get all card names for matching
  const allCards = await prisma.card.findMany({
    select: { id: true, name: true, set: true },
  });

  const cardListStr = allCards.map((c) => `${c.name} (${c.set})`).join("\n");

  const { text: responseText, model: usedModel } = await generateWithFallback([
    {
      inlineData: { mimeType, data: base64 },
    },
    {
      text: `This is a photo that may contain one or more Riftbound (League of Legends TCG) trading cards. Identify ALL card names visible in the image.

Here is the list of all known cards:
${cardListStr}

Respond with a JSON array of the exact card names as they appear in the list above. If there are multiple copies of the same card, include the name multiple times. For example: ["Card Name 1", "Card Name 1", "Card Name 2"]
If you cannot identify any cards, respond with: []
Only include cards you are confident about.`,
    },
  ]);

  console.log(`Scan used model: ${usedModel}`);

  // Parse the JSON array from the response
  let identifiedNames: string[] = [];
  try {
    const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
    identifiedNames = JSON.parse(cleaned);
    if (!Array.isArray(identifiedNames)) identifiedNames = [];
  } catch {
    // Fallback: try single card name
    if (responseText && responseText !== "UNKNOWN" && responseText !== "[]") {
      identifiedNames = [responseText.replace(/[[\]"]/g, "").trim()];
    }
  }

  if (identifiedNames.length === 0) {
    return NextResponse.json({
      identified: false,
      cards: [],
      message: "Could not identify any cards",
    });
  }

  // Match names to database cards
  const matchedCards = identifiedNames
    .map((name) => allCards.find((c) => c.name.toLowerCase() === name.toLowerCase()))
    .filter(Boolean)
    .map((c) => c!.id);

  // For unmatched names, try fuzzy matching
  const unmatchedNames = identifiedNames.filter(
    (name) => !allCards.find((c) => c.name.toLowerCase() === name.toLowerCase())
  );

  let suggestions: typeof fullCards = [];
  if (unmatchedNames.length > 0) {
    // Find cards whose names contain parts of the guessed name
    const fuzzyIds = new Set<string>();
    for (const name of unmatchedNames) {
      const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      for (const card of allCards) {
        const cardLower = card.name.toLowerCase();
        if (
          cardLower.includes(name.toLowerCase()) ||
          name.toLowerCase().includes(cardLower) ||
          words.some((w) => cardLower.includes(w))
        ) {
          fuzzyIds.add(card.id);
        }
      }
    }
    if (fuzzyIds.size > 0) {
      suggestions = await prisma.card.findMany({
        where: { id: { in: [...fuzzyIds] } },
        take: 10,
      });
    }
  }

  if (matchedCards.length === 0 && suggestions.length === 0) {
    return NextResponse.json({
      identified: false,
      cards: [],
      suggestedNames: identifiedNames,
      message: "Card names identified but no matches found in database",
    });
  }

  // Fetch unique card data, then expand back to include duplicates
  const uniqueIds = [...new Set(matchedCards)];
  const uniqueCards = uniqueIds.length > 0
    ? await prisma.card.findMany({ where: { id: { in: uniqueIds } } })
    : [];
  const cardMap = new Map(uniqueCards.map((c) => [c.id, c]));
  const fullCards = matchedCards.map((id) => cardMap.get(id)).filter(Boolean);

  return NextResponse.json({
    identified: fullCards.length > 0,
    cards: fullCards,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    suggestedNames: unmatchedNames.length > 0 ? unmatchedNames : undefined,
  });
}
