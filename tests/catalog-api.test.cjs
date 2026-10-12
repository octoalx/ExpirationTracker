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
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return exports;
}
function response() {
  return { code: 200, data: undefined, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader() {} };
}

test('catalog/import APIs preserve data, isolate owners and validate before writes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-catalog-'));
  const url = path.join(dir, 'test.db');
  const db = new Database(url);
  const migrations = path.join(__dirname, '../prisma/migrations');
  const names = fs.readdirSync(migrations).filter(name => fs.existsSync(path.join(migrations, name, 'migration.sql'))).sort();
  for (const name of names.filter(name => !name.startsWith('20261002'))) db.exec(fs.readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8'));
  db.exec("INSERT INTO User (id) VALUES ('owner'), ('other'); INSERT INTO Product (id,name,barcode,updatedAt,userId) VALUES ('existing','Existing','12345678',CURRENT_TIMESTAMP,'owner');");
  db.exec(fs.readFileSync(path.join(migrations, '20261002000000_add_product_catalog/migration.sql'), 'utf8'));
  assert.equal(db.prepare('SELECT name FROM Product WHERE id=?').get('existing').name, 'Existing');
  db.close();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  let session = { user: { id: 'owner' } };
  const auth = { getServerSession: async () => session };
  const catalogParser = load('src/lib/catalog-parser.ts', {});
  const catalog = load('src/pages/api/catalog/index.ts', { 'next-auth/next': auth, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/catalog-parser': catalogParser }).default;
  const inventory = load('src/pages/api/products/import.ts', { 'next-auth/next': auth, '../../../lib/auth': { authOptions: {} }, '../../../lib/prisma': { prisma } }).default;
  const call = async (handler, method, body = {}, query = {}) => { const res = response(); await handler({ method, body, query }, res); return res; };
  try {
    const entries = [{ barcode: '0123456789012', name: 'Catalog A' }];
    assert.equal((await call(catalog, 'POST', { entries, userId: 'other' })).code, 200);
    await call(catalog, 'POST', { entries });
    assert.equal(await prisma.catalogEntry.count(), 1);
    assert.equal((await call(catalog, 'GET', {}, { barcode: entries[0].barcode })).data.name, 'Catalog A');
    session = { user: { id: 'other' } };
    assert.equal((await call(catalog, 'GET', {}, { barcode: entries[0].barcode })).code, 404);
    session = null;
    assert.equal((await call(catalog, 'POST', { entries })).code, 401);
    assert.equal((await call(inventory, 'POST', { products: [] })).code, 401);
    session = { user: { id: 'owner' } };
    const products = [{ barcode: '0123456789012', name: 'Excel batch', quantity: null }];
    const before = Date.now();
    assert.equal((await call(inventory, 'POST', { products, userId: 'other' })).data.imported, 1);
    const batch = await prisma.product.findFirst({ where: { name: 'Excel batch' } });
    assert.equal(batch.userId, 'owner');
    assert.ok(batch.expiryDate.getTime() >= before && batch.expiryDate.getTime() <= Date.now());
    assert.equal((await call(inventory, 'POST', { products: [] })).code, 400);
  } finally {
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
