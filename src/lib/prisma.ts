import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Strip pgbouncer=true from the connection string — that's Prisma-only, pg.Pool doesn't understand it
function getPoolConnectionString() {
  const url = process.env.DATABASE_URL!;
  try {
    const u = new URL(url);
    u.searchParams.delete("pgbouncer");
    return u.toString();
  } catch {
    return url;
  }
}

const pool =
  (globalThis as any).prismaPool ||
  new Pool({
    connectionString: getPoolConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg(pool),
  } as any);

if (process.env.NODE_ENV !== "production") {
  (globalThis as any).prisma = prisma;
  (globalThis as any).prismaPool = pool;
}
