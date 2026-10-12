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

test('manufacture metadata survives edits; migration preserves legacy records and owner isolation', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-dates-'));
  const url = path.join(dir, 'test.db');
  const db = new Database(url);
  const migrations = path.join(__dirname, '../prisma/migrations');
  const names = fs.readdirSync(migrations).filter(name => fs.existsSync(path.join(migrations, name, 'migration.sql'))).sort();
  for (const name of names.filter(name => name < '20261003000000')) db.exec(fs.readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8'));
  db.exec("INSERT INTO User (id) VALUES ('owner'), ('other'); INSERT INTO Product (id,name,barcode,quantity,status,updatedAt,userId) VALUES ('legacy','Existing','12345678',4,'ARCHIVED',CURRENT_TIMESTAMP,'owner');");
  const before = db.prepare('SELECT * FROM Product').get();
  db.exec(fs.readFileSync(path.join(migrations, '20261003000000_product_manufacture_date/migration.sql'), 'utf8'));
  const after = db.prepare('SELECT * FROM Product').get();
  for (const key of Object.keys(before)) assert.equal(after[key], before[key]);
  assert.equal(after.manufacturingDate, null);
  for (const name of names.filter(name => name > "20261003000000_product_manufacture_date")) db.exec(fs.readFileSync(path.join(migrations, name, "migration.sql"), "utf8"));
  db.close();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  let session = { user: { id: 'owner' } };
  const shelf = load('src/lib/shelf-life.ts', { 'date-fns': require('date-fns') });
  const dates = load('src/lib/product-dates.ts', { './shelf-life': shelf });
  const shared = { 'next-auth/next': { getServerSession: async () => session }, '@/lib/product-dates': dates };
  const apiErrorHandler = (error, res) => res.status(400).json({ message: error.message });
  const create = load('src/pages/api/products/index.ts', { ...shared, '../../../lib/prisma': { prisma }, '../../../lib/apiErrorHandler': { apiErrorHandler }, '../../../lib/auth': { authOptions: {} } }).default;
  const edit = load('src/pages/api/products/[productId].ts', { ...shared, '@/lib/prisma': { prisma }, '@/lib/apiErrorHandler': { apiErrorHandler }, '@/lib/auth': { authOptions: {} } }).default;
  const call = async (handler, method, body, productId) => {
    const res = { code: 200, data: undefined, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler({ method, body, query: { productId } }, res);
    return res;
  };
  try {
    const created = await call(create, 'POST', { name: 'Manufactured', barcode: '12345678', manufacturingDate: '2024-01-31', shelfLife: 1, shelfLifeUnit: 'months', expiryDate: '2099-01-01', userId: 'other' });
    assert.equal(created.code, 201);
    const id = created.data.id;
    assert.equal(created.data.userId, 'owner');
    assert.equal(created.data.expiryDate.toISOString(), '2024-02-29T00:00:00.000Z');
    await call(edit, 'PATCH', { name: 'Renamed' }, id);
    assert.equal((await prisma.product.findUnique({ where: { id } })).manufacturingDate, '2024-01-31');
    const changed = await call(edit, 'PATCH', { manufacturingDate: '2026-12-31', shelfLife: 1, shelfLifeUnit: 'days' }, id);
    assert.equal(changed.data.expiryDate.toISOString(), '2027-01-01T00:00:00.000Z');
    assert.equal((await call(edit, 'PATCH', { manufacturingDate: '2026-02-30', shelfLife: 1, shelfLifeUnit: 'months' }, id)).code, 400);
    assert.equal((await prisma.product.findUnique({ where: { id } })).manufacturingDate, '2026-12-31');
    session = { user: { id: 'other' } };
    assert.equal((await call(edit, 'PATCH', { name: 'Forbidden' }, id)).code, 404);
    assert.equal((await prisma.product.findUnique({ where: { id } })).name, 'Renamed');
    session = null;
    assert.equal((await call(edit, 'PATCH', {}, id)).code, 401);
    session = { user: { id: 'owner' } };
    const cleared = await call(edit, 'PATCH', { expiryDate: null }, id);
    assert.equal(cleared.data.expiryDate, null);
    assert.equal(cleared.data.manufacturingDate, null);
    assert.equal(cleared.data.shelfLife, null);
    assert.equal(cleared.data.shelfLifeUnit, null);
    assert.equal(cleared.data.isExpired, false);
  } finally {
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
