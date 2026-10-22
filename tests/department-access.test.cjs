const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const bcrypt = require('bcryptjs');
const { disposable, storeFixture } = require('./helpers/disposable.ts');
const offline = require('./helpers/offline-modules.cjs');
const inventory = require('../src/lib/server/inventory.ts');
const departments = require('../src/lib/server/departments.ts');
const errors = require('../src/lib/server/errors.ts');

function load(file, modules, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, process, Date, Map, Set, structuredClone, ...globals,
    require(name) { if (name in modules) return modules[name]; if (name in offline) return offline[name]; return require(name); } });
  return exports;
}

/** Routes plus a switchable session, against real disposable SQLite storage. */
async function fixture(t, seeded = false) {
  const { db } = seeded ? await storeFixture(t) : await disposable(t);
  let session = null;
  const auth = { getServerSession: async () => session };
  const api = load('src/lib/server/api.ts', { 'next-auth/next': auth, '../auth': { authOptions: {} }, './inventory': inventory, './errors': errors });
  const modules = { 'next-auth/next': auth, 'next-auth': auth,
    '@/lib/auth': { authOptions: {} }, '../../../lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: db }, '../../../lib/prisma': { prisma: db },
    '@/lib/server/api': api, '@/lib/server/inventory': inventory, '@/lib/server/departments': departments,
    '@/lib/apiErrorHandler': errors, '../../../lib/apiErrorHandler': { apiErrorHandler: errors.apiFailure },
    '@/lib/catalog-parser': require('../src/lib/catalog-parser.ts'),
    '@/lib/logger': { logger: { info() {}, warn() {}, error() {} } },
    '../../lib/logger': { logger: { info() {}, warn() {}, error() {} } },
  };
  const call = async (file, method, body = {}, query = {}) => {
    const res = { code: 200, headers: {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, end() {},
      setHeader(name, value) { this.headers[name] = value; } };
    await load(file, modules).default({ method, body, query, headers: {} }, res);
    return res;
  };
  return { db, call, login(id, role = 'USER') { session = id ? { user: { id, role, name: id, email: `${id}@example.invalid` } } : null; } };
}

test('registration founds a department with its manager and rolls back completely on a taken email', async t => {
  const { db, call } = await fixture(t);
  const register = 'src/pages/api/auth/register.ts';
  for (const body of [{}, { name: 'A', email: 'a@example.invalid' }, { name: 'A', email: 'a@example.invalid', password: 'fixture-password' },
    { name: 'A', email: 'a@example.invalid', password: 'short', department: 'Склад' },
    { name: 'A', email: 'broken', password: 'fixture-password', department: 'Склад' },
    { name: 'A', email: 'a@example.invalid', password: 'fixture-password', department: '  ' }]) {
    assert.equal((await call(register, 'POST', body)).code, 400);
  }
  const created = await call(register, 'POST', { name: ' Анна ', email: 'anna@example.invalid', password: 'fixture-password', department: ' Склад №1 ' });
  assert.equal(created.code, 201);
  assert.equal(created.data.department, 'Склад №1');
  const user = await db.user.findUniqueOrThrow({ where: { email: 'anna@example.invalid' } });
  const membership = await db.storeMembership.findUniqueOrThrow({ where: { userId: user.id } });
  assert.equal(membership.role, 'MANAGER');
  assert.equal((await db.store.findUniqueOrThrow({ where: { id: membership.storeId } })).name, 'Склад №1');
  assert.ok(await bcrypt.compare('fixture-password', user.password));
  assert.ok(user.name === 'Анна');
  assert.ok(await db.settings.findUnique({ where: { userId: user.id } }), 'notification settings are created with the account');
  // The taken email refuses the whole transaction: no department without a manager.
  assert.equal((await call(register, 'POST', { name: 'Second', email: 'anna@example.invalid', password: 'fixture-password', department: 'Другой' })).code, 409);
  assert.equal(await db.store.count(), 1);
  assert.equal(await db.user.count(), 1);
  assert.equal((await call(register, 'GET')).code, 405);
});

test('a department table is invisible to every other department and to accounts without one', async t => {
  const { db } = await disposable(t);
  const first = await departments.registerDepartment(db, { name: 'Manager One', email: 'one@example.invalid', password: 'fixture-password', department: 'Первый' });
  const second = await departments.registerDepartment(db, { name: 'Manager Two', email: 'two@example.invalid', password: 'fixture-password', department: 'Второй' });
  const hired = await departments.createEmployee(db, first.user.id, { name: 'Employee', email: 'worker@example.invalid', password: 'fixture-password' });
  const owned = await db.product.create({ data: { id: 'row', name: 'Owned', barcode: '01234567', storeId: first.store.id, userId: hired.id } });
  assert.equal((await db.storeMembership.findUniqueOrThrow({ where: { userId: hired.id } })).role, 'EMPLOYEE');
  // The employee's scope is the department table, not their own rows.
  assert.deepEqual(await inventory.inventoryScope(db, hired.id).then(scope => scope.where), { storeId: first.store.id, deletedAt: null });
  assert.equal(await db.product.count({ where: (await inventory.inventoryScope(db, first.user.id)).where }), 1);
  assert.equal(await db.product.count({ where: (await inventory.inventoryScope(db, second.user.id)).where }), 0);
  await assert.rejects(inventory.accessibleProduct(db, second.user.id, owned.id), { status: 404 });
  const lonely = await db.user.create({ data: { id: 'lonely', email: 'lonely@example.invalid' } });
  await assert.rejects(inventory.inventoryScope(db, lonely.id), { status: 403 });
  await assert.rejects(inventory.worklist(db, lonely.id), { status: 403 });
  await assert.rejects(departments.createEmployee(db, hired.id, { name: 'Nope', email: 'nope@example.invalid', password: 'fixture-password' }), { status: 403 });
  // Hiring twice with one email is refused, and a manager cannot name a second manager.
  await assert.rejects(departments.createEmployee(db, first.user.id, { name: 'Duplicate', email: 'worker@example.invalid', password: 'fixture-password' }), { status: 409 });
  assert.equal(await db.storeMembership.count({ where: { storeId: first.store.id, role: 'MANAGER' } }), 1);
  // Revocation keeps the rows and releases authorship.
  await departments.revokeMembership(db, first.user.id, hired.id);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: owned.id } })).userId, null);
  assert.equal(await db.storeMembership.count({ where: { userId: hired.id } }), 0);
});

test('the administrator runs departments, opens one logged support visit at a time and never reads rows', async t => {
  const { db, call, login } = await fixture(t);
  const route = 'src/pages/api/admin/departments.ts', products = 'src/pages/api/products/index.ts';
  await db.user.create({ data: { id: 'admin', name: 'Admin', email: 'admin@example.invalid', role: 'ADMIN' } });
  await db.user.create({ data: { id: 'free', name: 'Free', email: 'free@example.invalid' } });
  await db.user.create({ data: { id: 'candidate', name: 'Candidate', email: 'candidate@example.invalid' } });
  const rows = await db.store.create({ data: { id: 'main', name: 'Основной' } });
  await db.storeMembership.create({ data: { userId: 'free', storeId: rows.id, role: 'EMPLOYEE' } });
  const row = await db.product.create({ data: { id: 'row', name: 'Row', barcode: '01234567', storeId: rows.id, userId: 'free' } });

  // Only the administrator reaches the registry.
  login('free');
  assert.equal((await call(route, 'GET')).code, 403);
  assert.equal((await call(route, 'POST', { operation: 'create', name: 'X' })).code, 403);
  login('admin', 'ADMIN');
  assert.equal((await call(products, 'GET')).code, 403);
  assert.equal((await call(products, 'POST', { name: 'Nope', barcode: '0123456789012' })).code, 403);

  const overview = await call(route, 'GET');
  assert.equal(overview.code, 200);
  assert.deepEqual(overview.data.departments.map(d => d.name), ['Основной']);
  assert.equal(overview.data.departments[0].memberCount, 1);
  assert.equal('products' in overview.data.departments[0], false, 'no product data reaches the administrator');
  assert.deepEqual(overview.data.unassigned.map(u => u.id), ['admin', 'candidate']);

  const noManager = await call(route, 'POST', { operation: 'create', name: 'Пустой' });
  assert.equal(noManager.code, 201); assert.equal(noManager.data.manager, null);
  assert.equal((await call(route, 'POST', { operation: 'create', name: 'С руководителем', managerEmail: 'missing@example.invalid' })).code, 404);
  assert.equal((await call(route, 'POST', { operation: 'create', name: ' ' })).code, 400);
  const created = await call(route, 'POST', { operation: 'create', name: 'Новый', managerEmail: 'candidate@example.invalid' });
  assert.equal(created.code, 201); assert.equal(created.data.manager.userId, 'candidate');
  assert.equal((await db.storeMembership.findUniqueOrThrow({ where: { userId: 'candidate' } })).role, 'MANAGER');
  // An account inside another department is never pulled into a second one.
  assert.equal((await call(route, 'POST', { operation: 'appoint', storeId: created.data.store.id, userId: 'free' })).code, 409);
  // An administrator never becomes a department manager.
  assert.equal((await call(route, 'POST', { operation: 'appoint', storeId: created.data.store.id, userId: 'admin' })).code, 409);
  // Ownership transfer demotes the previous manager instead of adding a second one.
  const successor = await db.user.create({ data: { id: 'successor', name: 'Successor', email: 'successor@example.invalid' } });
  assert.equal((await call(route, 'POST', { operation: 'appoint', storeId: created.data.store.id, userId: successor.id })).code, 200);
  assert.equal((await db.storeMembership.findUniqueOrThrow({ where: { userId: 'successor' } })).role, 'MANAGER');
  assert.equal((await db.storeMembership.findUniqueOrThrow({ where: { userId: 'candidate' } })).role, 'EMPLOYEE');
  assert.equal(await db.storeMembership.count({ where: { storeId: created.data.store.id, role: 'MANAGER' } }), 1);
  assert.equal((await call(route, 'POST', { operation: 'rename', storeId: created.data.store.id, name: 'Переименован' })).code, 200);
  assert.equal((await db.store.findUniqueOrThrow({ where: { id: created.data.store.id } })).name, 'Переименован');

  // Temporary support access: the administrator joins, reads and leaves, and both steps are logged.
  assert.equal((await call(route, 'POST', { operation: 'support', storeId: rows.id })).code, 200);
  assert.equal((await call(route, 'POST', { operation: 'support', storeId: rows.id })).code, 409);
  const visited = await call(products, 'GET');
  assert.equal(visited.code, 200); assert.deepEqual(visited.data.products.map(p => p.id), [row.id]);
  // A support visit reads the table but never reconfigures the department.
  assert.equal((await call('src/pages/api/store/settings.ts', 'POST', { urgentThreshold: 9, warningThreshold: 9 })).code, 403);
  assert.equal((await db.store.findUniqueOrThrow({ where: { id: rows.id } })).urgentThreshold, 3);
  const events = await db.productEvent.findMany({ where: { action: 'SUPPORT_ACCESS' } });
  assert.equal(events.length, 1); assert.equal(events[0].storeId, rows.id); assert.equal(events[0].productId, null);
  assert.equal((await call(route, 'POST', { operation: 'supportEnd' })).code, 200);
  assert.equal((await call(products, 'GET')).code, 403);
  assert.equal(await db.productEvent.count({ where: { action: 'SUPPORT_ACCESS_REVOKED' } }), 1);
  assert.equal((await call(route, 'POST', { operation: 'supportEnd' })).code, 404);

  // Deletion needs the exact name, and it takes the rows and the members with it.
  assert.equal((await call(route, 'POST', { operation: 'delete', storeId: rows.id, confirm: 'wrong' })).code, 400);
  assert.equal((await call(route, 'POST', { operation: 'delete', storeId: rows.id, confirm: 'Основной' })).code, 200);
  assert.equal(await db.store.count({ where: { id: rows.id } }), 0);
  assert.equal(await db.storeMembership.count({ where: { storeId: rows.id } }), 0);
  assert.equal(await db.product.count(), 0);
  assert.equal(await db.productEvent.count({ where: { action: 'DEPARTMENT_DELETED', storeId: rows.id } }), 1);
  assert.equal((await call(route, 'POST', { operation: 'unknown' })).code, 400);
});

test('barcode lookup falls back to the shared reference and keeps the personal name first', async t => {
  const { db, call, login } = await fixture(t, true);
  const catalog = 'src/pages/api/catalog/index.ts';
  await db.sharedCatalogEntry.create({ data: { barcode: '4000000000001', name: 'Общее название' } });
  await db.catalogEntry.create({ data: { userId: 'employee', barcode: '4000000000001', name: 'Моё название' } });
  await db.catalogEntry.create({ data: { userId: 'employee', barcode: '4000000000002', name: 'Только моё' } });
  login('employee');
  assert.equal((await call(catalog, 'GET', {}, { barcode: '4000000000001' })).data.name, 'Моё название');
  assert.equal((await call(catalog, 'GET', {}, { barcode: '4000000000002' })).data.name, 'Только моё');
  login('outsider');
  assert.equal((await call(catalog, 'GET', {}, { barcode: '4000000000001' })).data.name, 'Общее название');
  assert.equal((await call(catalog, 'GET', {}, { barcode: '4000000000002' })).code, 404);
  assert.equal((await call(catalog, 'GET', {}, { barcode: 'nope' })).code, 400);
});

test('an archive without departments restores what it can and reports the products it drops', async t => {
  const { db, call, login } = await fixture(t, true);
  login('admin', 'ADMIN');
  // A v1.0 archive knows an owner for every product but no department; one row also
  // names a department this database does not have.
  const archive = { mode: 'merge', data: { version: '1.0', exportedAt: '2026-10-01T00:00:00.000Z', data: {
    users: [{ id: 'legacy', name: 'Legacy', email: 'legacy@example.invalid', role: 'USER' }],
    products: [
      { id: 'no-department', name: 'Личный', barcode: '4600000000010', userId: 'legacy', status: 'ACTIVE' },
      { id: 'in-department', name: 'Общий', barcode: '4600000000011', userId: 'legacy', storeId: 'main', status: 'ACTIVE' },
      { id: 'unknown-department', name: 'Чужой', barcode: '4600000000012', userId: 'legacy', storeId: 'ghost', status: 'ACTIVE' },
    ],
  } } };
  const restored = await call('src/pages/api/admin/restore.ts', 'POST', archive);
  assert.equal(restored.code, 200, JSON.stringify(restored.data));
  assert.equal(restored.data.results.products.created, 1);
  assert.equal(restored.data.results.products.missingDepartment, 2);
  assert.deepEqual((await db.product.findMany()).map(p => p.id), ['in-department']);
  assert.equal((await db.product.findFirstOrThrow()).storeId, 'main');
});
