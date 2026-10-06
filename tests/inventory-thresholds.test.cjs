const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules, globals = {}) {
  modules = { 'bcryptjs': { default: require('bcryptjs') }, zod: require('zod'), ...modules };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, AbortController, ...globals, require: name => {
    if (!(name in modules)) { const offline = require("./helpers/offline-modules.cjs"); if (name in offline) return offline[name]; throw new Error(`Unexpected dependency: ${name}`); }
    return modules[name];
  } });
  return exports;
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('saved thresholds persist and are immediately returned for the verified owner', async () => {
  const path = require('node:path'), os = require('node:os');
  const Database = require('better-sqlite3');
  const { PrismaClient } = require('@prisma/client');
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-thresholds-'));
  const url = path.join(dir, 'test.db'), db = new Database(url);
  for (const name of fs.readdirSync('prisma/migrations').sort()) {
    const file = path.join('prisma/migrations', name, 'migration.sql');
    if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
  }
  db.close();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  let session = { user: { id: 'owner' } };
  const handler = load('src/pages/api/settings.ts', {
    '../../lib/prisma': { prisma }, '../../lib/apiErrorHandler': { apiErrorHandler: error => { throw error; } },
    'next-auth/next': { getServerSession: async () => session }, '../../lib/auth': { authOptions: {} },
    '../../lib/logger': { logger: { info() {} } },
  }).default;
  const call = async (method, body) => {
    const res = { code: 200, data: undefined, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader() {} };
    await handler({ method, body, query: { scope: 'thresholds' } }, res); return res;
  };
  try {
    for (const id of ['owner', 'other']) {
      await prisma.user.create({ data: { id, email: `${id}@example.invalid` } });
      await prisma.settings.create({ data: { userId: id } });
    }
    const payload = { user: { name: 'Owner', email: 'owner@example.invalid', id: 'other' }, settings: { userId: 'other', urgentThreshold: 3, warningThreshold: 30 } };
    assert.equal((await call('POST', payload)).code, 200);
    assert.equal((await call('GET')).data.settings.warningThreshold, 30);
    session = { user: { id: 'other' } };
    assert.equal((await call('GET')).data.settings.warningThreshold, 7);
    session = { user: { id: 'owner' } };
    assert.equal((await call('POST', { ...payload, settings: { urgentThreshold: 40, warningThreshold: 30 } })).code, 400);
    assert.equal((await call('GET')).data.settings.warningThreshold, 30);
  } finally {
    await prisma.$disconnect(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('expiry urgency obeys inclusive saved thresholds and Minsk calendar rollover', () => {
  const { getExpiryStatus } = load('src/lib/utils.ts', { clsx: { clsx() {} }, 'tailwind-merge': {}, 'date-fns': require('date-fns') });
  const today = new Date("2026-10-03T23:59:00+03:00");
  for (const [day, expected] of [[2, 'expired'], [3, 'urgent'], [6, 'urgent'], [7, 'warning'], [31, 'warning']]) {
    assert.equal(getExpiryStatus(new Date(Date.UTC(2026, 9, day)), 3, 30, today), expected);
  }
  assert.equal(getExpiryStatus(new Date(Date.UTC(2026, 10, 2)), 3, 30, today), 'warning');
  assert.equal(getExpiryStatus(new Date(Date.UTC(2026, 10, 3)), 3, 30, today), 'safe');
  assert.equal(getExpiryStatus(new Date(Date.UTC(2026, 9, 23)), 3, 7, today), 'safe');
  assert.equal(getExpiryStatus(new Date(Date.UTC(2026, 9, 23)), 3, 30, today), 'warning');
  assert.equal(getExpiryStatus(new Date(Date.UTC(2026, 9, 7)), 3, 30, new Date(Date.UTC(2026, 9, 4))), 'urgent');
  assert.equal(getExpiryStatus(null, 3, 30, today), 'safe');
  assert.equal(getExpiryStatus(new Date(Date.UTC(2026, 9, 3)), 0, 0, today), 'urgent');
});

test('live inventory reads nested thresholds, refreshes on events/time and cancels on teardown', async () => {
  const window = new EventTarget(), document = new EventTarget(); document.hidden = false;
  let interval, cleared = false, reads = 0, tickCount = 0, warningThreshold = 7;
  window.setInterval = (callback, ms) => { assert.equal(ms, 30000); interval = callback; return 1; };
  window.clearInterval = () => { cleared = true; };
  const updates = [];
  let signal;
  const api = load('src/lib/inventory-settings.ts', {}, { window, document, fetch: async (url, options) => {
    assert.equal(url, '/api/settings?scope=thresholds'); assert.equal(options.cache, 'no-store'); signal = options.signal;
    reads++; return { ok: true, json: async () => ({ settings: { urgentThreshold: 3, warningThreshold } }) };
  } });
  const stop = api.watchInventorySettings(settings => updates.push(settings.warningThreshold), () => tickCount++);
  await flush(); assert.deepEqual(updates, [7]);
  warningThreshold = 30;
  window.dispatchEvent(new Event(api.SETTINGS_CHANGED)); await flush(); assert.equal(updates.at(-1), 30);
  const storage = new Event('storage'); storage.key = api.SETTINGS_CHANGED;
  window.dispatchEvent(storage); await flush();
  window.dispatchEvent(new Event('focus')); await flush();
  document.hidden = true; const before = reads; interval(); await flush(); assert.equal(reads, before);
  document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); await flush();
  interval(); await flush(); assert.equal(reads, before + 2);
  assert.equal(tickCount, reads);
  stop(); assert.ok(signal.aborted); assert.ok(cleared);
  window.dispatchEvent(new Event('focus')); interval(); await flush(); assert.equal(reads, before + 2);
});

test('settings threshold endpoint scopes owners and exposes no integration credentials; invalid thresholds do not write', async () => {
  let session = { user: { id: 'owner' } }, writes = 0;
  const handler = load('src/pages/api/settings.ts', {
    '../../lib/prisma': { prisma: { user: { findUnique: async () => ({ id: session.user.id }) }, storeMembership: { findUnique: async () => null }, settings: { findUnique: async args => {
      assert.equal(args.where.userId, session.user.id);
      if (args.select) assert.deepEqual(Object.keys(args.select).sort(), ['urgentThreshold', 'warningThreshold']);
      return session.user.id === 'owner' ? { urgentThreshold: 3, warningThreshold: 30 } : null;
    } }, $transaction: async () => { writes++; } } },
    '../../lib/apiErrorHandler': { apiErrorHandler: error => { throw error; } },
    'next-auth/next': { getServerSession: async () => session }, '../../lib/auth': { authOptions: {} }, '../../lib/logger': { logger: {} },
  }).default;
  const call = async (method, body) => {
    const res = { code: 200, data: undefined, headers: {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader(key, value) { this.headers[key] = value; } };
    await handler({ method, body, query: { scope: 'thresholds' } }, res); return res;
  };
  const res = await call('GET'); assert.equal(res.data.settings.warningThreshold, 30);
  assert.equal(res.headers['Cache-Control'], 'private, no-store'); assert.deepEqual(Object.keys(res.data), ['settings']);
  session = { user: { id: 'other' } }; assert.equal((await call('GET')).data.settings.warningThreshold, 7);
  for (const [urgentThreshold, warningThreshold] of [[-1, 30], [31, 30], [3, 1.5]]) {
    assert.equal((await call('POST', { user: {}, settings: { urgentThreshold, warningThreshold } })).code, 400);
  }
  assert.equal(writes, 0);
  session = null; assert.equal((await call('GET')).code, 401);
});

test('stale and late threshold responses cannot overwrite newer settings or update after teardown', async () => {
  const window = new EventTarget(), document = new EventTarget(); document.hidden = false;
  window.setInterval = () => 1; window.clearInterval = () => {};
  const requests = [], updates = [];
  const api = load('src/lib/inventory-settings.ts', {}, { window, document, fetch: () => new Promise(resolve => requests.push(resolve)) });
  const stop = api.watchInventorySettings(settings => updates.push(settings.warningThreshold), () => {});
  window.dispatchEvent(new Event('focus'));
  requests[1]({ ok: true, json: async () => ({ settings: { urgentThreshold: 3, warningThreshold: 30 } }) }); await flush();
  requests[0]({ ok: true, json: async () => ({ settings: { urgentThreshold: 3, warningThreshold: 7 } }) }); await flush();
  assert.deepEqual(updates, [30]);
  window.dispatchEvent(new Event('focus')); stop();
  requests[2]({ ok: true, json: async () => ({ settings: { urgentThreshold: 3, warningThreshold: 80 } }) }); await flush();
  assert.deepEqual(updates, [30]);
});
