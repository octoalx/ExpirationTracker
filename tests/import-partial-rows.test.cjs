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
    if (!(name in modules)) { const offline = require('./helpers/offline-modules.cjs'); if (name in offline) return offline[name]; throw new Error(`Unexpected dependency: ${name}`); }
    return modules[name];
  } });
  return exports;
}

/** One department with one manager, on disposable SQLite. */
async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-partial-'));
  const url = path.join(dir, 'test.db');
  const sqlite = new Database(url);
  const migrations = path.join(__dirname, '../prisma/migrations');
  for (const name of fs.readdirSync(migrations).sort()) {
    const file = path.join(migrations, name, 'migration.sql');
    if (fs.existsSync(file)) sqlite.exec(fs.readFileSync(file, 'utf8'));
  }
  sqlite.exec(
    "INSERT INTO User (id) VALUES ('manager');" +
    "INSERT INTO Store (id,name) VALUES ('dep','Отдел');" +
    "INSERT INTO StoreMembership (id,storeId,userId,role) VALUES ('m1','dep','manager','MANAGER');"
  );
  sqlite.close();

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  t.after(async () => {
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const inventory = load('src/lib/inventory-import.ts', {});
  const handler = load('src/pages/api/products/import.ts', {
    'next-auth/next': { getServerSession: async () => ({ user: { id: 'manager' } }) },
    '../../../lib/auth': { authOptions: {} },
    '../../../lib/prisma': { prisma },
    '../../../lib/inventory-import': inventory,
  }).default;

  const call = async products => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler({ method: 'POST', body: { products } }, res);
    return res;
  };

  return { prisma, call };
}

const CREAM = { barcode: '0012345678901', name: 'Сметана', expiryDate: '2026-11-20' };
const BREAD = { barcode: '12345678', name: 'Хлеб', expiryDate: '2026-11-01' };
const BROKEN_DATE = { barcode: '22222222', name: 'Кефир', expiryDate: '2026-02-30' };

test('valid rows are imported when one row is invalid', async (t) => {
  const { prisma, call } = await fixture(t);

  const mixed = await call([CREAM, BREAD, BROKEN_DATE]);
  assert.equal(mixed.code, 200, 'AC1: a broken row is not a failed request');
  assert.equal(mixed.data.imported, 2, 'AC1: both valid rows land');
  assert.equal(mixed.data.skipped, 0);

  const rows = await prisma.product.findMany({ where: { storeId: 'dep' }, orderBy: { barcode: 'asc' } });
  assert.deepEqual(rows.map(row => row.barcode), [CREAM.barcode, BREAD.barcode], 'AC1: exactly the valid rows');
});

test('the rejected row is named and writes nothing', async (t) => {
  const { prisma, call } = await fixture(t);

  const mixed = await call([CREAM, BROKEN_DATE, BREAD]);
  assert.equal(mixed.data.rejected, 1, 'AC2: the count of refused rows');
  assert.equal(mixed.data.errors.length, 1, 'AC2: one reason per refused row');
  assert.match(mixed.data.errors[0], /Строка 2/, 'AC2: the reason names the position in the batch');
  assert.match(mixed.data.errors[0], /дата/, 'AC2: the reason names the field');

  const rows = await prisma.product.findMany({ where: { storeId: 'dep' } });
  assert.equal(rows.length, 2, 'AC2: the refused row created nothing');
  assert.equal(rows.some(row => row.barcode === BROKEN_DATE.barcode), false, 'AC2: no row for the refused barcode');
});

test('payload failures still answer 400', async (t) => {
  const { prisma, call } = await fixture(t);

  for (const [label, payload] of [
    ['not a list', { products: 'nope' }],
    ['an empty list', { products: [] }],
    ['too many rows', { products: Array.from({ length: 10001 }, () => CREAM) }],
  ]) {
    const res = await call(payload.products);
    assert.ok(res.code === 400 || res.code === 200, `AC5: ${label} was answered`);
    assert.equal(res.code, 400, `AC5: ${label} is a broken request`);
  }
  assert.equal(await prisma.product.count(), 0, 'AC5: a broken payload writes nothing');
});

test('an all-invalid batch imports nothing and names every row', async (t) => {
  const { prisma, call } = await fixture(t);

  const allBad = await call([BROKEN_DATE, { barcode: '', name: 'Пустой штрихкод' }, { barcode: '333', name: 'Кефир', quantity: 0 }]);
  assert.equal(allBad.code, 200, 'AC5: nothing importable is a result, not a broken request');
  assert.equal(allBad.data.imported, 0);
  assert.equal(allBad.data.rejected, 3);
  assert.equal(allBad.data.errors.length, 3, 'AC5: every refused row is named');
  assert.equal(await prisma.product.count(), 0, 'AC5: nothing is written');
});
