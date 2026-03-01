import { PrismaClient } from "@prisma/client";

/**
 * Database Instantiation Utility
 * 
 * In development, Next.js clears the Node cache on every file change. 
 * If we instantiate a new PrismaClient normally, hot-reloading will rapidly exhaust 
 * the database connection pool. 
 * 
 * To solve this, we cache the PrismaClient instance on the `globalThis` object.
 * This ensures only ONE connection is reused across the entire development session.
 */

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === "development"
                ? ["query", "error", "warn"]
                : ["error"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
