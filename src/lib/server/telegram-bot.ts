import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { accessibleProduct, claimProduct, inspectProduct, inventoryScope, InventoryError, worklist } from "./inventory";
import { expiryLabel, expiryDays } from "../expiry-calendar";
import { linkHash, nominateLink } from "./telegram-link";
import { transportFailure, type BotTransport, type BotButtons } from "./telegram-transport";

type ButtonPayload = { type: "list" | "card" | "claim" | "release" | "result" | "confirm" | "search" | "findhelp";
  id?: string; version?: number; result?: "CHECKED" | "MISSING" | "SOLD" | "REMOVED" | "DEFECT";
  mode?: string; offset?: number; query?: string };
const LABELS = { CHECKED: "Проверен, ещё на полке", MISSING: "Не найден", SOLD: "Полностью продан", REMOVED: "Снят с полки", DEFECT: "Брак" };
const MENU = "Обход: /walk\nПоиск: /find название или штрих-код\nНе найдены: /missing\nБез срока: /unknown\nДобавить: /add\nТаблица: /table\nНастройки: /settings";

async function acknowledge(transport: BotTransport, id: string, text?: string) {
  try { await transport.answer(id, text); }
  catch (error) {
    // Telegram's callback acknowledgement expires before our durable action token.
    if (transportFailure(error).code !== 400) throw error;
  }
}

export function appLink(path: string) {
  const base = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!base || !/^https?:\/\//.test(base)) return undefined;
  return new URL(path, base).toString();
}

export async function botButton(db: PrismaClient, userId: string, text: string, payload: ButtonPayload, now = new Date()) {
  const id = randomBytes(12).toString("base64url");
  await db.telegramButton.create({ data: { id, userId, payload: JSON.stringify(payload), expiresAt: new Date(now.getTime() + 86400000) } });
  return { text, callback_data: id };
}

export async function menuButtons(db: PrismaClient, userId: string, now = new Date()): Promise<BotButtons> {
  const buttons: BotButtons = [[await botButton(db, userId, "Начать обход", { type: "list" }, now),
    await botButton(db, userId, "Не найдены", { type: "list", mode: "missing" }, now)]];
  buttons.push([await botButton(db, userId, "Найти товар", { type: "findhelp" }, now),
    await botButton(db, userId, "Без срока", { type: "list", mode: "unknown" }, now)]);
  const add = appLink("/dashboard?add=1"), settings = appLink("/settings");
  if (add && settings) buttons.push([{ text: "Добавить товар", url: add }, { text: "Настройки", url: settings }]);
  const url = appLink("/dashboard");
  return url ? [...buttons, [{ text: "Открыть таблицу", url }]] : buttons;
}

async function sendList(db: PrismaClient, transport: BotTransport, userId: string, chatId: string, payload: ButtonPayload, now: Date) {
  const list = await worklist(db, userId, now);
  const rows = list.products.filter(p => payload.mode === "missing" ? p.missing : payload.mode === "unknown" ? p.daysLeft === null : p.daysLeft !== null);
  const offset = Math.max(0, payload.offset ?? 0);
  const page = rows.slice(offset, offset + 5);
  const buttons: BotButtons = await Promise.all(page.map(async p => [await botButton(db, userId,
    `${p.name.slice(0, 35)} · ${expiryLabel(p.expiryDate) ?? "без срока"}${p.claim ? ` · ${p.claim.name}` : ""}`,
    { type: "card", id: p.id }, now)]));
  if (offset + 5 < rows.length) buttons.push([await botButton(db, userId, "Далее", { ...payload, type: "list", offset: offset + 5 }, now)]);
  buttons.push(...await menuButtons(db, userId, now));
  await transport.send(chatId, `${list.store.name}\nПросрочено: ${list.counts.expired}; срочно: ${list.counts.urgent}; внимание: ${list.counts.warning}.\nПроверено сегодня: ${list.counts.checked}; завершено: ${list.counts.resolved}.\n${page.length ? "Выберите запись для проверки:" : "В этой очереди пока нет записей."}`, buttons);
}

async function sendCard(db: PrismaClient, transport: BotTransport, userId: string, chatId: string, id: string, now: Date) {
  const { product } = await accessibleProduct(db, userId, id);
  const claim = await db.productClaim.findUnique({ where: { productId: id } });
  const owner = claim && claim.expiresAt > now ? await db.user.findUnique({ where: { id: claim.userId }, select: { name: true } }) : null;
  const checker = product.checkedBy ? await db.user.findUnique({ where: { id: product.checkedBy }, select: { name: true } }) : null;
  const days = expiryDays(product.expiryDate, now);
  const rows: BotButtons = [];
  if (product.status === "ACTIVE") {
    if (claim?.userId === userId && claim.expiresAt > now) {
      for (const result of ["CHECKED", "MISSING", "SOLD", "REMOVED", "DEFECT"] as const) {
        rows.push([await botButton(db, userId, LABELS[result], { type: "result", id, version: product.version, result }, now)]);
      }
      rows.push([await botButton(db, userId, "Освободить / пропустить", { type: "release", id }, now)]);
    } else if (!owner) rows.push([await botButton(db, userId, "Взять на проверку", { type: "claim", id }, now)]);
  }
  const url = appLink(`/dashboard?edit=${encodeURIComponent(id)}`);
  if (url) rows.push([{ text: "Исправить данные", url }]);
  rows.push([await botButton(db, userId, "К обходу", { type: "list" }, now)]);
  await transport.send(chatId, `${product.name}\nШтрих-код: ${product.barcode}\nСрок: ${expiryLabel(product.expiryDate) ?? "не указан"}${days === null ? "" : days < 0 ? ` · просрочено на ${-days} дн.` : days === 0 ? " · сегодня" : ` · осталось ${days} дн.`}\nКоличество: ${product.quantity ?? "не указано"}\nСтатус: ${{ ACTIVE: "активный", ARCHIVED: "архив", DEFECT: "брак" }[product.status] ?? product.status}${product.missing ? " · не найден" : ""}${owner ? `\nПроверяет: ${owner.name ?? "Сотрудник"}` : ""}${product.checkedAt ? `\nПоследняя проверка: ${checker?.name ?? "Сотрудник"} · ${product.checkedAt.toLocaleString("ru-RU", { timeZone: "Europe/Minsk" })}` : ""}`, rows);
}

async function sendSearch(db: PrismaClient, transport: BotTransport, userId: string, chatId: string, query: string, offset: number, now: Date) {
  if (!query.trim() || query.length > 100) throw new InventoryError(400, "Напишите /find и название или штрих-код (до 100 символов).");
  const { where } = await inventoryScope(db, userId);
  const rows = await db.product.findMany({ where: { ...where,
    ...(/^\d{8,14}$/.test(query) ? { barcode: query } : { name: { contains: query.trim() } }) },
    orderBy: [{ expiryDate: "asc" }, { id: "asc" }], skip: offset, take: 6 });
  const buttons = await Promise.all(rows.slice(0, 5).map(async p => [await botButton(db, userId,
    `${p.name.slice(0, 35)} · ${expiryLabel(p.expiryDate) ?? "без срока"} · ${p.quantity ?? "?"} шт.`, { type: "card", id: p.id }, now)]));
  if (rows.length > 5) buttons.push([await botButton(db, userId, "Далее", { type: "search", query, offset: offset + 5 }, now)]);
  await transport.send(chatId, rows.length ? "Найденные партии:" : "Товар не найден.", buttons.length ? buttons : await menuButtons(db, userId, now));
}

/** Dispatch persisted private updates. Identity is reloaded, never inferred from buttons. */
export async function handleBotUpdate(db: PrismaClient, transport: BotTransport, update: any, now = new Date()) {
  const message = update.message ?? update.callback_query?.message;
  const from = update.callback_query?.from ?? update.message?.from;
  if (!message || message.chat?.type !== "private" || !from?.id || from.is_bot) return;
  const chatId = String(message.chat.id);
  if (chatId !== String(from.id)) return;
  const text: string = update.message?.text ?? "";
  try {
    if (text.startsWith("/start linkhash_")) {
      await nominateLink(db, text.slice(16), String(from.id), chatId, [from.first_name, from.last_name].filter(Boolean).join(" "), now);
      await transport.send(chatId, "Вернитесь в настройки приложения и подтвердите этот Telegram-аккаунт.");
      return;
    }
    const link = await db.telegramLink.findUnique({ where: { telegramUserId: String(from.id) } });
    if (!link || link.chatId !== chatId || !(await inventoryScope(db, link.userId)).membership) {
      if (update.callback_query) await acknowledge(transport, update.callback_query.id, "Доступ недоступен.");
      await transport.send(chatId, "Подключите Telegram в настройках приложения. Для работы нужно членство в магазине.");
      return;
    }
    if (link.deliveryStatus !== "READY") await db.telegramLink.update({ where: { userId: link.userId }, data: { deliveryStatus: "READY" } });
    const userId = link.userId;
    const actor = { userId, source: "TELEGRAM" as const };
    if (update.callback_query) {
      await acknowledge(transport, update.callback_query.id);
      const button = await db.telegramButton.findUnique({ where: { id: update.callback_query.data ?? "" } });
      if (!button || button.userId !== userId || button.expiresAt <= now) throw new InventoryError(409, "Кнопка устарела. Откройте /walk заново.");
      const payload: ButtonPayload = JSON.parse(button.payload);
      if (payload.type === "findhelp") return await transport.send(chatId, "Напишите /find и название или точный штрих-код. Например: /find молоко");
      if (payload.type === "list") return await sendList(db, transport, userId, chatId, payload, now);
      if (payload.type === "search") return await sendSearch(db, transport, userId, chatId, payload.query!, payload.offset ?? 0, now);
      if (payload.type === "claim") await claimProduct(db, actor, payload.id!, false, now);
      if (payload.type === "release") {
        await claimProduct(db, actor, payload.id!, true, now);
        return await sendList(db, transport, userId, chatId, { type: "list" }, now);
      }
      if (payload.type === "result" && ["SOLD", "REMOVED", "DEFECT"].includes(payload.result!)) {
        const { product } = await accessibleProduct(db, userId, payload.id!);
        await transport.send(chatId, `${LABELS[payload.result!]}?\n${product.name}\nСрок: ${expiryLabel(product.expiryDate) ?? "не указан"}`,
          [[await botButton(db, userId, "Подтвердить", { ...payload, type: "confirm" }, now)],
            [await botButton(db, userId, "Отмена", { type: "card", id: payload.id }, now)]]);
        return;
      }
      if (payload.type === "result" || payload.type === "confirm") {
        await inspectProduct(db, actor, payload.id!, payload.version!, payload.result!, `bot:${button.id}`, now);
        const saved = "Результат сохранён. Актуальные данные доступны в таблице.";
        const buttons = await menuButtons(db, userId, now);
        try { await transport.edit(chatId, message.message_id, saved, buttons); }
        catch (error) {
          if (transportFailure(error).code !== 400) throw error;
          await transport.send(chatId, saved, buttons);
        }
        return await sendList(db, transport, userId, chatId, { type: "list" }, now);
      }
      return await sendCard(db, transport, userId, chatId, payload.id!, now);
    }
    const [command, ...words] = text.trim().split(/\s+/);
    if (command === "/walk") return await sendList(db, transport, userId, chatId, { type: "list" }, now);
    if (command === "/missing" || command === "/unknown") return await sendList(db, transport, userId, chatId, { type: "list", mode: command.slice(1) }, now);
    if (command === "/find") return await sendSearch(db, transport, userId, chatId, words.join(" "), 0, now);
    if (["/add", "/table", "/settings"].includes(command)) {
      const url = appLink(command === "/add" ? "/dashboard?add=1" : command === "/settings" ? "/settings" : "/dashboard");
      return await transport.send(chatId, command === "/add" ? "Откройте форму и проверьте срок на упаковке." : "Откройте приложение:", url ? [[{ text: "Открыть", url }]] : undefined);
    }
    await transport.send(chatId, `Помощник для проверки полок.\n${MENU}`, await menuButtons(db, userId, now));
  } catch (error) {
    if (error instanceof InventoryError) { await transport.send(chatId, error.message); return; }
    throw error;
  }
}

/** Do not persist a raw linking credential in the webhook inbox. */
export function sanitizedUpdate(update: any) {
  const copy = structuredClone(update);
  if (typeof copy.message?.text === "string" && /^\/start [A-Za-z0-9_-]{32}$/.test(copy.message.text)) {
    copy.message.text = `/start linkhash_${linkHash(copy.message.text.slice(7))}`;
  }
  return copy;
}
