import { PrismaClient } from '@prisma/client';

/**
 * Lazily-created Prisma client, gated on DATABASE_URL.
 *
 * Persistence is entirely optional: the live game runs in-memory. Only when a
 * database is configured do we snapshot finished tournaments. `getPrisma()`
 * returns null when no DATABASE_URL is set, so every caller degrades cleanly.
 */
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export function isPersistenceEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma(): PrismaClient | null {
  if (!isPersistenceEnabled()) return null;
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = new PrismaClient();
  }
  return globalForPrisma.__prisma;
}
