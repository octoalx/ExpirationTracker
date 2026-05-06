import type { PrismaConfig } from "prisma";

export default {
  earlyAccess: true,
  schemas: {
    default: {
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    },
  },
} satisfies PrismaConfig;
