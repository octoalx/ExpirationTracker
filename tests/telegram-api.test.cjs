const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { storeFixture } = require('./helpers/disposable.ts');
const offline = require('./helpers/offline-modules.cjs');
const inventory = require('../src/lib/server/inventory.ts');
const errors = require('../src/lib/server/errors.ts');

function load(file, modules, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, process, Date, Map, Set, structuredClone, ...globals,
    require(name) { if (name in modules) return modules[name]; if (name in offline) return offline[name]; return require(name); } });
  return exports;
}

async function fixture(t) {
  const { db } = await storeFixture(t);
  let session = null;
  const auth = { getServerSession: async () => session };
  const api = load('src/lib/server/api.ts', { 'next-auth/next': auth, '../auth': { authOptions: {} }, './inventory': inventory, './errors': errors });
  const modules = { 'next-auth/next': auth, 'next-auth': auth,
    '@/lib/auth': { authOptions: {} }, '../../../lib/auth': { authOptions: {} }, '../../lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: db }, '../../../lib/prisma': { prisma: db }, '../../lib/prisma': { prisma: db },
    '@/lib/server/api': api, '@/lib/product-dates': require('../src/lib/product-dates.ts'),
    '../../../lib/inventory-import': require('../src/lib/inventory-import.ts'),
    '@/lib/apiErrorHandler': errors, '../../../lib/apiErrorHandler': { apiErrorHandler: errors.apiFailure },
    '../../lib/apiErrorHandler': { apiErrorHandler: (error, res) => errors.apiFailure(res, error) },
    '../../lib/logger': { logger: { info() {} } }, '@/lib/logger': { logger: { info() {} } },
    '@/lib/server/store-transfer': require('../src/lib/server/store-transfer.ts'),
    '@/lib/server/telegram-link': require('../src/lib/server/telegram-link.ts'),
    '@/lib/server/telegram-bot': require('../src/lib/server/telegram-bot.ts'),
    '@/lib/server/telegram-runtime': { tickTelegram: async () => {}, suspendTelegram: () => true, resumeTelegramRuntime() {} },
  };
  const call = async (file, method, body = {}, query = {}, headers = {}) => {
    const res = { code: 200, headers: {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, end() {},
      setHeader(name, value) { this.headers[name] = value; } };
    await load(file, modules).default({ method, body, query, headers }, res);
    return res;
  };
  return { db, call, login(id, role = 'USER') { session = id ? { user: { id, role, name: id, email: `${id}@example.invalid` } } : null; } };
}

test('store/product APIs use session membership, reject stale changes and protect manager-only removal', async t => {
  const { db, call, login } = await fixture(t);
  const products = 'src/pages/api/products/index.ts', edit = 'src/pages/api/products/[productId].ts';
  assert.equal((await call(products, 'GET')).code, 401);
  login('employee');
  const created = await call(products, 'POST', { name: 'Shared', barcode: '0123456789012', expiryDate: null, userId: 'outsider', storeId: 'forged' });
  assert.equal(created.code, 201); assert.equal(created.data.storeId, 'main'); assert.equal(created.data.userId, 'employee');
  const id = created.data.id;
  assert.equal((await call(products, 'GET')).data.canDelete, false);
  assert.equal((await call(edit, 'PATCH', { name: 'Missing version' }, { productId: id })).code, 409);
  assert.equal((await call(edit, 'PATCH', { name: 'Changed', version: 0 }, { productId: id })).code, 200);
  assert.equal((await call(edit, 'PATCH', { name: 'Stale', version: 0 }, { productId: id })).code, 409);
  assert.equal((await call(edit, 'PUT', { status: 'FORGED', version: 1 }, { productId: id })).code, 400);
  assert.equal((await call(edit, 'DELETE', {}, { productId: id, version: '1' })).code, 403);
  login('outsider'); assert.equal((await call(edit, 'PATCH', { name: 'Intruder', version: 1 }, { productId: id })).code, 404);
  assert.equal((await call(products, 'GET', {}, { userId: 'employee' })).data.products.length, 0);
  login('manager'); assert.equal((await call(products, 'GET')).data.products.length, 1);
  assert.equal((await call(edit, 'DELETE', {}, { productId: id, version: '1' })).code, 204);
  assert.equal((await call(products, 'GET')).data.products.length, 0);
  assert.ok((await db.product.findUniqueOrThrow({ where: { id } })).deletedAt);
  assert.equal(await db.productEvent.count(), 3);
});

test('email uses shared inventory and thresholds while preserving exact warning day and personal isolation', async t => {
  const { db } = await storeFixture(t), summaries = [], sent = [];
  for (const id of ['employee', 'outsider']) await db.settings.update({ where: { userId: id }, data: {
    emailNotifications: true, smtpHost: 'offline.invalid', smtpUser: 'offline', smtpPass: 'offline', urgentThreshold: 0, warningThreshold: 10,
  } });
  for (const [id, expiryDate, storeId, userId] of [
    ['urgent', '2026-10-07', 'main', 'manager'], ['exact', '2026-10-13', 'main', 'manager'],
    ['late-warning', '2026-10-11', 'main', 'employee'], ['private', '2026-10-06', null, 'outsider'],
  ]) await db.product.create({ data: { id, name: id, barcode: '01234567', expiryDate: new Date(expiryDate), storeId, userId } });
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-06T10:00:00+03:00'])); } }
  const service = load('src/services/notificationService.ts', {
    '../lib/prisma': { prisma: db }, '../lib/logger': { logger: { warn() {} } },
    '../lib/server/inventory': inventory,
    '../lib/expiry-calendar': { expiryDays: value => require('../src/lib/expiry-calendar.ts').expiryDays(value, new Clock()) },
    './emailService': { emailService: { initialize() {}, async send(email) { sent.push(email); return { success: true }; } } },
    '../lib/email-templates/index': { getEmailTemplate(_kind, data) { summaries.push(data.products.map(p => p.name)); return { html: 'offline' }; } },
  }, { Date: Clock });
  await service.sendDailyUrgentNotifications('employee'); await service.sendWarningNotifications('employee');
  assert.deepEqual(summaries.map(row => Array.from(row)), [['urgent'], ['exact']]);
  await service.sendDailyUrgentNotifications('outsider');
  assert.deepEqual(Array.from(summaries[2]), ['private']);
  assert.deepEqual(sent, ['employee@example.invalid', 'employee@example.invalid', 'outsider@example.invalid']);
});

test('store APIs reject employee administration, preserve private data on joining and immediately revoke actions', async t => {
  const { db, call, login } = await fixture(t);
  const members = 'src/pages/api/store/members.ts', settings = 'src/pages/api/store/settings.ts';
  login('employee'); assert.equal((await call(settings, 'POST', { urgentThreshold: 1, warningThreshold: 2 })).code, 403);
  assert.equal((await call(members, 'POST', { email: 'outsider@example.invalid' })).code, 403);
  login('manager');
  await db.product.create({ data: { name: 'Private', barcode: '01234567', userId: 'outsider' } });
  assert.equal((await call(members, 'POST', { email: 'outsider@example.invalid' })).code, 409);
  assert.equal((await call(settings, 'POST', { urgentThreshold: 5, warningThreshold: 3 })).code, 400);
  assert.equal((await call(settings, 'POST', { urgentThreshold: 1, warningThreshold: 2 })).code, 200);
  assert.equal((await call(members, 'DELETE', { userId: 'manager' })).code, 409);
  assert.equal((await call(members, 'DELETE', { userId: 'employee' })).code, 200);
  login('employee'); assert.equal((await call('src/pages/api/store/worklist.ts', 'GET')).code, 403);
});

test('settings return safe credentials and shared thresholds; bulk import uses current membership', async t => {
  const { db, call, login } = await fixture(t);
  login('employee');
  await db.settings.update({ where: { userId: 'employee' }, data: { telegramToken: 'legacy-private-fixture', telegramChatId: '123', smtpPass: 'fixture-password' } });
  const res = await call('src/pages/api/settings.ts', 'GET');
  assert.equal('telegramToken' in res.data.settings, false); assert.equal('telegramChatId' in res.data.settings, false);
  assert.equal('smtpPass' in res.data.settings, false); assert.equal(res.data.storeRole, 'EMPLOYEE');
  const body = { user: { name: 'employee', email: 'employee@example.invalid' }, settings: { urgentThreshold: 3, warningThreshold: 7, telegramToken: 'forged', telegramChatId: 'forged' } };
  assert.equal((await call('src/pages/api/settings.ts', 'POST', body)).code, 200);
  assert.equal((await db.settings.findUniqueOrThrow({ where: { userId: 'employee' } })).telegramToken, 'legacy-private-fixture');
  assert.equal((await call('src/pages/api/settings.ts', 'POST', { ...body, settings: { urgentThreshold: 1, warningThreshold: 2 } })).code, 403);
  const imported = await call('src/pages/api/products/import.ts', 'POST', { userId: 'outsider', products: [{ name: 'Imported', barcode: '01234567', quantity: null }] });
  assert.equal(imported.code, 200); const p = await db.product.findFirstOrThrow();
  assert.equal(p.storeId, 'main'); assert.equal(p.userId, 'employee'); assert.equal(p.expiryDate, null);
});

test('webhook verifies secret, persists once and redacts linking credentials before acknowledgement', async t => {
  const { db, call } = await fixture(t);
  const previous = process.env.TELEGRAM_WEBHOOK_SECRET; process.env.TELEGRAM_WEBHOOK_SECRET = 'offline-secret';
  t.after(() => { if (previous === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET; else process.env.TELEGRAM_WEBHOOK_SECRET = previous; });
  const route = 'src/pages/api/telegram/webhook.ts';
  const payload = { update_id: 10, message: { text: '/start ' + 'a'.repeat(32), chat: { id: 101, type: 'private' }, from: { id: 101 } } };
  assert.equal((await call(route, 'POST', payload)).code, 403);
  const headers = { 'x-telegram-bot-api-secret-token': 'offline-secret' };
  assert.equal((await call(route, 'POST', {}, {}, headers)).code, 400);
  assert.equal((await call(route, 'POST', payload, {}, headers)).code, 200);
  assert.equal((await call(route, 'POST', payload, {}, headers)).code, 200);
  assert.equal(await db.telegramUpdate.count(), 1);
  assert.equal((await db.telegramUpdate.findFirstOrThrow()).payload.includes('a'.repeat(32)), false);
});

test('JSON v2 backup restores store, membership and audit atomically; legacy replacement remains personal and paused', async t => {
  const { db, call, login } = await fixture(t); login('manager', 'ADMIN');
  await db.product.create({ data: { id: 'batch', name: 'Original', barcode: '01234567', userId: 'employee', storeId: 'main' } });
  const backup = await call('src/pages/api/admin/backup.ts', 'GET'); assert.equal(backup.data.version, '2.0');
  const copied = JSON.parse(JSON.stringify(backup.data));
  const restored = await call('src/pages/api/admin/restore.ts', 'POST', { mode: 'replace', data: copied });
  assert.equal(restored.code, 200); assert.equal(await db.storeMembership.count(), 2);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: 'batch' } })).storeId, 'main');
  assert.equal((await db.integrationState.findUniqueOrThrow({ where: { id: 'telegram' } })).paused, true);
  const legacyMerge = { version: '1.0', data: { users: [{ id: 'employee', email: 'employee@example.invalid' }], products: [{ id: 'batch', userId: 'employee', name: 'Legacy edit', barcode: '01234567' }] } };
  assert.equal((await call('src/pages/api/admin/restore.ts', 'POST', { mode: 'merge', data: legacyMerge })).code, 200);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: 'batch' } })).storeId, 'main');
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: 'batch' } })).version, 1);
  copied.data.memberships[0].storeId = 'forged';
  assert.equal((await call('src/pages/api/admin/restore.ts', 'POST', { mode: 'replace', data: copied })).code, 400);
  assert.equal(await db.product.count(), 1);
  const legacy = { version: '1.0', data: { users: [{ id: 'legacy', name: 'Legacy', email: 'legacy@example.invalid' }], products: [{ id: 'old', userId: 'legacy', name: 'Old', barcode: '01234567', expiryDate: null }] } };
  assert.equal((await call('src/pages/api/admin/restore.ts', 'POST', { mode: 'replace', data: legacy })).code, 200);
  assert.equal(await db.store.count(), 0); assert.equal(await db.storeMembership.count(), 0);
  assert.equal((await db.product.findFirstOrThrow()).storeId, null);
});
