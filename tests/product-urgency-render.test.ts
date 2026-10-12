import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductTableEnhanced } from "../src/components/products/ProductTableEnhanced";
import type { Product } from "@prisma/client";

test("mobile sort helpers place missing expiry dates last and map status tabs", async () => {
  const { mobileSortForStatusFilter, sortProductsForMobile } = await import("../src/lib/days-left");
  const referenceDate = new Date(Date.UTC(2026, 9, 3, 12));
  const make = (id: string, expiryDate: Date | null, createdAt: Date) => ({
    id, expiryDate, createdAt,
  });
  const records = [
    make("none", null, new Date(Date.UTC(2026, 0, 1))),
    make("late", new Date(Date.UTC(2027, 0, 1)), new Date(Date.UTC(2026, 0, 2))),
    make("soon", new Date(Date.UTC(2026, 9, 5)), new Date(Date.UTC(2026, 0, 3))),
  ];
  assert.deepEqual(sortProductsForMobile(records, "expiring-soonest", referenceDate).map((r) => r.id), ["soon", "late", "none"]);
  assert.deepEqual(sortProductsForMobile(records, "expiring-latest", referenceDate).map((r) => r.id), ["late", "soon", "none"]);
  assert.deepEqual(sortProductsForMobile(records, "newest", referenceDate).map((r) => r.id), ["soon", "late", "none"]);
  assert.equal(mobileSortForStatusFilter("SOON"), "expiring-soonest");
  assert.equal(mobileSortForStatusFilter("EXPIRED"), "expiring-soonest");
  assert.equal(mobileSortForStatusFilter("ALL"), "newest");
});
