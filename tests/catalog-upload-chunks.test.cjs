// Chunked DBF pair upload: plan, header checks, resumable parts, finalize, auth on every route.
// Runs under tsx (see package.json test:app) against a disposable SQLite with every migration applied.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const ts = require('typescript');
const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const format = require('../src/lib/catalog-upload-format.ts');
const upload = require('../src/lib/server/catalog-upload.ts');
const chunks = require('../src/lib/server/catalog-upload-chunks.ts');

const UPLOAD_DIR = path.join(os.tmpdir(), 'expiry-catalog-uploads');
const PART = 1000;

/** Loads a route file with its `@/` imports replaced by test doubles. */
function load(file, modules) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Buffer, require(name) {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return exports;
}

function response() {
  return { code: 200, data: undefined, headers: {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader(k, v) { this.headers[k] = v; } };
}

function disposableDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-chunks-'));
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

/** Builds a dBase III file with ASCII fields, as in tests/catalog-upload.test.cjs. */
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

function pair(count, prefix = 'Item') {
  const goods = [], barcodes = [];
  for (let i = 0; i < count; i++) {
    const articul = String(i + 1).padStart(6, '0');
    goods.push({ ARTICUL: articul, IDSET: '1', NAME: `${prefix} ${i + 1}` });
    barcodes.push({ ARTICUL: articul, IDSET: '1', BARCODE: String(4600000000000 + i) });
  }
  return { goods: dbf(goodsFields, goods), barcodes: dbf(barcodeFields, barcodes) };
}

/** Framed body exactly as the browser builds it. */
function frame(goods, barcodes) {
  const header = Buffer.alloc(format.CATALOG_UPLOAD_HEADER_BYTES);
  header.write(format.CATALOG_UPLOAD_MAGIC, 0, 'ascii');
  header.writeBigUInt64LE(BigInt(goods.length), 8);
  header.writeBigUInt64LE(BigInt(barcodes.length), 16);
  return Buffer.concat([header, goods, barcodes]);
}

const streamOf = (buffer, extra = {}) => Object.assign(Readable.from([buffer]), extra);
const admin = () => randomUUID();
const stored = id => fs.existsSync(path.join(UPLOAD_DIR, `${id}.json`)) || fs.existsSync(path.join(UPLOAD_DIR, `${id}.bin`));

/** Starts an upload for `body` the same way the browser does (total size + 24-byte header). */
async function start(adminId, body) {
  return chunks.initUpload(adminId, body.length, new Uint8Array(body.subarray(0, format.CATALOG_UPLOAD_HEADER_BYTES)));
}

/** Sends the parts of `body` (cut at `partBytes`) in order, optionally skipping some. */
async function sendParts(uploadId, adminId, body, partBytes = PART, skip = () => false) {
  for (const { offset, length } of format.planChunks(body.length, partBytes)) {
    if (skip(offset)) continue;
    await chunks.writeChunk(uploadId, adminId, offset, length, streamOf(body.subarray(offset, offset + length)));
  }
}

test('AC1: the body is split into consecutive parts of at most CHUNK_BYTES, and a part fits Cloudflare Free/Pro', () => {
  assert.equal(format.CHUNK_BYTES, 90 * 1024 * 1024);
  assert.ok(format.CHUNK_BYTES < 100 * 1000 * 1000, 'below the 100 MB Free/Pro request limit');
  assert.deepEqual(format.planChunks(10, 4), [{ offset: 0, length: 4 }, { offset: 4, length: 4 }, { offset: 8, length: 2 }]);
  const big = format.planChunks(format.CHUNK_BYTES * 2 + 5);
  assert.equal(big.length, 3);
  assert.equal(big[2].length, 5);
  assert.throws(() => format.planChunks(0), /положительным/);
});

test('ranges: received parts merge and the gaps are reported', () => {
  let ranges = chunks.mergeRange([], 0, 4);
  ranges = chunks.mergeRange(ranges, 6, 8);
  ranges = chunks.mergeRange(ranges, 4, 6);
  assert.deepEqual(ranges, [{ start: 0, end: 8 }]);
  assert.deepEqual(chunks.missingRanges(12, [{ start: 0, end: 4 }, { start: 6, end: 8 }]), [{ start: 4, end: 6 }, { start: 8, end: 12 }]);
  assert.deepEqual(chunks.missingRanges(8, [{ start: 0, end: 8 }]), []);
});

test('AC2: init refuses a wrong header, a length mismatch and an oversize total before any file is created', async () => {
  const { goods, barcodes } = pair(2);
  const body = frame(goods, barcodes);
  const id = admin();
  await assert.rejects(chunks.initUpload(id, body.length, Buffer.from('NOTMAGIC' + '0'.repeat(16), 'latin1')), error => error instanceof upload.CatalogUploadError && error.status === 400 && /неизвестный формат/.test(error.message));
  await assert.rejects(chunks.initUpload(id, body.length - 1, body.subarray(0, 24)), error => error.status === 400 && /не совпадает/.test(error.message));
  await assert.rejects(chunks.initUpload(id, format.MAX_UPLOAD_BYTES + 1, body.subarray(0, 24)), error => error.status === 413);
});

test('AC3/AC4: a part outside the body is refused; the same part sent twice does not corrupt the file; status lists the ranges', async () => {
  const { goods, barcodes } = pair(20);
  const body = frame(goods, barcodes);
  const id = admin();
  const { uploadId } = await start(id, body);
  await assert.rejects(chunks.writeChunk(uploadId, id, body.length, 10, streamOf(Buffer.alloc(10))), error => error.status === 400);
  await assert.rejects(chunks.writeChunk(uploadId, id, 0, 10, streamOf(Buffer.alloc(3))), error => error.status === 400 && /оборвана/.test(error.message));

  await chunks.writeChunk(uploadId, id, 0, PART, streamOf(body.subarray(0, PART)));
  await chunks.writeChunk(uploadId, id, 0, PART, streamOf(body.subarray(0, PART)));
  const status = await chunks.getUploadStatus(uploadId, id);
  assert.deepEqual(status.ranges, [{ start: 0, end: PART }]);
  assert.equal(status.totalBytes, body.length);
  await sendParts(uploadId, id, body, PART, offset => offset === 0);
  const result = await chunks.finalizeUpload(uploadId, id, { $executeRaw: () => Promise.resolve(0) });
  assert.equal(result.imported, 20);
});

test('AC5: finalize before every byte arrived answers 409 with the missing ranges and writes nothing', async () => {
  const { goods, barcodes } = pair(20);
  const body = frame(goods, barcodes);
  const id = admin();
  const { uploadId } = await start(id, body);
  await sendParts(uploadId, id, body, PART, offset => offset === 0 || offset > 3000);
  let writes = 0;
  await assert.rejects(chunks.finalizeUpload(uploadId, id, { $executeRaw: () => { writes++; return Promise.resolve(0); } }), error => {
    assert.ok(error instanceof chunks.CatalogIncompleteError);
    assert.equal(error.status, 409);
    assert.deepEqual(error.missing[0], { start: 0, end: PART });
    return true;
  });
  assert.equal(writes, 0);
});

test('AC6/AC9/AC10: a complete pair is imported batch by batch; temporary files are removed; Product rows untouched', async () => {
  const { prisma, dir } = disposableDatabase();
  try {
    const { goods, barcodes } = pair(1010);
    const body = frame(goods, barcodes);
    const id = admin();
    const { uploadId } = await start(id, body);
    await sendParts(uploadId, id, body, 64 * 1024);
    const result = await chunks.finalizeUpload(uploadId, id, prisma);
    assert.equal(result.imported, 1010);
    assert.equal(result.goodsRows, 1010);
    assert.equal(await prisma.sharedCatalogEntry.count(), 1010);
    assert.equal(await prisma.product.count(), 0);
    assert.equal(stored(uploadId), false, 'temporary files are removed after success');
    await assert.rejects(chunks.getUploadStatus(uploadId, id), error => error.status === 404);
  } finally { await prisma.$disconnect(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC7: a failed batch reports the rows already confirmed; finalizing again converges without duplicates', async () => {
  const { prisma, dir } = disposableDatabase();
  try {
    const count = upload.CATALOG_BATCH_SIZE * 2 + 10;
    const { goods, barcodes } = pair(count);
    const body = frame(goods, barcodes);
    const id = admin();
    const { uploadId } = await start(id, body);
    await sendParts(uploadId, id, body, 64 * 1024);

    let calls = 0;
    const flaky = { $executeRaw: query => { calls++; if (calls === 2) return Promise.reject(new Error('disk I/O')); return prisma.$executeRaw(query); } };
    await assert.rejects(chunks.finalizeUpload(uploadId, id, flaky), error => error.status === 500 && error.confirmed === upload.CATALOG_BATCH_SIZE);
    assert.equal(stored(uploadId), true, 'the assembled file stays for a retry');

    const retry = await chunks.finalizeUpload(uploadId, id, prisma);
    assert.equal(retry.imported, count);
    assert.equal(await prisma.sharedCatalogEntry.count(), count);
  } finally { await prisma.$disconnect(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('D6: a new init by the same administrator replaces the previous upload; another administrator cannot read it', async () => {
  const { goods, barcodes } = pair(3);
  const body = frame(goods, barcodes);
  const id = admin();
  const first = await start(id, body);
  const second = await start(id, body);
  await assert.rejects(chunks.getUploadStatus(first.uploadId, id), error => error.status === 404);
  await assert.rejects(chunks.getUploadStatus(second.uploadId, admin()), error => error.status === 404);
  await assert.rejects(chunks.getUploadStatus('../../etc/passwd', id), error => error.status === 400);
});

test('AC8: every chunk route answers 405, 401 and 403 without reading the body; an administrator gets the full cycle', async () => {
  const { prisma, dir } = disposableDatabase();
  let session = null;
  const modules = {
    'next-auth/next': { getServerSession: async () => session },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/server/catalog-upload': upload,
    '@/lib/server/catalog-upload-chunks': chunks,
  };
  const init = load('src/pages/api/admin/catalog-upload/init.ts', modules).default;
  const part = load('src/pages/api/admin/catalog-upload/chunk.ts', modules).default;
  const status = load('src/pages/api/admin/catalog-upload/status.ts', modules).default;
  const finish = load('src/pages/api/admin/catalog-upload/finalize.ts', modules).default;
  try {
    const { goods, barcodes } = pair(4);
    const body = frame(goods, barcodes);
    const headerHex = body.subarray(0, 24).toString('hex');

    const unread = () => streamOf(body, { method: 'PUT', headers: { 'content-length': String(body.length) }, query: {} });

    let res = response();
    let req = streamOf(body, { method: 'GET', headers: {}, query: {} });
    await part(req, res);
    assert.equal(res.code, 405);
    assert.equal(req.readableDidRead, false);

    res = response();
    req = unread();
    await part(req, res);
    assert.equal(res.code, 401);
    assert.equal(req.readableDidRead, false, 'session is checked before the body is read');

    session = { user: { id: 'employee', role: 'USER' } };
    res = response();
    req = unread();
    await part(req, res);
    assert.equal(res.code, 403);
    assert.equal(req.readableDidRead, false);

    session = { user: { id: 'admin', role: 'ADMIN' } };
    res = response();
    await init({ method: 'POST', body: { totalBytes: body.length, header: headerHex } }, res);
    assert.equal(res.code, 200);
    const { uploadId } = res.data;

    res = response();
    await init({ method: 'POST', body: { totalBytes: body.length, header: 'zz' } }, res);
    assert.equal(res.code, 400);

    res = response();
    await status({ method: 'GET', query: { uploadId } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.data.missing.length, 1);

    for (const { offset, length } of format.planChunks(body.length, 500)) {
      res = response();
      await part(streamOf(body.subarray(offset, offset + length), { method: 'PUT', headers: { 'content-length': String(length) }, query: { uploadId, offset: String(offset) } }), res);
      assert.equal(res.code, 200, `part at ${offset}`);
    }

    res = response();
    await finish({ method: 'POST', query: { uploadId } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.data.imported, 4);
    assert.equal(await prisma.sharedCatalogEntry.count(), 4);

    assert.match(fs.readFileSync(path.join(__dirname, '../src/pages/api/admin/catalog-upload/chunk.ts'), 'utf8'), /bodyParser:\s*false/);
  } finally { await prisma.$disconnect(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('D8: uploads with no activity for 24 hours are removed; the cleanup is idempotent', async () => {
  const { goods, barcodes } = pair(2);
  const body = frame(goods, barcodes);
  const id = admin();
  const { uploadId } = await start(id, body);
  const removed = await chunks.cleanupStaleUploads(Date.now() + chunks.STALE_UPLOAD_MS + 1);
  assert.ok(removed >= 1);
  assert.equal(stored(uploadId), false);
  assert.equal(await chunks.cleanupStaleUploads(Date.now() + chunks.STALE_UPLOAD_MS + 1), 0);
});
