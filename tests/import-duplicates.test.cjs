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

/**
 * Two departments with one manager each. The duplicate rule must be scoped by
 * department, so the second department is what proves foreign rows are invisible.
 */
async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-duplicates-'));
  const url = path.join(dir, 'test.db');
  const sqlite = new Database(url);
  const migrations = path.join(__dirname, '../prisma/migrations');
  for (const name of fs.readdirSync(migrations).sort()) {
    const file = path.join(migrations, name, 'migration.sql');
    if (fs.existsSync(file)) sqlite.exec(fs.readFileSync(file, 'utf8'));
  }
  sqlite.exec(
    "INSERT INTO User (id) VALUES ('manager'), ('outsider');" +
    "INSERT INTO Store (id,name) VALUES ('dep','Отдел'), ('other','Другой отдел');" +
    "INSERT INTO StoreMembership (id,storeId,userId,role) VALUES ('m1','dep','manager','MANAGER'), ('m2','other','outsider','MANAGER');"
  );
  sqlite.close();

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  t.after(async () => {
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  let session = { user: { id: 'manager' } };
  const inventory = load('src/lib/inventory-import.ts', {});
  const handler = load('src/pages/api/products/import.ts', {
    'next-auth/next': { getServerSession: async () => session },
    '../../../lib/auth': { authOptions: {} },
    '../../../lib/prisma': { prisma },
    '../../../lib/inventory-import': inventory,
  }).default;

  const call = async (products, as = 'manager') => {
    session = { user: { id: as } };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler({ method: 'POST', body: { products } }, res);
    return res;
  };

  return { prisma, call };
}

const ITEM = { barcode: '0012345678901', name: 'Сметана', expiryDate: '2026-11-20' };

test('a repeated import does not create a second row for the same barcode and date', async (t) => {
  const { prisma, call } = await fixture(t);

  const first = await call([ITEM, { ...ITEM, barcode: '12345678', name: 'Хлеб', expiryDate: '2026-11-01' }]);
  assert.equal(first.code, 200);
  assert.equal(first.data.imported, 2);
  assert.equal(first.data.skipped, 0, 'the first import has nothing to skip');

  const second = await call([ITEM, { ...ITEM, barcode: '12345678', name: 'Хлеб', expiryDate: '2026-11-01' }]);
  assert.equal(second.code, 200);
  assert.equal(second.data.imported, 0, 'AC1: nothing new is created');
  assert.equal(second.data.skipped, 2, 'AC1: both rows are reported as already present');
  assert.equal(await prisma.product.count({ where: { storeId: 'dep' } }), 2);

  // A third upload of the same file still changes nothing.
  const third = await call([ITEM]);
  assert.equal(third.data.imported, 0);
  assert.equal(third.data.skipped, 1);
  assert.equal(await prisma.product.count(), 2);
});

test('a different expiry date stays a separate batch', async (t) => {
  const { prisma, call } = await fixture(t);

  await call([ITEM]);
  const other = await call([{ ...ITEM, expiryDate: '2026-12-20' }]);
  assert.equal(other.code, 200);
  assert.equal(other.data.imported, 1, 'AC2: another date is another batch');
  assert.equal(other.data.skipped, 0);

  const rows = await prisma.product.findMany({ where: { storeId: 'dep' }, orderBy: { expiryDate: 'asc' } });
  assert.deepEqual(rows.map((row) => row.expiryDate.toISOString().slice(0, 10)), ['2026-11-20', '2026-12-20']);
});

test('quantities are summed only when both are present', async (t) => {
  const { prisma, call } = await fixture(t);

  await call([{ ...ITEM, quantity: 5 }]);
  const summed = await call([{ ...ITEM, quantity: 3 }]);
  assert.equal(summed.data.imported, 0);
  assert.equal(summed.data.skipped, 1);
  let row = await prisma.product.findFirst({ where: { storeId: 'dep', barcode: ITEM.barcode } });
  assert.equal(row.quantity, 8, 'AC3: both quantities present, sum is stored');

  const emptyIncoming = await call([{ ...ITEM }]);
  assert.equal(emptyIncoming.data.skipped, 1);
  row = await prisma.product.findFirst({ where: { storeId: 'dep', barcode: ITEM.barcode } });
  assert.equal(row.quantity, 8, 'AC3: an incoming empty quantity changes nothing');

  const emptyExisting = { barcode: '12345678', name: 'Хлеб', expiryDate: '2026-11-01' };
  await call([emptyExisting]);
  const withQuantity = await call([{ ...emptyExisting, quantity: 4 }]);
  assert.equal(withQuantity.data.skipped, 1);
  const bread = await prisma.product.findFirst({ where: { storeId: 'dep', barcode: emptyExisting.barcode } });
  assert.equal(bread.quantity, null, 'AC3: an existing empty quantity stays empty');
  assert.equal(await prisma.product.count({ where: { storeId: 'dep' } }), 2);
});

test('another department does not count as a duplicate', async (t) => {
  const { prisma, call } = await fixture(t);

  await call([ITEM], 'outsider');
  const own = await call([ITEM], 'manager');
  assert.equal(own.data.imported, 1, 'the same barcode in another department is a new row here');
  assert.equal(own.data.skipped, 0);
  assert.equal(await prisma.product.count({ where: { storeId: 'dep' } }), 1);
  assert.equal(await prisma.product.count({ where: { storeId: 'other' } }), 1);
});

// Rewritten under docs/specs/2026-10-23-import-partial-rows.md (Contract change).
// The old version asserted a whole-batch 400, which is the defect being fixed:
// since 2026-10-23 a broken row is skipped and named, the valid rows land.
test('a failing row leaves no row of its own and no partial write', async (t) => {
  const { prisma, call } = await fixture(t);

  const mixed = await call([ITEM, { barcode: '12345678', name: 'Хлеб', expiryDate: '2026-02-30' }]);
  assert.equal(mixed.code, 200, 'a broken row does not cancel the batch');
  assert.equal(mixed.data.imported, 1, 'the valid row is imported');
  assert.equal(mixed.data.rejected, 1, 'the broken row is reported');
  assert.equal(await prisma.product.count(), 1, 'the broken row wrote nothing');

  // The merge still happens when the duplicate arrives in the batch that carries
  // the broken row; the broken row itself changes nothing.
  const { prisma: fresh, call: freshCall } = await fixture(t);
  await freshCall([{ ...ITEM, quantity: 4 }]);
  const together = await freshCall([{ ...ITEM, quantity: 6 }, { barcode: '22222222', name: 'Кефир', expiryDate: '2026-02-30' }]);
  assert.equal(together.code, 200);
  assert.equal(together.data.skipped, 1, 'the valid duplicate is merged');
  assert.equal(together.data.rejected, 1, 'the broken row is refused');
  const merged = await fresh.product.findFirst({ where: { storeId: 'dep', barcode: ITEM.barcode } });
  assert.equal(merged.quantity, 10, '4 + 6 = 10 with a broken row in the same batch');
  assert.equal(await fresh.product.count({ where: { storeId: 'dep' } }), 1, 'the broken row left no row');
});
