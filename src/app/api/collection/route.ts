import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET() {
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;

  const collection = await prisma.collectionCard.findMany({
    where: { userId },
    include: { card: true },
    orderBy: { card: { name: "asc" } },
  });

  return NextResponse.json(collection);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;
  const { cardId, quantity = 1, variant = "Base" } = await req.json();

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  const entry = await prisma.collectionCard.upsert({
    where: {
      userId_cardId_variant: { userId, cardId, variant },
    },
    update: { quantity: { increment: quantity } },
    create: { userId, cardId, quantity, variant },
    include: { card: true },
  });

  return NextResponse.json(entry);
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession();
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.collectionCard.deleteMany({
    where: { id, userId },
  });

  return NextResponse.json({ success: true });
}
