import test from "node:test";
import assert from "node:assert/strict";
import { importCatalogBatches } from "../src/lib/catalog-import";
import { parseCatalogCsv } from "../src/lib/catalog-parser";

const entries = Array.from({ length: 1001 }, (_, i) => ({ barcode: String(10000000 + i), name: `Product ${i}` }));

test("large CSV validation remains opt-in and catches conflicts across batch boundaries", () => {
  const rows = Array.from({ length: 10001 }, (_, i) => `${10000000 + i};Product ${i}`);
  const csv = `Штрих-код;Наименование товара\n${rows.join("\n")}`;
  assert.throws(() => parseCatalogCsv(csv), /10000/);
  assert.equal(parseCatalogCsv(csv, 500000).length, 10001);
  assert.throws(() => parseCatalogCsv(`${csv}\n10000000;Conflict`, 500000), /разные названия/);
});

test("bounded requests acknowledge every entry once in source order", async () => {
  const saved: typeof entries = [], sizes: number[] = [], progress: number[] = [];
  const result = await importCatalogBatches(entries, async batch => {
    sizes.push(batch.length); saved.push(...batch); return batch.length;
  }, count => progress.push(count));
  assert.equal(result, 1001);
  assert.deepEqual(saved, entries);
  assert.deepEqual(sizes, [500, 500, 1]);
  assert.deepEqual(progress, [500, 1000, 1001]);
});

test("partial failure stops subsequent writes and retry converges without duplicates", async () => {
  const stored = new Map<string, string>();
  stored.set(entries[0].barcode, "Old name");
  stored.set("99999999", "Existing unrelated entry");
  let calls = 0;
  const save = async (batch: typeof entries) => {
    for (const entry of batch) stored.set(entry.barcode, entry.name);
    return batch.length;
  };
  const progress: number[] = [];
  await assert.rejects(importCatalogBatches(entries, async batch => {
    calls++;
    if (calls === 2) throw new Error("Disconnected");
    return save(batch);
  }, count => progress.push(count)), /Disconnected/);
  assert.equal(calls, 2);
  assert.deepEqual(progress, [500]);
  await importCatalogBatches(entries, save, () => {});
  assert.equal(stored.size, 1002);
  assert.equal(stored.get(entries[0].barcode), entries[0].name);
  assert.equal(stored.get("99999999"), "Existing unrelated entry");
});

test("incomplete server acknowledgement stops the import", async () => {
  let calls = 0;
  await assert.rejects(importCatalogBatches(entries, async () => { calls++; return 499; }, () => {}), /не все записи/);
  assert.equal(calls, 1);
});
