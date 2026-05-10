import { PrismaClient, Role } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";

/** Resolve the SQLite database file path from DATABASE_URL env variable. */
function resolveDbPath(): string {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  if (path.isAbsolute(dbPath)) return dbPath;
  return path.join(process.cwd(), dbPath);
}

const adapter = new PrismaBetterSqlite3({ url: resolveDbPath() });
const prisma = new PrismaClient({ adapter });

/** Create default admin user if no users exist in the database. */
async function ensureAdmin() {
  const userCount = await prisma.user.count();
  
  if (userCount > 0) {
    console.log("Users exist, skipping default admin creation.");
    return;
  }

  // Generate a random password for the default admin account
  const randomPass = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  const hashedPassword = await bcrypt.hash(randomPass, 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@localhost",
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`Created default admin user: admin@localhost / ${randomPass} (role: ${admin.role})`);
  console.log("IMPORTANT: Change this password immediately after first login!");
}

ensureAdmin()
  .catch((e) => {
    console.error("Failed to create admin user:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
