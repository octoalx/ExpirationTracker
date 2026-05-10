import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

/** Resolves the absolute path to the SQLite database file from `DATABASE_URL`. */
export function resolvePrismaDbPath(): string {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  if (path.isAbsolute(dbPath)) return dbPath;
  return path.join(process.cwd(), dbPath);
}

/** Creates a PrismaClient instance backed by the better-sqlite3 adapter. */
function createPrismaClient() {
  const absolutePath = resolvePrismaDbPath();
  const adapter = new PrismaBetterSqlite3({ url: absolutePath });
  return new PrismaClient({ adapter });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
