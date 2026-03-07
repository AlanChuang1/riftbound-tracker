/**
 * Seed script: pulls all Riftbound card data from the Riftcodex API (free, no auth)
 * and upserts into the database.
 *
 * API: https://api.riftcodex.com
 * Usage: npm run seed
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const BASE_URL = "https://api.riftcodex.com";
const PAGE_SIZE = 100;

interface RiftcodexCard {
  id: string;
  name: string;
  riftbound_id: string;
  public_code: string;
  collector_number: number;
  attributes: {
    energy: number | null;
    might: number | null;
    power: number | null;
  };
  classification: {
    type: string;
    supertype: string | null;
    rarity: string;
    domain: string[];
  };
  text: {
    rich: string;
    plain: string;
  };
  set: {
    set_id: string;
    label: string;
  };
  media: {
    image_url: string;
    artist: string;
    accessibility_text: string;
  };
  tags: string[];
  orientation: string;
  metadata: {
    clean_name: string;
    alternate_art: boolean;
    overnumbered: boolean;
    signature: boolean;
  };
}

interface RiftcodexResponse {
  items: RiftcodexCard[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

function stripRunes(text: string): string {
  // Remove Riftbound rune shortcodes like :rb_exhaust:, :rb_might:, etc.
  return text.replace(/:\w+:/g, "").replace(/<[^>]*>/g, "").trim();
}

async function main() {
  console.log("Fetching card data from Riftcodex API (no auth required)...\n");

  let page = 1;
  let totalPages = 1;
  let upserted = 0;
  let errors = 0;

  do {
    const url = `${BASE_URL}/cards?size=${PAGE_SIZE}&page=${page}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`Riftcodex API error ${res.status} on page ${page}`);
      process.exit(1);
    }

    const json: RiftcodexResponse = await res.json();
    totalPages = json.pages;

    console.log(
      `Page ${page}/${totalPages} — ${json.items.length} cards (${json.total} total)`
    );

    for (const card of json.items) {
      // Skip alternate art / signature variants to avoid duplicates
      if (card.metadata.alternate_art || card.metadata.signature) continue;

      const faction = card.classification.domain?.[0] ?? null;
      const description = stripRunes(card.text.plain);

      const data = {
        riotId: card.riftbound_id,
        name: card.name,
        description: description || null,
        flavorText: null,
        faction,
        type: card.classification.type,
        rarity: card.classification.rarity,
        cost: null, // Riftbound uses energy as the primary cost
        power: card.attributes.power,
        might: card.attributes.might,
        energy: card.attributes.energy,
        set: card.set.label,
        artUrl: card.media.image_url,
        thumbnailUrl: card.media.image_url,
        artist: card.media.artist,
      };

      try {
        await prisma.card.upsert({
          where: { riotId: card.riftbound_id },
          update: data,
          create: data,
        });
        upserted++;
      } catch (err) {
        errors++;
        console.error(`  Error upserting "${card.name}":`, err);
      }
    }

    process.stdout.write(`  ${upserted} cards upserted so far...\r`);
    page++;
  } while (page <= totalPages);

  console.log(
    `\nDone! ${upserted} cards upserted, ${errors} errors.`
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
