import dotenv from 'dotenv';
dotenv.config();

// Clean any surrounding quotes or accidental whitespace (e.g. from Render dashboard input)
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, '').trim();
}
if (process.env.MONGODB_URI) {
  process.env.MONGODB_URI = process.env.MONGODB_URI.trim().replace(/^["']|["']$/g, '').trim();
}

const mongoFallback =
  (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb') ? process.env.MONGODB_URI : null) ||
  'mongodb+srv://mkdigitalnexus_db_user:vFxCATzlPDGMdPR1@cluster0.9d3mp7l.mongodb.net/vf_wallet?retryWrites=true&w=majority';

// If DATABASE_URL is missing or still set to legacy postgresql, ensure it uses MongoDB
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('mongodb')) {
  process.env.DATABASE_URL = mongoFallback;
}

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Executes a Prisma database operation with automatic retry on connection drops (e.g. Neon idle pool timeout).
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const isConnectionError =
        error?.message?.includes('Closed') ||
        error?.message?.includes('connection') ||
        error?.message?.includes('terminating connection') ||
        error?.code === 'P1001' ||
        error?.code === 'P1017';

      if (isConnectionError && attempt <= retries) {
        console.warn(`[Prisma] Connection closed or timeout. Reconnecting (attempt ${attempt}/${retries})...`);
        await prisma.$disconnect().catch(() => {});
        await prisma.$connect().catch(() => {});
        continue;
      }
      throw error;
    }
  }
}

export default prisma;

