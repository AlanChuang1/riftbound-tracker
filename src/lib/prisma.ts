import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const pool =
  (globalThis as any).prismaPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL!,
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
