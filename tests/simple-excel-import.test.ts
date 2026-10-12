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
