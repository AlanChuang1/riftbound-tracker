import { NextRequest, NextResponse } from "next/server";
import { geminiFlash } from "@/lib/gemini";
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

  const result = await geminiFlash.generateContent([
    {
      inlineData: { mimeType, data: base64 },
    },
    {
      text: `This is a photo that may contain one or more Riftbound (League of Legends TCG) trading cards. Identify ALL card names visible in the image.

Here is the list of all known cards:
${cardListStr}

Respond with a JSON array of the exact card names as they appear in the list above. For example: ["Card Name 1", "Card Name 2"]
If you cannot identify any cards, respond with: []
Only include cards you are confident about.`,
    },
  ]);

  const responseText = result.response.text().trim();

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

  if (matchedCards.length === 0) {
    return NextResponse.json({
      identified: false,
      cards: [],
      suggestedNames: identifiedNames,
      message: "Card names identified but no exact matches found in database",
    });
  }

  const fullCards = await prisma.card.findMany({
    where: { id: { in: matchedCards } },
  });

  return NextResponse.json({
    identified: true,
    cards: fullCards,
  });
}
