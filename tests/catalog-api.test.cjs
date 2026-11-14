const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

function load(file, modules, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, AbortController, ...globals, require(name) {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return exports;
}
function response() {
  return { code: 200, data: undefined, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader() {} };
}

/** Creates a disposable database with every repository migration applied. */
function disposableDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-catalog-'));
  const url = path.join(dir, 'test.db');
  const db = new Database(url);
  const migrations = path.join(__dirname, '../prisma/migrations');
  for (const name of fs.readdirSync(migrations).sort()) {
    const file = path.join(migrations, name, 'migration.sql');
    if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
  }
  db.close();
  return { dir, url, prisma: new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) }) };
}

// Production surfaces: src/pages/api/catalog/index.ts (GET lookup of the shared catalog) and
// src/pages/api/products/import.ts (inventory batch import).
test('catalog lookup is shared-only and read-only; inventory import validates before writes', async () => {
  const { dir, prisma } = disposableDatabase();
  let session = null;
  const authModules = {
    'next-auth/next': { getServerSession: async () => session },
    '@/lib/auth': { authOptions: {} },
    '../../../lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '../../../lib/prisma': { prisma },
    '@/lib/server/inventory': require('../src/lib/server/inventory.ts'),
    '@/lib/server/api': require('../src/lib/server/errors.ts'),
    '@/lib/expiry-calendar': require('../src/lib/expiry-calendar.ts'),
    '../../../lib/inventory-import': load('src/lib/inventory-import.ts', {}),
  };
  const catalog = load('src/pages/api/catalog/index.ts', authModules).default;
  const inventory = load('src/pages/api/products/import.ts', authModules).default;
  const call = async (handler, method, body = {}, query = {}) => {
    const res = response();
    await handler({ method, body, query }, res);
    return res;
  };

  try {
    for (const id of ['owner', 'other']) {
      await prisma.user.create({ data: { id, email: `${id}@example.invalid` } });
    }
    await prisma.store.create({ data: { id: 'dep', name: 'Отдел' } });
    await prisma.storeMembership.create({ data: { userId: 'owner', storeId: 'dep', role: 'MANAGER' } });
    await prisma.sharedCatalogEntry.create({ data: { barcode: '2000000000001', name: 'Catalog A' } });

    // Unauthenticated requests disclose and mutate nothing.
    assert.equal((await call(catalog, 'GET', {}, { barcode: '2000000000001' })).code, 401);
    assert.equal((await call(inventory, 'POST', { products: [{ name: 'Batch', barcode: '2000000000001' }] })).code, 401);
    assert.equal(await prisma.product.count(), 0);

    // The personal write endpoint is gone: every method but GET is 405 with an Allow header.
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const rejected = response();
      rejected.headers = {};
      rejected.setHeader = (key, value) => { rejected.headers[key] = value; };
      await catalog({ method, body: { entries: [{ barcode: '2000000000002', name: 'New' }] }, query: {} }, rejected);
      assert.equal(rejected.code, 405);
      assert.equal(rejected.headers.Allow, 'GET');
    }
    assert.equal(await prisma.sharedCatalogEntry.count(), 1);

    // Lookup reads the shared reference for any authenticated account.
    session = { user: { id: 'other' } };
    const found = await call(catalog, 'GET', {}, { barcode: '2000000000001' });
    assert.equal(found.code, 200);
    assert.deepEqual(found.data, { barcode: '2000000000001', name: 'Catalog A' });
    assert.equal((await call(catalog, 'GET', {}, { barcode: '2000000000009' })).code, 404);
    assert.equal((await call(catalog, 'GET', {}, { barcode: 'not-a-barcode' })).code, 400);

    // Invalid inventory payloads are rejected before any write.
    session = { user: { id: 'owner' } };
    assert.equal((await call(inventory, 'POST', { products: [] })).code, 400);
    assert.equal(await prisma.product.count(), 0);

    // Inventory import stays owner-scoped even when the body claims another account.
    session = { user: { id: 'owner' } };
    const before = Date.now();
    const batch = await call(inventory, 'POST', {
      products: [{ barcode: '2000000000002', name: 'Excel batch', expiryDate: '2026-12-31', quantity: null, userId: 'other' }],
    });
    assert.equal(batch.code, 200);
    assert.equal(batch.data.imported, 1);
    const saved = await prisma.product.findFirst({ where: { name: 'Excel batch' } });
    assert.equal(saved.userId, 'owner');
    assert.equal(saved.storeId, 'dep');
    assert.equal(saved.expiryDate.toISOString(), '2026-12-31T00:00:00.000Z');
    assert.ok(saved.createdAt.getTime() >= before);
    // Expiry labels are calendar dates, so a past date lands as expired on import.
    assert.equal((await call(inventory, 'POST', {
      products: [{ barcode: '2000000000003', name: 'Old batch', expiryDate: '2020-01-01', quantity: 2 }],
    })).code, 200);
    assert.equal((await prisma.product.findFirst({ where: { name: 'Old batch' } })).isExpired, true);
    assert.equal((await prisma.product.findFirst({ where: { name: 'Excel batch' } })).isExpired, false);
  } finally {
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
