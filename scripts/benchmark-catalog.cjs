/** Full-size offline benchmark: never opens configured application storage. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');
const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = percentile => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))];
  return { samples: sorted.length, medianMs: at(.5), p95Ms: at(.95), p99Ms: at(.99), maxMs: sorted.at(-1) };
}

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: node scripts/benchmark-catalog.cjs <catalog.csv>');
  const parser = { exports: {}, Map, Error };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/catalog-parser.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, parser);
  const parsedAt = performance.now();
  const entries = parser.exports.parseCatalogCsv(fs.readFileSync(source, 'utf8'), 500000);
  const parseMs = performance.now() - parsedAt;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-catalog-bench-'));
  const url = path.join(dir, 'benchmark.db');
  let db, prisma;
  try {
    db = new Database(url);
    db.exec(fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261003000000_add_shared_catalog/migration.sql'), 'utf8'));
    const insert = db.prepare('INSERT INTO SharedCatalogEntry(id,barcode,name,updatedAt) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(barcode) DO UPDATE SET name=excluded.name,updatedAt=CURRENT_TIMESTAMP');
    const writeBatch = db.transaction(batch => batch.forEach(entry => insert.run(entry.barcode, entry.barcode, entry.name)));
    const loadAt = performance.now();
    for (let i = 0; i < entries.length; i += 500) writeBatch(entries.slice(i, i + 500));
    const loadMs = performance.now() - loadAt;
    const count = db.prepare('SELECT COUNT(*) AS total,COUNT(DISTINCT barcode) AS uniqueCodes FROM SharedCatalogEntry').get();
    if (count.total !== entries.length || count.uniqueCodes !== entries.length) throw new Error('Import reconciliation failed');
    const sql = 'SELECT barcode,name FROM SharedCatalogEntry WHERE barcode=?';
    const queryPlan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(entries[0].barcode);
    const query = db.prepare(sql);
    const codes = Array.from({ length: 2000 }, (_, i) => i % 5 === 0 ? '00000000000000' : entries[(i * 7919) % entries.length].barcode);
    const rawTimes = [];
    for (const code of codes) {
      const start = performance.now(); query.get(code); rawTimes.push(performance.now() - start);
    }
    db.close(); db = undefined;
    prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
    const firstAt = performance.now();
    await prisma.sharedCatalogEntry.findUnique({ where: { barcode: codes[1] }, select: { barcode: true, name: true } });
    const firstPrismaMs = performance.now() - firstAt;
    const prismaTimes = [];
    for (const code of codes) {
      const start = performance.now();
      await prisma.sharedCatalogEntry.findUnique({ where: { barcode: code }, select: { barcode: true, name: true } });
      prismaTimes.push(performance.now() - start);
    }
    const batchAt = performance.now();
    await prisma.$transaction(entries.slice(0, 500).map(({ barcode, name }) => prisma.sharedCatalogEntry.upsert({ where: { barcode }, create: { barcode, name }, update: { name } })));
    const prismaBatch500Ms = performance.now() - batchAt;
    const report = { rows: entries.length, uniqueCodes: count.uniqueCodes, parseMs, loadMs, databaseBytes: fs.statSync(url).size, queryPlan, sql: summary(rawTimes), prisma: summary(prismaTimes), firstPrismaMs, prismaBatch500Ms, environment: { platform: process.platform, node: process.version }, limitations: 'Local disposable SQLite; no HTTP, authentication, network, camera, production load or cold OS cache measurement.' };
    fs.mkdirSync(path.join(__dirname, '../.verification'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../.verification/catalog-benchmark.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (prisma) await prisma.$disconnect();
    if (db) db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
