import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

/** Check database accessibility; run Prisma migrations if needed. */
async function initializeDatabase() {
  try {
    // Verify database is accessible with a simple query
    await prisma.user.findFirst();
    console.log("Database is already initialized.");
  } catch (error) {
    console.warn("Database not accessible, running migrations...");
    try {
      // Deploy pending Prisma migrations
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("Prisma migrations deployed successfully.");
    } catch (migrationError) {
      console.error("Failed to deploy Prisma migrations:", migrationError);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run before the Next.js server starts to ensure DB is ready.

initializeDatabase();
