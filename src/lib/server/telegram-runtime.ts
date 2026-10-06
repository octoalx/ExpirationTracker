import { prisma } from "../prisma";
import { telegramTransport } from "./telegram-transport";
import { processInbox, processDeliveries, scheduleTelegram } from "./telegram-jobs";
import { logger } from "../logger";

const runtime = globalThis as typeof globalThis & { telegramRunning?: boolean; telegramRestore?: boolean };
export function suspendTelegram() {
  if (runtime.telegramRunning) return false;
  runtime.telegramRestore = true;
  return true;
}
export function resumeTelegramRuntime() { runtime.telegramRestore = false; }
export async function tickTelegram(schedule = false) {
  if (process.env.DISABLE_BACKGROUND_JOBS === "true" || !process.env.TELEGRAM_BOT_TOKEN || runtime.telegramRunning || runtime.telegramRestore) return;
  runtime.telegramRunning = true;
  try {
    const transport = telegramTransport();
    if (schedule) await scheduleTelegram(prisma);
    await processInbox(prisma, transport);
    await processDeliveries(prisma, transport);
  } catch {
    logger.error("Telegram worker failed", { context: "Telegram" });
  } finally { runtime.telegramRunning = false; }
}
