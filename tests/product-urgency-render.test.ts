import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductTableEnhanced } from "../src/components/products/ProductTableEnhanced";
import type { Product } from "@prisma/client";

test("desktop and mobile inventory render saved urgency thresholds consistently", () => {
  const referenceDate = new Date(Date.UTC(2026, 9, 3, 12));
  const product: Product = { id: "fixture", name: "Test product", barcode: "4607015330124", expiryDate: new Date(Date.UTC(2026, 9, 23)),
    status: "ACTIVE", isExpired: false, quantity: null, createdAt: referenceDate, updatedAt: referenceDate, userId: "owner",
    manufacturingDate: null, shelfLife: null, shelfLifeUnit: null,
    storeId: null, version: 0, resolution: null, missing: false, checkedAt: null, checkedBy: null, deletedAt: null };
  const render = (urgentThreshold: number, warningThreshold: number) => renderToStaticMarkup(createElement(ProductTableEnhanced,
    { products: [product], urgentThreshold, warningThreshold, referenceDate }));
  const safe = render(3, 7);
  assert.ok(!safe.includes("В норме"), "Mobile safe status no longer shows the old label");
  assert.ok(safe.includes("20 дн."), "Safe status shows remaining days");
  assert.ok(!safe.includes("Внимание · 20 дн."));
  const warning = render(3, 30);
  assert.ok(warning.includes("Внимание · 20 дн."), "Desktop displays warning and days");
  assert.ok(warning.includes('Внимание<span class="block tabular-nums">20\u00A0дн.</span>'), "Mobile displays days below warning");
  assert.ok(warning.includes("text-expiry-marker"));
  const urgent = render(20, 30);
  assert.ok(urgent.includes("Срочно · 20 дн."), "Desktop displays urgent at the boundary");
  assert.ok(urgent.includes('Срочно<span class="block tabular-nums">20\u00A0дн.</span>'), "Mobile displays days below urgent at the boundary");
  assert.ok(urgent.includes("text-red-600"));
});

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

test("mobile expired status renders overdue days on a second line", () => {
  const referenceDate = new Date(Date.UTC(2026, 9, 3, 12));
  const make = (id: string, expiryDate: Date): Product => ({
    id, name: `Product ${id}`, barcode: "4607015330124", expiryDate,
    status: "ACTIVE", isExpired: false, quantity: null, createdAt: referenceDate,
    updatedAt: referenceDate, userId: "owner", manufacturingDate: null,
    shelfLife: null, shelfLifeUnit: null,
    storeId: null, version: 0, resolution: null, missing: false, checkedAt: null, checkedBy: null, deletedAt: null,
  });
  const render = (expiryDate: Date) => renderToStaticMarkup(createElement(ProductTableEnhanced,
    { products: [make("expired", expiryDate)], urgentThreshold: 3, warningThreshold: 7, referenceDate }));

  const threeDays = render(new Date(Date.UTC(2026, 8, 30)));
  assert.ok(threeDays.includes(`Просрочен<span class="block tabular-nums">3\u00A0дн.</span>`), "Mobile expired status shows overdue days below the label");
  assert.ok(threeDays.includes("text-red-700"), "Expired mobile status keeps its red styling");

  const oneDay = render(new Date(Date.UTC(2026, 9, 2)));
  assert.ok(oneDay.includes(`Просрочен<span class="block tabular-nums">1\u00A0день</span>`), "Mobile expired status uses the singular for one day");
});
