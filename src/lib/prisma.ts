import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

function resolvePrismaDbPath(): string {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  if (path.isAbsolute(dbPath)) return dbPath;
  // Prisma resolves relative paths from the prisma/ directory (schema location)
  const fromPrismaDir = path.join(process.cwd(), "prisma", dbPath);
  const fromCwd = path.join(process.cwd(), dbPath);
  const fs = require("fs");
  if (fs.existsSync(fromPrismaDir)) return fromPrismaDir;
  return fromCwd;
}

function createPrismaClient() {
  const absolutePath = resolvePrismaDbPath();
  const adapter = new PrismaBetterSqlite3({ url: absolutePath });
  return new PrismaClient({ adapter });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
