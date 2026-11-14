const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Database = require('better-sqlite3');

const migrations = path.join(__dirname, '../prisma/migrations');
const LAST = '20261114000000_drop_personal_catalog';
const apply = (db, name) => db.exec(fs.readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8'));
const tables = db => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name").all().map(row => row.name);

test('dropping the personal catalog copies absent barcodes, keeps shared names and touches nothing else', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-drop-catalog-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const db = new Database(path.join(dir, 'test.db'));
  const names = fs.readdirSync(migrations).filter(name => fs.existsSync(path.join(migrations, name, 'migration.sql'))).sort();
  assert.equal(names.at(-1), LAST, 'the drop migration sorts last');
  for (const name of names.slice(0, -1)) apply(db, name);

  db.exec(`
    INSERT INTO User (id,email) VALUES ('u1','a@example.invalid'),('u2','b@example.invalid');
    INSERT INTO Store (id,name) VALUES ('s1','Dept');
    INSERT INTO StoreMembership (id,userId,storeId,role) VALUES ('m1','u1','s1','MANAGER');
    INSERT INTO Product (id,name,barcode,userId,storeId,updatedAt) VALUES ('p1','Milk','4600000000001','u1','s1',CURRENT_TIMESTAMP);
    INSERT INTO SharedCatalogEntry (id,barcode,name,createdAt,updatedAt) VALUES
      ('sh1','4600000000001','Shared milk',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
      ('sh2','4600000000002','Shared bread',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    INSERT INTO CatalogEntry (id,barcode,name,createdAt,updatedAt,userId) VALUES
      ('pe1','4600000000001','Personal milk','2026-01-01 00:00:00','2026-01-01 00:00:00','u1'),
      ('pe2','4600000000003','Cheese old','2026-01-01 00:00:00','2026-01-01 00:00:00','u1'),
      ('pe3','4600000000003','Cheese new','2026-01-01 00:00:00','2026-02-01 00:00:00','u2'),
      ('pe4','4600000000004','Only personal','2026-01-01 00:00:00','2026-01-01 00:00:00','u2');`);
  const count = table => db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;
  const others = tables(db).filter(name => !['CatalogEntry', 'SharedCatalogEntry'].includes(name));
  const before = Object.fromEntries(others.map(name => [name, count(name)]));
  const shared = db.prepare('SELECT id,barcode,name FROM SharedCatalogEntry ORDER BY barcode').all();

  apply(db, LAST);

  assert.equal(tables(db).includes('CatalogEntry'), false);
  assert.deepEqual(Object.fromEntries(others.map(name => [name, count(name)])), before);
  const after = db.prepare('SELECT barcode,name FROM SharedCatalogEntry ORDER BY barcode').all();
  assert.deepEqual(after, [
    { barcode: '4600000000001', name: 'Shared milk' },
    { barcode: '4600000000002', name: 'Shared bread' },
    { barcode: '4600000000003', name: 'Cheese new' },
    { barcode: '4600000000004', name: 'Only personal' },
  ]);
  for (const row of shared) assert.deepEqual(db.prepare('SELECT id,barcode,name FROM SharedCatalogEntry WHERE id=?').get(row.id), row);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  db.close();
});

test('the drop migration also applies to a database with an empty personal catalog', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expiry-drop-empty-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const db = new Database(path.join(dir, 'test.db'));
  for (const name of fs.readdirSync(migrations).filter(n => fs.existsSync(path.join(migrations, n, 'migration.sql'))).sort()) apply(db, name);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM SharedCatalogEntry').get().n, 0);
  db.close();
});
