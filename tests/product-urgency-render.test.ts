import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductTableEnhanced } from "../src/components/products/ProductTableEnhanced";
import type { Product } from "@prisma/client";

test("desktop and mobile inventory render saved urgency thresholds consistently", () => {
  const referenceDate = new Date(2026, 9, 3, 12);
  const product: Product = { id: "fixture", name: "Test product", barcode: "4607015330124", expiryDate: new Date(2026, 9, 23),
    status: "ACTIVE", isExpired: false, quantity: null, createdAt: referenceDate, updatedAt: referenceDate, userId: "owner",
    manufacturingDate: null, shelfLife: null, shelfLifeUnit: null };
  const render = (urgentThreshold: number, warningThreshold: number) => renderToStaticMarkup(createElement(ProductTableEnhanced,
    { products: [product], urgentThreshold, warningThreshold, referenceDate }));
  const safe = render(3, 7);
  assert.ok(safe.includes("В норме"));
  assert.ok(!safe.includes("Внимание · 20 дн."));
  const warning = render(3, 30);
  assert.ok(warning.includes("Внимание · 20 дн."), "Desktop displays warning and days");
  assert.ok(warning.includes('Внимание<span class="block tabular-nums">20 дн.</span>'), "Mobile displays days below warning");
  assert.ok(warning.includes("text-expiry-marker"));
  const urgent = render(20, 30);
  assert.ok(urgent.includes("Срочно · 20 дн."), "Desktop displays urgent at the boundary");
  assert.ok(urgent.includes('Срочно<span class="block tabular-nums">20 дн.</span>'), "Mobile displays days below urgent at the boundary");
  assert.ok(urgent.includes("text-red-600"));
});
