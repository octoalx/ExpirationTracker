import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { ensureWalMode } from "./server/sqlite-health";

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
  // WAL is a persistent database property, but anything that opens the file with
  // different settings (a repair script, a restored snapshot) can silently reset
  // it, so it is re-asserted here rather than assumed. This covers code paths that
  // build a client without the instrumentation hook having run first (test
  // harnesses, one-off scripts).
  try {
    ensureWalMode(absolutePath);
  } catch (err) {
    console.warn("[Database] Could not enable WAL:", String(err));
  }
  const adapter = new PrismaBetterSqlite3({ url: absolutePath });
  return new PrismaClient({ adapter });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
