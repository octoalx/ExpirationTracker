const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const { PrismaClient, Role } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

function load(file, modules) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, require(name) {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return exports.default;
}

test('admin role, password and JSON merge preserve disposable SQLite data', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-admin-'));
  const url = path.join(dir, 'test.db');
  const db = new Database(url);
  const migrations = 'prisma/migrations';
  for (const name of fs.readdirSync(migrations).sort()) {
    const file = path.join(migrations, name, 'migration.sql');
    if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
  }
  db.close();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  let session = null;
  const modules = {
    'next-auth': { getServerSession: async () => session },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@prisma/client': { Role },
    '@/lib/apiErrorHandler': { apiErrorHandler: (_error, res) => res.status(500).json({ message: 'Test request failed' }) },
    '@/lib/logger': { logger: { info() {} } }, 'bcryptjs': { default: bcrypt },
  };
  const users = load('src/pages/api/admin/users/[userId].ts', modules);
  const reset = load('src/pages/api/admin/users/[userId]/reset-password.ts', modules);
  const restore = load('src/pages/api/admin/restore.ts', modules);
  const call = async (handler, method, body = {}, userId = 'employee') => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader() {}, end() {} };
    await handler({ method, body, query: { userId } }, res);
    return res;
  };
  try {
    await prisma.user.create({ data: { id: 'admin', email: 'admin@example.invalid', role: 'ADMIN' } });
    await prisma.user.create({ data: { id: 'employee', email: 'employee@example.invalid', password: await bcrypt.hash('fixture-original', 4) } });
    await prisma.product.create({ data: { id: 'record', name: 'Original', barcode: '00123456', expiryDate: null, status: 'ARCHIVED', quantity: null, userId: 'employee' } });
    assert.equal((await call(users, 'PUT', { role: 'ADMIN' })).code, 403);
    session = { user: { id: 'employee', role: 'USER' } };
    assert.equal((await call(reset, 'POST', { password: 'fixture-new' })).code, 403);
    assert.equal((await call(restore, 'POST', { data: { data: {} } })).code, 403);
    session = { user: { id: 'admin', role: 'ADMIN', email: 'admin@example.invalid' } };
    assert.equal((await call(users, 'PUT', { role: 'INVALID' })).code, 400);
    assert.equal((await call(users, 'PUT', { role: 'ADMIN' })).code, 200);
    assert.equal((await prisma.user.findUnique({ where: { id: 'employee' } })).role, 'ADMIN');
    await call(users, 'PUT', { role: 'USER' });
    assert.equal((await call(reset, 'POST', { password: 'short' })).code, 400);
    assert.equal((await call(reset, 'POST', { password: 'fixture-new' })).code, 200);
    const before = await prisma.user.findUnique({ where: { id: 'employee' } });
    assert.ok(await bcrypt.compare('fixture-new', before.password));
    assert.ok(!(await bcrypt.compare('fixture-original', before.password)));
    const product = { id: 'record', name: 'Restored', barcode: '00123456', expiryDate: null, status: 'DEFECT', quantity: null, userId: 'employee' };
    assert.equal((await call(restore, 'POST', { mode: 'merge', data: { data: { products: [product] } } })).code, 200);
    const restored = await prisma.product.findUnique({ where: { id: 'record' } });
    assert.equal(restored.expiryDate, null);
    assert.equal(restored.quantity, null);
    assert.equal(restored.status, 'DEFECT');
    assert.equal(restored.barcode, '00123456');
    assert.equal((await prisma.user.findUnique({ where: { id: 'employee' } })).password, before.password);
    // Exercise the actual file-recovery handler only with closed, disposable snapshot storage.
    await prisma.$disconnect();
    const backupPath = path.join(dir, 'fixture.db');
    fs.copyFileSync(url, backupPath);
    await prisma.product.update({ where: { id: 'record' }, data: { quantity: 42 } });
    await prisma.$disconnect();
    const fileRestore = load('src/pages/api/admin/auto-backups/[filename].ts', {
      ...modules,
      '@/lib/prisma': { prisma, resolvePrismaDbPath: () => url },
      '@/lib/backupService': { listBackups: () => [{ name: 'fixture.db' }], getBackupFilePath: name => name === 'fixture.db' ? backupPath : null },
      fs: { default: fs }, path: { default: path },
    });
    const fileResponse = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await fileRestore({ method: 'POST', query: { filename: 'fixture.db' }, body: {} }, fileResponse);
    assert.equal(fileResponse.code, 200);
    assert.equal((await prisma.product.findUnique({ where: { id: 'record' } })).quantity, null);
    assert.equal((await prisma.user.findUnique({ where: { id: 'employee' } })).password, before.password);
    const emergency = new Database(path.join(dir, fileResponse.data.emergencyBackup), { readonly: true });
    assert.equal(emergency.prepare('SELECT quantity FROM Product WHERE id=?').get('record').quantity, 42);
    assert.equal(emergency.pragma('integrity_check', { simple: true }), 'ok');
    emergency.close();
    assert.equal(await prisma.user.count(), 2);
    const created = { ...product, id: 'new-record', status: 'ACTIVE' };
    assert.equal((await call(restore, 'POST', { data: { data: { products: [created] } } })).code, 200);
    assert.equal((await prisma.product.findUnique({ where: { id: 'new-record' } })).expiryDate, null);
    assert.equal((await call(restore, 'POST', { mode: 'replace', data: { data: { products: [{ ...product, expiryDate: 'invalid' }] } } })).code, 400);
    assert.equal(await prisma.product.count(), 2);
    // A later database error must roll back earlier writes, including replacement deletion.
    const conflictingUsers = [
      { id: 'duplicate', email: 'first@example.invalid' },
      { id: 'duplicate', email: 'second@example.invalid' },
    ];
    assert.equal((await call(restore, 'POST', { mode: 'replace', data: { data: { users: conflictingUsers } } })).code, 500);
    assert.equal(await prisma.user.count(), 2);
    assert.equal(await prisma.product.count(), 2);
    assert.equal((await prisma.user.findUnique({ where: { id: 'employee' } })).password, before.password);
  } finally {
    await prisma.$disconnect();
    // The absolute directory is freshly created by this test under the OS temp directory.
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
