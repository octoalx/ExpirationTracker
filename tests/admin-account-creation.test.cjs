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

test('admin account creation validates access and credentials and preserves existing SQLite records', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-create-user-'));
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
    'next-auth': { getServerSession: async () => session },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@/lib/apiErrorHandler': { apiErrorHandler: error => { throw error; } },
    'bcryptjs': { default: bcrypt },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/pages/api/admin/users/index.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Buffer, require: name => {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  const call = async (body, method = 'POST') => {
    const res = { code: 200, headers: {}, status(code) { this.code = code; return this; },
      json(data) { this.data = data; return this; }, setHeader(name, value) { this.headers[name] = value; } };
    await exports.default({ method, body }, res);
    return res;
  };
  const draft = { name: ' Employee ', email: ' employee@example.invalid ', password: 'fixture-password' };
  try {
    await prisma.user.create({ data: { id: 'owner', email: 'owner@example.invalid', role: 'ADMIN' } });
    const product = await prisma.product.create({ data: { name: 'Existing', barcode: '001', userId: 'owner', status: 'ACTIVE' } });
    assert.equal((await call(draft)).code, 403);
    session = { user: { id: 'employee', role: 'USER' } };
    assert.equal((await call(draft)).code, 403);
    assert.equal(await prisma.user.count(), 1);
    session = { user: { id: 'owner', role: 'ADMIN' } };
    const unsupported = await call(draft, 'DELETE');
    assert.equal(unsupported.code, 405);
    assert.equal(unsupported.headers.Allow, 'GET, POST');
    for (const body of [null, [], 'invalid', {}, { ...draft, name: ' ' }, { ...draft, email: 'invalid' },
      { ...draft, password: 'short' }, { ...draft, password: 12345678 }, { ...draft, password: 'я'.repeat(37) },
      { ...draft, role: 'INVALID' }, { ...draft, role: null }]) {
      assert.equal((await call(body)).code, 400);
    }
    assert.equal(await prisma.user.count(), 1);
    const created = await call(draft);
    assert.equal(created.code, 201);
    assert.deepEqual(Object.keys(created.data).sort(), ['email', 'id', 'name', 'role']);
    assert.equal(created.data.name, 'Employee');
    assert.equal(created.data.email, 'employee@example.invalid');
    assert.equal(created.data.role, 'USER');
    const stored = await prisma.user.findUnique({ where: { id: created.data.id } });
    assert.notEqual(stored.password, draft.password);
    assert.ok(await bcrypt.compare(draft.password, stored.password));
    const authExports = {};
    const authCode = ts.transpileModule(fs.readFileSync('src/lib/auth.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const authModules = {
      'next-auth/providers/credentials': { default: options => options },
      './prisma': { prisma }, 'bcryptjs': { default: bcrypt },
      './logger': { logger: { warn() {}, error() {} } },
    };
    vm.runInNewContext(authCode, { exports: authExports, require: name => {
      if (!(name in authModules)) throw new Error(`Unexpected dependency: ${name}`);
      return authModules[name];
    } });
    const authorize = authExports.authOptions.providers[0].authorize;
    assert.equal((await authorize({ email: created.data.email, password: draft.password })).id, created.data.id);
    assert.equal(await authorize({ email: created.data.email, password: 'wrong-password' }), null);
    assert.equal((await call(draft)).code, 409);
    const admin = await call({ ...draft, email: 'second-admin@example.invalid', role: 'ADMIN' });
    assert.equal(admin.code, 201);
    assert.equal(admin.data.role, 'ADMIN');
    const concurrent = await Promise.all([call({ ...draft, email: 'race@example.invalid' }), call({ ...draft, email: 'race@example.invalid' })]);
    assert.deepEqual(concurrent.map(res => res.code).sort(), [201, 409]);
    const list = await call(undefined, 'GET');
    assert.equal(list.code, 200);
    assert.equal(list.data.length, 4);
    assert.ok(list.data.every(user => !('password' in user)));
    assert.deepEqual(await prisma.product.findUnique({ where: { id: product.id } }), product);
    assert.equal(await prisma.settings.count(), 0, 'No integrations or notification settings are created');
  } finally {
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
