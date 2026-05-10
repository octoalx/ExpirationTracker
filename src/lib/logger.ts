import { prisma } from "./prisma";

function write(level: string, message: string, meta?: Record<string, unknown>): void {
  prisma.systemLog
    .create({
      data: {
        level,
        message,
        meta: meta ? JSON.stringify(meta) : null,
      },
    })
    .catch((err) => console.error("[Logger] Failed to write log:", err));
}

export const logger = {
  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, meta ?? "");
    write("ERROR", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, meta ?? "");
    write("WARN", message, meta);
  },
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, meta ?? "");
    write("INFO", message, meta);
  },
};
