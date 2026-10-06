const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

test('account settings verify credentials, ownership, atomic conflicts and password hashing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-profile-'));
  const url = path.join(dir, 'test.db');
  const db = new Database(url);
  for (const name of fs.readdirSync('prisma/migrations').sort()) {
    const file = path.join('prisma/migrations', name, 'migration.sql');
    if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
  }
  db.close();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  let session = null;
  const modules = {
    'next-auth/next': { getServerSession: async () => session },
    '../../lib/auth': { authOptions: {} }, '../../lib/prisma': { prisma },
    '../../lib/apiErrorHandler': { apiErrorHandler: error => { throw error; } },
    '../../lib/logger': { logger: { info() {} } }, 'zod': require('zod'),
    'bcryptjs': { default: bcrypt },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/pages/api/settings.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, require: name => {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  const call = async (body, method = 'POST') => {
    const res = { code: 200, status(code) { this.code = code; return this; },
      json(data) { this.data = data; return this; }, setHeader() {}, end() {} };
    await exports.default({ method, body, query: {} }, res);
    return res;
  };
  const draft = { user: { name: ' New name ', email: 'owner@example.invalid' },
    settings: { urgentThreshold: 3, warningThreshold: 7, role: 'ADMIN', userId: 'other', backupEnabled: false } };
  try {
    await prisma.user.create({ data: { id: 'owner', email: draft.user.email, password: await bcrypt.hash('old-password', 10) } });
    const other = await prisma.user.create({ data: { id: 'other', email: 'other@example.invalid', name: 'Other' } });
    assert.equal((await call(draft)).code, 401);
    session = { user: { id: 'owner' } };
    for (const invalid of [null, {}, { ...draft, user: { ...draft.user, name: ' ' } },
      { ...draft, user: { ...draft.user, email: 'invalid' } },
      { ...draft, settings: { urgentThreshold: 8, warningThreshold: 7 } },
      { ...draft, newPassword: 'short' }, { ...draft, newPassword: 'я'.repeat(37) },
      { ...draft, newPassword: 'new-password', currentPassword: 'wrong' }]) {
      assert.equal((await call(invalid)).code, 400);
    }
    assert.equal((await call(draft)).code, 200);
    assert.equal((await prisma.user.findUnique({ where: { id: 'owner' } })).name, 'New name');
    const storedSettings = await prisma.settings.findUnique({ where: { userId: 'owner' } });
    assert.equal(storedSettings.backupEnabled, true);
    const changed = { ...draft, user: { name: 'Changed', email: 'changed@example.invalid' }, newPassword: 'new-password' };
    assert.equal((await call(changed)).code, 400);
    assert.equal((await call({ ...changed, currentPassword: 'old-password' })).code, 200);
    const stored = await prisma.user.findUnique({ where: { id: 'owner' } });
    assert.ok(await bcrypt.compare('new-password', stored.password));
    assert.equal(await bcrypt.compare('old-password', stored.password), false);
    assert.equal(stored.role, 'USER');
    assert.equal((await call({ ...changed, currentPassword: 'new-password',
      user: { name: 'Must not save', email: other.email }, settings: { urgentThreshold: 1, warningThreshold: 2 } })).code, 409);
    assert.deepEqual(await prisma.user.findUnique({ where: { id: 'owner' } }), stored);
    assert.deepEqual(await prisma.settings.findUnique({ where: { userId: 'owner' } }), storedSettings);
    assert.deepEqual(await prisma.user.findUnique({ where: { id: 'other' } }), other);
    const response = await call(undefined, 'GET');
    assert.equal(response.data.user.email, changed.user.email);
    assert.equal('password' in response.data.user, false);
    assert.equal('smtpPass' in response.data.settings, false);
    const authExports = {};
    const authModules = { 'next-auth/providers/credentials': { default: options => options },
      './prisma': { prisma }, 'bcryptjs': { default: bcrypt },
      './logger': { logger: { warn() {}, error() {} } } };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/auth.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports: authExports, require: name => authModules[name] });
    const auth = authExports.authOptions;
    assert.equal((await auth.providers[0].authorize({ email: changed.user.email, password: 'new-password' })).id, 'owner');
    assert.equal(await auth.providers[0].authorize({ email: draft.user.email, password: 'old-password' }), null);
    const token = await auth.callbacks.jwt({ token: { id: 'owner', email: draft.user.email, role: 'USER' },
      trigger: 'update', session: { user: { id: 'other', role: 'ADMIN' } } });
    assert.equal(token.id, 'owner'); assert.equal(token.role, 'USER');
    assert.equal(token.email, changed.user.email); assert.equal(token.name, 'Changed');
  } finally {
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
