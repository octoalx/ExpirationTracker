import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateExpiryDate } from "../src/lib/shelf-life";
import { findScannedProducts } from "../src/lib/product-scan";

test("scanning returns all exact matches, including archived records, without matching prefixes", () => {
  const records = [
    { id: "a", barcode: "4607015330124", status: "ACTIVE" },
    { id: "b", barcode: "4607015330124", status: "ARCHIVED" },
    { id: "c", barcode: "46070153301240", status: "ACTIVE" },
    { id: "d", barcode: null, status: "ACTIVE" },
  ];
  assert.deepEqual(findScannedProducts(records, " 4607015330124 ").map(record => record.id), ["a", "b"]);
  assert.deepEqual(findScannedProducts(records, "12345678"), []);
});

test("shelf life uses calendar months rather than a fixed day approximation", () => {
  assert.equal(calculateExpiryDate("2026-10-02", "6", "months"), "2027-04-02");
  assert.equal(calculateExpiryDate("2024-01-31", "1", "months"), "2024-02-29");
  assert.equal(calculateExpiryDate("2025-01-31", "1", "months"), "2025-02-28");
  assert.equal(calculateExpiryDate("2024-02-29", "12", "months"), "2025-02-28");
});

test("days and existing weeks remain supported across date boundaries", () => {
  assert.equal(calculateExpiryDate("2026-12-31", "1", "days"), "2027-01-01");
  assert.equal(calculateExpiryDate("2024-02-28", "1", "days"), "2024-02-29");
  assert.equal(calculateExpiryDate("2026-10-02", "2", "weeks"), "2026-10-16");
});

test("cleared or invalid source data never retains a previous calculated expiry", () => {
  for (const [date, duration] of [["", "6"], ["2026-10-02", ""], ["2026-10-02", "0"], ["2026-10-02", "-1"], ["2026-10-02", "1.5"], ["2026-02-30", "6"]]) {
    assert.equal(calculateExpiryDate(date, duration, "months"), "");
  }
});

const dashboardSource = readFileSync("src/pages/dashboard.tsx", "utf8");

test("search field shows an inline clear button that resets the query", () => {
  assert.match(dashboardSource, /\{searchTerm && \(\s*<button/);
  assert.ok(dashboardSource.includes('aria-label="Очистить поиск"'));
  assert.ok(dashboardSource.includes("absolute right-2 top-1/2 -translate-y-1/2"));
  assert.ok(
    dashboardSource.includes("h-12 pl-10 pr-10 text-base bg-white border-slate-200 focus:border-blue-700"),
  );
  assert.ok(dashboardSource.includes('setScannedBarcode(""); setSearchTerm(""); setCurrentPage(1);'));
});

test("mobile filter row no longer renders the reset cross button", () => {
  assert.ok(
    dashboardSource.includes(
      'className="hidden min-h-11 items-center px-2 text-sm font-semibold text-[#1554b5] hover:text-[#12479a] md:inline-flex"',
    ),
  );
  assert.ok(dashboardSource.includes(">Сбросить</button>"));
  assert.ok(!dashboardSource.includes("max-md:-mr-2"));
  assert.ok(!dashboardSource.includes('className="max-md:sr-only"'));
  assert.ok(!dashboardSource.includes('<X aria-hidden="true" className="size-6 md:hidden"'));
});
