import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    // Attempt a simple query to check if the database is accessible
    await prisma.user.findFirst();
    console.log("Database is already initialized.");
  } catch (error) {
    console.warn("Database not accessible, running migrations...");
    try {
      // Execute prisma migrate deploy command
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("Prisma migrations deployed successfully.");
    } catch (migrationError) {
      console.error("Failed to deploy Prisma migrations:", migrationError);
      process.exit(1); // Exit if migrations fail
    }
  } finally {
    await prisma.$disconnect();
  }
}

// This script is intended to be run before the Next.js server starts.
// For example, you could add it to your package.json scripts:
// "dev:init": "ts-node scripts/startup.ts && next dev"
// or integrate it into your deployment process.

initializeDatabase();
