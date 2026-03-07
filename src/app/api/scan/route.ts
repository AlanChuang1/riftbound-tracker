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
      text: `This is a photo of a Riftbound (League of Legends TCG) trading card. Identify the card name from the image.

Here is the list of all known cards:
${cardListStr}

Respond with ONLY the exact card name as it appears in the list above. If you cannot identify the card or it's not in the list, respond with "UNKNOWN".`,
    },
  ]);

  const identifiedName = result.response.text().trim();

  if (identifiedName === "UNKNOWN") {
    return NextResponse.json(
      { identified: false, message: "Could not identify the card" },
      { status: 200 }
    );
  }

  const matchedCard = allCards.find(
    (c) => c.name.toLowerCase() === identifiedName.toLowerCase()
  );

  if (!matchedCard) {
    return NextResponse.json(
      {
        identified: false,
        suggestedName: identifiedName,
        message: "Card name identified but no exact match found in database",
      },
      { status: 200 }
    );
  }

  const fullCard = await prisma.card.findUnique({
    where: { id: matchedCard.id },
  });

  return NextResponse.json({ identified: true, card: fullCard });
}
