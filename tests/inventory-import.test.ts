import test from "node:test";
import assert from "node:assert/strict";
import { expiryFromManufacture, parseLegacyInventory, validateInventoryProducts } from "../src/lib/inventory-import";

test("month arithmetic clamps month ends and handles leap years", () => {
  assert.equal(expiryFromManufacture("31.8.2023", 6), "2024-02-29");
  assert.equal(expiryFromManufacture("29.2.2024", 12), "2025-02-28");
  assert.equal(expiryFromManufacture("7.3.2025", 18), "2026-09-07");
  assert.equal(expiryFromManufacture("31.1.2025", 1), "2025-02-28");
  assert.throws(() => expiryFromManufacture("31.2.2025", 18));
});

test("OLD rows are excluded; missing shelf life preserves the final expiry date", () => {
  const result = parseLegacyInventory("12345678\tA\tOLD\t7.3.2025\t18\n0123456789012\tB\t\t7.3.2025\t18\n12345679\tC\t\t28.1.2027\t");
  assert.equal(result.excluded, 1);
  assert.equal(result.missingShelfLife, 1);
  assert.deepEqual(result.products, [
    { barcode: "0123456789012", name: "B", quantity: null, expiryDate: "2026-09-07" },
    { barcode: "12345679", name: "C", quantity: null, expiryDate: "2027-01-28" },
  ]);
});

test("dates without months are final expiry dates and remain calendar validated", () => {
  assert.equal(expiryFromManufacture("29.2.2024", null), "2024-02-29");
  assert.equal(expiryFromManufacture("28.1.2027", null), "2027-01-28");
  assert.throws(() => expiryFromManufacture("31.2.2025", null));
  assert.throws(() => expiryFromManufacture("29.2.2025", null));
});

test("invalid source dates, shelf life and row shape reject import", () => {
  for (const line of ["12345678\tA\t\t31.2.2025\t18", "12345678\tA\t\t1.1.2025\t0", "12345678\tA\t\t1.1.2025\t18x", "12345678\tA"]) {
    assert.throws(() => parseLegacyInventory(line));
  }
});

test("API validation preserves optional dates and rejects calendar overflow", () => {
  assert.deepEqual(validateInventoryProducts([{ barcode: "12345678", name: "A" }]), [{ barcode: "12345678", name: "A", quantity: null, expiryDate: null }]);
  for (const patch of [{ expiryDate: "2025-02-29" }, { quantity: -1 }, { quantity: 1.5 }, { expiryDate: "today" }]) {
    assert.throws(() => validateInventoryProducts([{ barcode: "12345678", name: "A", ...patch }]));
  }
});

import { getExpiryStatus } from "../src/lib/utils";

test("unknown expiry never becomes an expired Unix epoch", () => {
  assert.equal(getExpiryStatus(null), "safe");
  assert.equal(getExpiryStatus(""), "safe");
  assert.equal(getExpiryStatus(new Date(2000, 0, 1)), "expired");
});

import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ProductTableEnhanced} from "../src/components/products/ProductTableEnhanced";
import ProductCard from "../src/components/ProductCard";
test("table and card display unknown expiry without a fabricated date", () => {
const product:any={id:"missing",name:"No expiry",barcode:"0123456789012",quantity:null,expiryDate:null,status:"ACTIVE",createdAt:new Date(),updatedAt:new Date(),userId:"test"};
const noop=()=>{};
for(const component of [React.createElement(ProductTableEnhanced,{products:[product]}),React.createElement(ProductCard,{product,onProductDeleted:noop,onProductConsumed:noop,onProductUpdated:noop})]) {
const html=renderToStaticMarkup(component);
assert.ok(html.includes("Срок не указан"));
assert.ok(!html.includes("01.01.1970"));
assert.ok(!html.includes("Просрочен"));
}
});
