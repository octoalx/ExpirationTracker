import test from "node:test";
import assert from "node:assert/strict";
import { storeFixture } from "./helpers/disposable";
import { createLinkRequest, confirmLink, nominateLink, linkHash, unlinkTelegram } from "../src/lib/server/telegram-link";
import { botButton, handleBotUpdate, sanitizedUpdate } from "../src/lib/server/telegram-bot";
import { processInbox, scheduleTelegram, processDeliveries } from "../src/lib/server/telegram-jobs";
import { claimProduct } from "../src/lib/server/inventory";
import type { BotTransport, BotButtons } from "../src/lib/server/telegram-transport";

const now = new Date("2026-10-06T10:00:00+03:00");
function fakeTransport() {
  const sent: Array<{ chatId: string; text: string; buttons?: BotButtons }> = [];
  let fail: any;
  const transport: BotTransport = {
    async send(chatId, text, buttons) { if (fail) throw fail; sent.push({ chatId, text, buttons }); return { message_id: sent.length }; },
    async edit(chatId, messageId, text, buttons) { if (fail) throw fail; sent.push({ chatId, text, buttons }); return true; },
    async answer() { return true; },
  };
  return { transport, sent, failure(value: any) { fail = value; } };
}
async function connected(db: any) {
  await db.telegramLink.create({ data: { userId: "employee", telegramUserId: "101", chatId: "101", displayName: "Employee" } });
  await db.settings.update({ where: { userId: "employee" }, data: { telegramNotifications: true } });
}
const batch = { id: "batch", name: "Batch", barcode: "0123456789012", userId: "employee", storeId: "main", expiryDate: new Date("2026-10-11") };
function callback(id: string, from = 101) {
  return { callback_query: { id: "callback", data: id, from: { id: from, first_name: "Employee" },
    message: { message_id: 1, chat: { id: from, type: "private" } } } };
}

test("account linking needs web confirmation; expired/reused links and account collisions cannot bind", async t => {
  const { db } = await storeFixture(t);
  const oldToken = process.env.TELEGRAM_BOT_TOKEN, oldName = process.env.TELEGRAM_BOT_USERNAME;
  process.env.TELEGRAM_BOT_TOKEN = "offline-fixture"; process.env.TELEGRAM_BOT_USERNAME = "fixture_bot";
  t.after(() => { if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = oldToken;
    if (oldName === undefined) delete process.env.TELEGRAM_BOT_USERNAME; else process.env.TELEGRAM_BOT_USERNAME = oldName; });
  const request = await createLinkRequest(db, "employee", now);
  const token = new URL(request.url).searchParams.get("start")!;
  await assert.rejects(confirmLink(db, "employee", linkHash(token), now), { status: 400 });
  await nominateLink(db, linkHash(token), "101", "101", "Employee", now);
  assert.equal(await db.telegramLink.count(), 0);
  await assert.rejects(nominateLink(db, linkHash(token), "102", "102", "Other", now), { status: 400 });
  await assert.rejects(confirmLink(db, "manager", linkHash(token), now), { status: 400 });
  await confirmLink(db, "employee", linkHash(token), now);
  assert.equal((await db.telegramLink.findUniqueOrThrow({ where: { userId: "employee" } })).telegramUserId, "101");
  await assert.rejects(confirmLink(db, "employee", linkHash(token), now), { status: 400 });
  const second = await createLinkRequest(db, "manager", now);
  const secondToken = new URL(second.url).searchParams.get("start")!;
  await assert.rejects(nominateLink(db, linkHash(secondToken), "101", "101", "Employee", now), { status: 409 });
  await assert.rejects(nominateLink(db, linkHash(secondToken), "102", "102", "Other", new Date(now.getTime() + 600001)), { status: 400 });
  await unlinkTelegram(db, "employee"); assert.equal(await db.telegramLink.count(), 0);
});

test("raw linking tokens never enter the durable inbox; group messages do not create bindings", async t => {
  const { db } = await storeFixture(t); const fake = fakeTransport();
  const update = { update_id: 1, message: { text: "/start " + "a".repeat(32), from: { id: 101 }, chat: { id: -1, type: "group" } } };
  const safe = sanitizedUpdate(update);
  assert.equal(JSON.stringify(safe).includes("a".repeat(32)), false);
  assert.ok(safe.message.text.startsWith("/start linkhash_"));
  await handleBotUpdate(db, fake.transport, safe, now);
  assert.equal(fake.sent.length, 0); assert.equal(await db.telegramLink.count(), 0);
});

test("Telegram confirmations are idempotent and revoked/foreign/expired buttons cannot mutate", async t => {
  const { db } = await storeFixture(t); await connected(db); await db.product.create({ data: batch });
  const fake = fakeTransport();
  await claimProduct(db, { userId: "employee", source: "TELEGRAM" }, batch.id, false, now);
  const button = await botButton(db, "employee", "Sold", { type: "result", id: batch.id, version: 0, result: "SOLD" }, now);
  await handleBotUpdate(db, fake.transport, callback(button.callback_data), now);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: batch.id } })).status, "ACTIVE");
  const confirmation = fake.sent.at(-1)!.buttons![0][0].callback_data!;
  await handleBotUpdate(db, fake.transport, callback(confirmation), now);
  await handleBotUpdate(db, fake.transport, callback(confirmation), now);
  assert.equal(await db.productEvent.count({ where: { action: "SOLD" } }), 1);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: batch.id } })).resolution, "SOLD");
  const next = await db.product.create({ data: { ...batch, id: "next" } });
  const forged = await botButton(db, "manager", "Other", { type: "claim", id: next.id }, now);
  await handleBotUpdate(db, fake.transport, callback(forged.callback_data), now);
  assert.equal(await db.productClaim.count({ where: { productId: next.id } }), 0);
  const expired = await botButton(db, "employee", "Expired", { type: "claim", id: next.id }, new Date(now.getTime() - 86400001));
  await handleBotUpdate(db, fake.transport, callback(expired.callback_data), now);
  assert.equal(await db.productClaim.count({ where: { productId: next.id } }), 0);
  await db.storeMembership.delete({ where: { userId: "employee" } });
  const stale = await botButton(db, "employee", "Revoked", { type: "claim", id: next.id }, now);
  await handleBotUpdate(db, fake.transport, callback(stale.callback_data), now);
  assert.equal(await db.productClaim.count(), 0);
});

test("daily schedule coalesces equal times and warns once about late-added warning batches", async t => {
  const { db } = await storeFixture(t); await connected(db); await db.product.create({ data: batch });
  const fake = fakeTransport();
  await scheduleTelegram(db, now); await scheduleTelegram(db, now);
  assert.equal(await db.telegramDelivery.count(), 1);
  await processDeliveries(db, fake.transport, now); await processDeliveries(db, fake.transport, now);
  assert.equal(fake.sent.length, 1); assert.ok(fake.sent[0].text.includes("Batch"));
  assert.equal(await db.telegramWarning.count(), 1);
  const tomorrow = new Date("2026-10-07T10:00:00+03:00");
  await scheduleTelegram(db, tomorrow); await processDeliveries(db, fake.transport, tomorrow);
  assert.equal(fake.sent.length, 1, "warning within band is not repeated");
  const urgentDay = new Date("2026-10-08T10:00:00+03:00");
  await scheduleTelegram(db, urgentDay); await processDeliveries(db, fake.transport, urgentDay);
  assert.equal(fake.sent.length, 2, "urgent records are included daily");
  assert.equal(await db.telegramWarning.count(), 0);
});

test("expired Telegram acknowledgement and unavailable edited message do not lose a persisted valid action", async t => {
  const { db } = await storeFixture(t); await connected(db); await db.product.create({ data: batch });
  const fake = fakeTransport();
  fake.transport.answer = async () => { throw { response: { error_code: 400 } }; };
  fake.transport.edit = async () => { throw { response: { error_code: 400 } }; };
  await claimProduct(db, { userId: "employee", source: "TELEGRAM" }, batch.id, false, now);
  const button = await botButton(db, "employee", "Check", { type: "result", id: batch.id, version: 0, result: "CHECKED" }, now);
  await db.telegramUpdate.create({ data: { id: 88, payload: JSON.stringify(callback(button.callback_data)), availableAt: now } });
  await processInbox(db, fake.transport, now);
  assert.equal((await db.telegramUpdate.findUniqueOrThrow({ where: { id: 88 } })).state, "DONE");
  assert.equal(await db.productEvent.count({ where: { action: "CHECKED" } }), 1);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: batch.id } })).status, "ACTIVE");
  assert.ok(fake.sent.some(message => message.text.includes("Результат сохранён")));
});

test("corrected expiry re-enters warning band; old daily backlog and disabled subscriptions are cancelled", async t => {
  const { db } = await storeFixture(t); await connected(db); await db.product.create({ data: batch }); const fake = fakeTransport();
  await scheduleTelegram(db, now); await processDeliveries(db, fake.transport, now);
  await db.product.update({ where: { id: batch.id }, data: { expiryDate: new Date("2027-01-01") } });
  await scheduleTelegram(db, now); assert.equal(await db.telegramWarning.count(), 0);
  await db.product.update({ where: { id: batch.id }, data: { expiryDate: new Date("2026-10-12") } });
  const next = new Date("2026-10-07T10:00:00+03:00"); await scheduleTelegram(db, next); await processDeliveries(db, fake.transport, next);
  assert.equal(fake.sent.length, 2);
  await db.telegramDelivery.create({ data: { key: "old", userId: "employee", kind: "URGENT", scheduleDate: "2026-10-05", availableAt: now } });
  await processDeliveries(db, fake.transport, next); assert.equal((await db.telegramDelivery.findUniqueOrThrow({ where: { key: "old" } })).state, "CANCELLED");
  await db.settings.update({ where: { userId: "employee" }, data: { telegramNotifications: false } });
  await db.telegramDelivery.create({ data: { key: "disabled", userId: "employee", kind: "URGENT", scheduleDate: "2026-10-07", availableAt: now } });
  await processDeliveries(db, fake.transport, next); assert.equal(fake.sent.length, 2);
});

test("delivery retry respects 429, blocking stops retries, and restored pause prevents all transport calls", async t => {
  const { db } = await storeFixture(t); await connected(db); await db.product.create({ data: batch }); const fake = fakeTransport();
  await scheduleTelegram(db, now); fake.failure({ response: { error_code: 429, parameters: { retry_after: 120 } } });
  await processDeliveries(db, fake.transport, now);
  const delivery = await db.telegramDelivery.findFirstOrThrow(); assert.equal(delivery.state, "QUEUED");
  assert.equal(delivery.availableAt.getTime(), now.getTime() + 120000); assert.equal(delivery.error, "TELEGRAM_429");
  fake.failure(null); await processDeliveries(db, fake.transport, new Date(now.getTime() + 119000)); assert.equal(fake.sent.length, 0);
  await db.integrationState.create({ data: { id: "telegram", paused: true } });
  await processDeliveries(db, fake.transport, new Date(now.getTime() + 120000)); assert.equal(fake.sent.length, 0);
  await db.integrationState.update({ where: { id: "telegram" }, data: { paused: false } });
  fake.failure({ response: { error_code: 403 } }); await processDeliveries(db, fake.transport, new Date(now.getTime() + 120000));
  assert.equal((await db.telegramLink.findFirstOrThrow()).deliveryStatus, "BLOCKED");
  assert.equal((await db.telegramDelivery.findFirstOrThrow()).state, "FAILED");
});

test("durable inbox survives worker failure and duplicate processing does not duplicate inspection", async t => {
  const { db } = await storeFixture(t); await connected(db); await db.product.create({ data: batch }); const fake = fakeTransport();
  await claimProduct(db, { userId: "employee", source: "TELEGRAM" }, batch.id, false, now);
  const button = await botButton(db, "employee", "Checked", { type: "result", id: batch.id, version: 0, result: "CHECKED" }, now);
  await db.telegramUpdate.create({ data: { id: 1, payload: JSON.stringify(callback(button.callback_data)), availableAt: now } });
  fake.failure(new Error("offline failure")); await processInbox(db, fake.transport, now);
  assert.equal(await db.productEvent.count(), 1, "write survives reply failure");
  assert.equal((await db.telegramUpdate.findUniqueOrThrow({ where: { id: 1 } })).state, "QUEUED");
  fake.failure(null); await processInbox(db, fake.transport, new Date(now.getTime() + 30001));
  await processInbox(db, fake.transport, new Date(now.getTime() + 30001));
  assert.equal(await db.productEvent.count(), 1);
  assert.equal((await db.telegramUpdate.findUniqueOrThrow({ where: { id: 1 } })).state, "DONE");
});
