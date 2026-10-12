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

function load(file, modules) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, require(name) {
    if (!(name in modules)) { const offline = require("./helpers/offline-modules.cjs"); if (name in offline) return offline[name]; throw new Error(`Unexpected dependency: ${name}`); }
    return modules[name];
  } });
  return exports;
}

test('Excel API imports into empty storage with session ownership and validates before writes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'excel-import-'));
  const url = path.join(dir, 'test.db');
  const db = new Database(url);
  const migrations = path.join(__dirname, '../prisma/migrations');
  for (const name of fs.readdirSync(migrations).sort()) {
    const file = path.join(migrations, name, 'migration.sql');
    if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
  }
  db.exec("INSERT INTO User (id) VALUES ('owner'), ('other');");
  db.close();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  let session = { user: { id: 'owner' } };
  const inventory = load('src/lib/inventory-import.ts', {});
  const handler = load('src/pages/api/products/import.ts', {
    'next-auth/next': { getServerSession: async () => session },
    '../../../lib/auth': { authOptions: {} },
    '../../../lib/prisma': { prisma },
    '../../../lib/inventory-import': inventory,
  }).default;
  const call = async (products) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler({ method: 'POST', body: { products } }, res);
    return res;
  };
  try {
    const item = { barcode: '0012345678901', name: 'Item', expiryDate: '2024-02-29', userId: 'other' };
    session = null;
    assert.equal((await call([item])).code, 401);
    assert.equal(await prisma.product.count(), 0);
    session = { user: { id: 'owner' } };
    assert.equal((await call([item, { ...item, expiryDate: '2025-02-29' }])).code, 400);
    assert.equal(await prisma.product.count(), 0);
    const result = await call([item, { barcode: '12345678', name: 'Unknown expiry', quantity: 3 }]);
    assert.equal(result.code, 200);
    assert.equal(result.data.imported, 2);
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    assert.equal(products[0].expiryDate.toISOString(), '2024-02-29T00:00:00.000Z');
    assert.equal(products[0].barcode, item.barcode);
    assert.equal(products[1].expiryDate, null);
    assert.equal(products[1].quantity, 3);
    assert.ok(products.every(p => p.userId === 'owner' && p.status === 'ACTIVE'));
    assert.equal(await prisma.product.count({ where: { userId: 'other' } }), 0);
  } finally {
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
