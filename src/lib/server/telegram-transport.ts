import { Telegram } from "telegraf";
export type BotButtons = Array<Array<{ text: string; callback_data: string; url?: never } | { text: string; url: string; callback_data?: never }>>;

export interface BotTransport {
  send(chatId: string, text: string, buttons?: BotButtons): Promise<{ message_id: number }>;
  edit(chatId: string, messageId: number, text: string, buttons: BotButtons): Promise<unknown>;
  answer(callbackId: string, text?: string): Promise<unknown>;
}

export function telegramTransport(): BotTransport {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram is not configured");
  const telegram = new Telegram(token);
  const options = () => ({ signal: AbortSignal.timeout(15000) as unknown as Parameters<typeof telegram.callApi>[2]["signal"] });
  return { send: (chatId, text, buttons) => telegram.callApi("sendMessage", { chat_id: chatId, text,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}) }, options()),
    edit: (chatId, messageId, text, buttons) => telegram.callApi("editMessageText", { chat_id: chatId, message_id: messageId, text,
      reply_markup: { inline_keyboard: buttons } }, options()),
    answer: (callbackId, text) => telegram.callApi("answerCallbackQuery", { callback_query_id: callbackId, text }, options()) };
}

/** Only structured error codes escape this module; transport errors may contain tokens. */
export function transportFailure(error: unknown) {
  const value = error as { response?: { error_code?: number; parameters?: { retry_after?: number } }; code?: string };
  const code = value?.response?.error_code;
  return { code, blocked: code === 403, retryAfter: Math.max(1, Math.min(86400, value?.response?.parameters?.retry_after ?? 0)),
    retryable: !code || code === 429 || code >= 500,
    ambiguous: !code,
    label: code ? `TELEGRAM_${code}` : "NETWORK_UNCERTAIN" };
}
