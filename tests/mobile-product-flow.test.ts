import test from "node:test";
import assert from "node:assert/strict";
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
