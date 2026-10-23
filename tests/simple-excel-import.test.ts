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

test("simple table keeps the final expiry date when months are empty", () => {
  const result = parse([
    ["Code", "Name", "Date", "Months"],
    ["0012345678901", "Expires on", "07.09.2026", ""],
    ["0012345678902", "Made", "31.01.2024", 1],
    ["0012345678903", "ISO expiry", "2024-02-29", ""],
    ["0012345678904", "ISO made", "2024-02-29", 12],
  ]);
  assert.equal(result.fileType, "simple");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(validateInventoryProducts(result.products), [
    { barcode: "0012345678901", name: "Expires on", quantity: null, expiryDate: "2026-09-07" },
    { barcode: "0012345678902", name: "Made", quantity: null, expiryDate: "2024-02-29" },
    { barcode: "0012345678903", name: "ISO expiry", quantity: null, expiryDate: "2024-02-29" },
    { barcode: "0012345678904", name: "ISO made", quantity: null, expiryDate: "2025-02-28" },
  ]);
});

test("simple table still rejects impossible dates without months", () => {
  for (const date of ["31.02.2025", "29.02.2025", "01/03/2025", "01.03.2025 00:00:00"]) {
    const result = parse([["Code", "Name", "Date", "Months"], ["123", "Item", date, ""]]);
    assert.equal(result.products.length, 0);
    assert.match(result.errors[0], /^Строка 2:/);
  }
});

test("a fifth column does not hide the simple table", () => {
  const rows: unknown[][] = [
    ["Code", "Name", "Date", "Months"],
    ["0012345678901", "Expires on", "07.09.2026", ""],
    ["0012345678902", "Made", "31.01.2024", 1],
  ];
  for (const extra of ["комментарий", 120, ""]) {
    const result = parse(rows.map(row => [...row, extra]));
    assert.equal(result.fileType, "simple", `AC1: a ${JSON.stringify(extra)} fifth column keeps the type`);
    assert.deepEqual(result.errors, [], "AC1: the extra column produces no error");
    assert.deepEqual(validateInventoryProducts(result.products), [
      { barcode: "0012345678901", name: "Expires on", quantity: null, expiryDate: "2026-09-07" },
      { barcode: "0012345678902", name: "Made", quantity: null, expiryDate: "2024-02-29" },
    ], "AC1: columns A-D keep their meaning, the extra column is ignored");
  }
});

test("a broken cell in a five-column file reports the same row as in a four-column file", () => {
  const header: unknown[] = ["Code", "Name", "Date", "Months"];
  const rows: unknown[][] = [
    ["0012345678901", "Expires on", "07.09.2026", ""],
    ["0012345678902", "Broken", "30.02.2026", ""],
  ];
  // The extra row carries the same broken date, so both files must reject the same
  // row for the same reason; only the note column is new.
  const extra = ["0012345678903", "Note only", "30.02.2026", "", "примечание"];
  const four = parse([header, ...rows]);
  const five = parse([header, ...rows, extra]);
  assert.equal(five.fileType, "simple", "AC3: the type is unchanged by the extra column");
  assert.match(four.errors[0], /^Строка 3:/);
  assert.deepEqual(five.errors.slice(0, 1), four.errors, "AC3: the first rejected row keeps its number and reason");
  assert.match(five.errors[1], /^Строка 4:/, "AC3: the row that only has a note column is still row 4");
  assert.deepEqual(five.products, four.products, "AC3: the same rows are accepted");
});

test("an unrecognised sheet still answers with the type error", () => {
  const result = parse([["что-то", "иное"], ["1", "2"]]);
  assert.deepEqual(result.products, [], "AC2: no products for an unknown sheet");
  assert.match(result.errors[0], /Не удалось определить тип файла/, "AC2: the existing error stays");
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
