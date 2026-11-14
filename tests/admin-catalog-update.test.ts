import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(path, "utf8");
const screen = read("src/components/CatalogImport.tsx");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("the Catalog tab takes only the goods.dbf + barcode.dbf pair", () => {
  assert.equal((screen.match(/type="file"/g) ?? []).length, 2, "exactly two file inputs");
  assert.equal((screen.match(/accept="\.dbf"/g) ?? []).length, 2, "both accept DBF only");
  assert.ok(!/\.csv|\.xlsx?|parseCatalogCsv|parseExcelFile/i.test(screen), "no CSV or Excel path");
  assert.ok(screen.includes("catalog-dbf.worker"), "parsing runs in the worker");
  assert.ok(screen.includes("Проверить файлы базы") && screen.includes("Сохранить каталог"));
});

test("only the DBF flow reaches the shared catalog endpoint, in batches", () => {
  const callers = sources("src").filter(path => /["'`]\/api\/admin\/catalog["'`]/.test(read(path)));
  assert.deepEqual(callers, [join("src", "components", "CatalogImport.tsx")]);
  assert.ok(screen.includes("importCatalogBatches"), "saving goes through the 500-entry batches");
  assert.ok(!screen.includes('"/api/catalog"'), "the personal catalog endpoint is not used");
});

test("the screen tells how many records are confirmed when saving fails", () => {
  assert.ok(screen.includes("Подтверждено записей"), "confirmed count is shown");
  assert.ok(screen.includes("дубликаты не появятся"), "retry safety is stated");
});
