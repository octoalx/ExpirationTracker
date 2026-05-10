import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";

function resolveDbPath(): string {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  if (path.isAbsolute(dbPath)) return dbPath;
  return path.join(process.cwd(), dbPath);
}

const adapter = new PrismaBetterSqlite3({ url: resolveDbPath() });
const prisma = new PrismaClient({ adapter });

async function ensureAdmin() {
  const userCount = await prisma.user.count();
  
  if (userCount > 0) {
    console.log("Users exist, skipping default admin creation.");
    return;
  }

  const hashedPassword = await bcrypt.hash("admin", 10);
  
  const admin = await prisma.user.create({
    data: {
      email: "admin@localhost",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log(`Created default admin user: admin@localhost / admin (role: ${admin.role})`);
}

ensureAdmin()
  .catch((e) => {
    console.error("Failed to create admin user:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
