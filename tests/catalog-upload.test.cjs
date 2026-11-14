// Server-side DBF pair upload: framing, auth, validation, batched upsert, partial failure.
// Runs under tsx (see package.json test:app); uses a disposable SQLite with every migration applied.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { Readable } = require('node:stream');
const ts = require('typescript');
const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const format = require('../src/lib/catalog-upload-format.ts');
const { importCatalogUpload, CATALOG_BATCH_SIZE } = require('../src/lib/server/catalog-upload.ts');

/** Loads a route file with its `@/` imports replaced by test doubles. */
function load(file, modules) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return exports;
}

function response() {
  return { code: 200, data: undefined, headers: {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader(k, v) { this.headers[k] = v; } };
}

function disposableDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-upload-'));
  const url = path.join(dir, 'test.db');
  const db = new Database(url);
  const migrations = path.join(__dirname, '../prisma/migrations');
  for (const name of fs.readdirSync(migrations).sort()) {
    const file = path.join(migrations, name, 'migration.sql');
    if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
  }
  db.close();
  return { dir, prisma: new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) }) };
}

/**
 * Builds a dBase III file. Fields are ASCII because the synthetic fixtures do not exercise
 * Windows-1251 decoding (covered by tests/catalog-dbf.test.ts).
 */
function dbf(fields, rows) {
  const recordSize = 1 + fields.reduce((sum, f) => sum + f.length, 0);
  const headerSize = 32 + fields.length * 32 + 1;
  const buffer = Buffer.alloc(headerSize + rows.length * recordSize, 0);
  buffer[0] = 0x03;
  buffer.writeUInt32LE(rows.length, 4);
  buffer.writeUInt16LE(headerSize, 8);
  buffer.writeUInt16LE(recordSize, 10);
  buffer[29] = 0xc9;
  let offset = 1;
  fields.forEach((field, i) => {
    const base = 32 + i * 32;
    buffer.write(field.name, base, 'ascii');
    buffer[base + 11] = field.type.charCodeAt(0);
    buffer[base + 16] = field.length;
    field.offset = offset;
    offset += field.length;
  });
  buffer[32 + fields.length * 32] = 0x0d;
  rows.forEach((row, r) => {
    const start = headerSize + r * recordSize;
    buffer[start] = 0x20;
    fields.forEach(field => buffer.write(String(row[field.name] ?? '').padEnd(field.length, ' ').slice(0, field.length), start + field.offset, 'ascii'));
  });
  return buffer;
}

const goodsFields = [{ name: 'ARTICUL', type: 'C', length: 10 }, { name: 'IDSET', type: 'C', length: 4 }, { name: 'NAME', type: 'C', length: 40 }];
const barcodeFields = [{ name: 'ARTICUL', type: 'C', length: 10 }, { name: 'IDSET', type: 'C', length: 4 }, { name: 'BARCODE', type: 'C', length: 14 }];

/** A synthetic pair with `count` products, each with one barcode. */
function pair(count, prefix = 'Item') {
  const goods = [], barcodes = [];
  for (let i = 0; i < count; i++) {
    const articul = String(i + 1).padStart(6, '0');
    goods.push({ ARTICUL: articul, IDSET: '1', NAME: `${prefix} ${i + 1}` });
    barcodes.push({ ARTICUL: articul, IDSET: '1', BARCODE: String(4600000000000 + i) });
  }
  return { goods: dbf(goodsFields, goods), barcodes: dbf(barcodeFields, barcodes) };
}

/** Framed body exactly as CatalogImport.tsx sends it. */
function frame(goods, barcodes) {
  const header = Buffer.alloc(format.CATALOG_UPLOAD_HEADER_BYTES);
  header.write(format.CATALOG_UPLOAD_MAGIC, 0, 'ascii');
  header.writeBigUInt64LE(BigInt(goods.length), 8);
  header.writeBigUInt64LE(BigInt(barcodes.length), 16);
  return Buffer.concat([header, goods, barcodes]);
}

const streamOf = (buffer, method = 'POST') => Object.assign(Readable.from([buffer]), { method });
const tempFiles = () => fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('catalog-upload-'));

test('client framing matches the server header layout', async () => {
  const goods = Buffer.from('abc'), barcodes = Buffer.from('defgh');
  const body = format.buildCatalogUploadBody(new Blob([goods]), new Blob([barcodes]));
  const bytes = Buffer.from(await body.arrayBuffer());
  assert.equal(bytes.length, format.CATALOG_UPLOAD_HEADER_BYTES + 8);
  assert.equal(bytes.subarray(0, 8).toString('ascii'), 'ECATDBF1');
  assert.equal(bytes.readBigUInt64LE(8), 3n);
  assert.equal(bytes.readBigUInt64LE(16), 5n);
  assert.deepEqual(bytes.subarray(24), Buffer.concat([goods, barcodes]));
  assert.equal(format.MAX_DBF_BYTES, 256 * 1024 * 1024);
});

test('AC3/AC5/AC7: a valid pair is stored in one statement per batch, repeat-safe, inventory untouched', async () => {
  const { prisma } = disposableDatabase();
  try {
    const before = { shared: await prisma.sharedCatalogEntry.count(), products: await prisma.product.count() };
    const { goods, barcodes } = pair(3);
    const first = await importCatalogUpload(streamOf(frame(goods, barcodes)), prisma);
    assert.equal(first.imported, 3);
    assert.equal(first.goodsRows, 3);
    assert.equal(first.barcodeRows, 3);
    assert.equal(first.duplicateBarcodes, 0);
    assert.equal(await prisma.sharedCatalogEntry.count(), before.shared + 3);
    const stored = await prisma.sharedCatalogEntry.findUnique({ where: { barcode: '4600000000000' } });
    assert.equal(stored.name, 'Item 1');
    assert.ok(stored.updatedAt instanceof Date && !Number.isNaN(stored.updatedAt.getTime()), 'raw insert stores a readable DateTime');

    // Repeat with renamed product 1: renamed in place, no duplicates.
    const renamed = pair(3, 'Renamed');
    const second = await importCatalogUpload(streamOf(frame(renamed.goods, renamed.barcodes)), prisma);
    assert.equal(second.imported, 3);
    assert.equal(await prisma.sharedCatalogEntry.count(), before.shared + 3);
    assert.equal((await prisma.sharedCatalogEntry.findUnique({ where: { barcode: '4600000000000' } })).name, 'Renamed 1');
    assert.equal(await prisma.product.count(), before.products, 'inventory untouched');
  } finally { await prisma.$disconnect(); }
});

test('AC2: a wrong magic, mismatched lengths or an empty file are refused before any write', async () => {
  const { prisma } = disposableDatabase();
  try {
    const { goods, barcodes } = pair(2);
    const badMagic = frame(goods, barcodes);
    badMagic.write('NOTCATAL', 0, 'ascii');
    await assert.rejects(importCatalogUpload(streamOf(badMagic), prisma), /неизвестный формат/);

    const truncated = frame(goods, barcodes).subarray(0, format.CATALOG_UPLOAD_HEADER_BYTES + 10);
    await assert.rejects(importCatalogUpload(streamOf(truncated), prisma), /не совпадает с заголовком/);

    const empty = frame(Buffer.alloc(0), barcodes);
    await assert.rejects(importCatalogUpload(streamOf(empty), prisma), /непустыми/);

    assert.equal(await prisma.sharedCatalogEntry.count(), 0);
  } finally { await prisma.$disconnect(); }
});

test('AC2: an oversize upload is refused with 413 and writes nothing', async () => {
  const { prisma } = disposableDatabase();
  try {
    const { goods, barcodes } = pair(2);
    const body = frame(goods, barcodes);
    await assert.rejects(importCatalogUpload(streamOf(body), prisma, { maxBytes: body.length - 1 }), error => error.status === 413);
    assert.equal(await prisma.sharedCatalogEntry.count(), 0);
  } finally { await prisma.$disconnect(); }
});

test('parse error (barcode without its product) is a 400 and changes nothing', async () => {
  const { prisma } = disposableDatabase();
  try {
    const goods = dbf(goodsFields, [{ ARTICUL: '000001', IDSET: '1', NAME: 'Only item' }]);
    const barcodes = dbf(barcodeFields, [{ ARTICUL: '999999', IDSET: '1', BARCODE: '4600000000009' }]);
    await assert.rejects(importCatalogUpload(streamOf(frame(goods, barcodes)), prisma), error => error.status === 400 && /отсутствует в goods.dbf/.test(error.message));
    assert.equal(await prisma.sharedCatalogEntry.count(), 0);
  } finally { await prisma.$disconnect(); }
});

test('AC5: a failed batch reports the rows already confirmed; repeating the pair converges without duplicates', async () => {
  const { prisma } = disposableDatabase();
  try {
    const { goods, barcodes } = pair(CATALOG_BATCH_SIZE * 2 + 10);
    let calls = 0;
    const flaky = { $executeRaw: query => { calls++; if (calls === 2) return Promise.reject(new Error('disk I/O')); return prisma.$executeRaw(query); } };
    await assert.rejects(importCatalogUpload(streamOf(frame(goods, barcodes)), flaky), error => error.status === 500 && error.confirmed === CATALOG_BATCH_SIZE);
    assert.equal(await prisma.sharedCatalogEntry.count(), CATALOG_BATCH_SIZE);

    const retry = await importCatalogUpload(streamOf(frame(goods, barcodes)), prisma);
    assert.equal(retry.imported, CATALOG_BATCH_SIZE * 2 + 10);
    assert.equal(await prisma.sharedCatalogEntry.count(), CATALOG_BATCH_SIZE * 2 + 10);
  } finally { await prisma.$disconnect(); }
});

test('AC6: temporary files are removed after success and after failure', async () => {
  const { prisma } = disposableDatabase();
  try {
    const before = tempFiles().length;
    const { goods, barcodes } = pair(2);
    await importCatalogUpload(streamOf(frame(goods, barcodes)), prisma);
    await assert.rejects(importCatalogUpload(streamOf(Buffer.from('nope')), prisma));
    assert.equal(tempFiles().length, before);
  } finally { await prisma.$disconnect(); }
});

test('AC6: the route answers 405, 401 and 403 without writing, and 200 for an administrator', async () => {
  const { prisma } = disposableDatabase();
  let session = null;
  const route = load('src/pages/api/admin/catalog-upload.ts', {
    'next-auth/next': { getServerSession: async () => session },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/server/catalog-upload': require('../src/lib/server/catalog-upload.ts'),
  }).default;
  try {
    const { goods, barcodes } = pair(4);
    const body = frame(goods, barcodes);

    let res = response();
    await route(streamOf(body, 'GET'), res);
    assert.equal(res.code, 405);

    res = response();
    await route(streamOf(body), res);
    assert.equal(res.code, 401);
    assert.equal(await prisma.sharedCatalogEntry.count(), 0);

    session = { user: { id: 'employee', role: 'USER' } };
    res = response();
    await route(streamOf(body), res);
    assert.equal(res.code, 403);
    assert.equal(await prisma.sharedCatalogEntry.count(), 0);

    session = { user: { id: 'admin', role: 'ADMIN' } };
    res = response();
    await route(streamOf(body), res);
    assert.equal(res.code, 200);
    assert.equal(res.data.imported, 4);
    assert.equal(await prisma.sharedCatalogEntry.count(), 4);
  } finally { await prisma.$disconnect(); }
});

test('the route config disables Next body parsing so the stream is read here', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/api/admin/catalog-upload.ts'), 'utf8');
  assert.match(source, /bodyParser:\s*false/);
  assert.match(source, /getServerSession\([\s\S]*?\);\s*\n[\s\S]*?importCatalogUpload/, 'session is checked before the body is read');
});
