import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseExcelFile } from "../src/lib/excel-parser";
import { validateCatalogEntries } from "../src/lib/catalog-parser";

function parse(rows: unknown[][], bookType: "xlsx" | "biff8" = "xlsx") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Products");
  const buffer = XLSX.write(workbook, { type: "array", bookType });
  const result = parseExcelFile(buffer);
  assert.deepEqual(result.errors, []);
  return { ...result, entries: validateCatalogEntries(result.products) };
}

test("catalog Excel imports preserve text barcodes and ignore quantities in both extensions", () => {
  for (const type of ["xlsx", "biff8"] as const) {
    const result = parse([["Штрих-код основной", "Наименование товара", "Доступно"], ["0123456789012", "Товар", 12]], type);
    assert.equal(result.fileType, "catalog");
    assert.deepEqual(result.entries, [{ barcode: "0123456789012", name: "Товар" }]);
  }
});

test("inventory Excel imports skip totals and collapse identical catalog entries", () => {
  const rows: unknown[][] = [["Инвентаризационная опись"]];
  while (rows.length < 17) rows.push([]);
  rows.push(["№", "Артикул", "Наименование", "Количество"], [1, "0123456789012", "Товар", 4], [2, "0123456789012", "Товар", 8], [3, "99999999", "Всего", 12]);
  const result = parse(rows);
  assert.equal(result.fileType, "inventory");
  assert.deepEqual(result.entries, [{ barcode: "0123456789012", name: "Товар" }]);
});

test("unsupported workbooks and invalid catalog barcodes cannot be imported", () => {
  assert.throws(() => parse([["Unknown"], ["value"]]));
  assert.throws(() => parse([["Штрих-код", "Наименование товара"], ["123", "Товар"]]), /штрих-код/);
});
