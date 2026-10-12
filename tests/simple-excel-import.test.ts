import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseExcelFile } from "../src/lib/excel-parser";
import { validateInventoryProducts } from "../src/lib/inventory-import";

function parse(rows: unknown[][], date1904 = false) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Products");
  workbook.Workbook = { WBProps: { date1904 } };
  return parseExcelFile(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

test("mixed expiry/manufacture rows preserve order, duplicates and leading zeros", () => {
  const result = parse([
    ["Code", "Name", "Date", "Months"],
    ["0012345678901", "Final", "07.09.2026"],
    [],
    ["0012345678901", "Made", "31.01.2024", 1],
    [12345678, "ISO", "2024-02-29", 12],
  ]);
  assert.equal(result.fileType, "simple");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(validateInventoryProducts(result.products), [
    { barcode: "0012345678901", name: "Final", quantity: null, expiryDate: "2026-09-07" },
    { barcode: "0012345678901", name: "Made", quantity: null, expiryDate: "2024-02-29" },
    { barcode: "12345678", name: "ISO", quantity: null, expiryDate: "2025-02-28" },
  ]);
});

test("Excel serial dates respect both date systems without timezone shifts", () => {
  for (const [serial, date1904] of [[45292, false], [43830, true]] as const) {
    const result = parse([["Code", "Name", "Date"], ["123", "Item", serial]], date1904);
    assert.deepEqual(result.errors, []);
    assert.equal(result.products[0].expiryDate, "2024-01-01");
  }
});

test("invalid dates and months report actual Excel row numbers", () => {
  for (const [date, months] of [["31.02.2025", ""], ["29.02.2025", 1], ["01.01.2025", 0], ["01.01.2025", -1], ["01.01.2025", 1.5], ["01.01.2025", 1201], ["", 12], [60, ""]]) {
    const result = parse([["Code", "Name", "Date", "Months"], ["123", "Item", date, months]]);
    assert.equal(result.products.length, 0);
    assert.match(result.errors[0], /^Строка 2:/);
  }
});

test("legacy catalog and inventory still preserve quantities and unknown expiry", () => {
  const catalog = parse([["Штрих-код", "", "", "", "", "Наименование товара", "", "", "Доступно"], ["123", "", "", "", "", "Item", "", "", 5]]);
  assert.equal(catalog.fileType, "catalog");
  assert.equal(catalog.products[0].quantity, 5);
  const rows: unknown[][] = [["Инвентаризационная опись"]];
  rows[17] = ["", "Артикул", "Наименование", "Количество"];
  rows[18] = ["", "123", "Item", 2];
  const inventory = parse(rows);
  assert.equal(inventory.fileType, "inventory");
  assert.equal(inventory.products[0].quantity, 2);
  assert.equal(validateInventoryProducts(inventory.products)[0].expiryDate, null);
});
