import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const faction = searchParams.get("faction") || "";
  const type = searchParams.get("type") || "";
  const rarity = searchParams.get("rarity") || "";
  const set = searchParams.get("set") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "24");

  const where: Record<string, unknown> = {};

  if (query) {
    where.name = { contains: query, mode: "insensitive" };
  }
  if (faction) where.faction = faction;
  if (type) where.type = type;
  if (rarity) where.rarity = rarity;
  if (set) where.set = set;

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.card.count({ where }),
  ]);

  return NextResponse.json({
    cards,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
