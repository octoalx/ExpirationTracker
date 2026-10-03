import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { Product } from "@prisma/client";
import {
  DEFAULT_MOBILE_SORT,
  MOBILE_SORT_OPTIONS,
  getDaysLeft,
  mobileSortForStatusFilter,
  sortProductsForMobile,
} from "../src/lib/days-left";
import MobileProductList from "../src/components/products/MobileProductList";

const referenceDate = new Date(2026, 9, 3, 12);

const makeProduct = (overrides: Partial<Product> & { id: string; name: string }): Product => ({
  barcode: null,
  expiryDate: null,
  status: "ACTIVE",
  isExpired: false,
  quantity: null,
  createdAt: referenceDate,
  updatedAt: referenceDate,
  userId: "owner",
  manufacturingDate: null,
  shelfLife: null,
  shelfLifeUnit: null,
  ...overrides,
} as Product);

const products: Product[] = [
  makeProduct({ id: "no-date", name: "NoDate", createdAt: new Date(2026, 0, 9), expiryDate: null }),
  makeProduct({ id: "late", name: "Late", createdAt: new Date(2026, 0, 2), expiryDate: new Date(2027, 0, 1) }),
  makeProduct({ id: "soon", name: "Soon", createdAt: new Date(2026, 0, 3), expiryDate: new Date(2026, 9, 5) }),
  makeProduct({ id: "middle", name: "Middle", createdAt: new Date(2026, 0, 4), expiryDate: new Date(2026, 10, 1) }),
];

test("days left is null without a valid expiry date and counts calendar days otherwise", () => {
  assert.equal(getDaysLeft(null, referenceDate), null);
  assert.equal(getDaysLeft("not-a-date", referenceDate), null);
  assert.equal(getDaysLeft(new Date(2026, 9, 3), referenceDate), 0);
  assert.equal(getDaysLeft(new Date(2026, 9, 5), referenceDate), 2);
});

test("newest order sorts by createdAt descending", () => {
  const sorted = sortProductsForMobile(products, "newest", referenceDate);
  assert.deepEqual(sorted.map((p) => p.id), ["middle", "soon", "late", "no-date"]);
});

test("expiring-soonest sorts by remaining days ascending", () => {
  const sorted = sortProductsForMobile(products, "expiring-soonest", referenceDate);
  assert.deepEqual(sorted.map((p) => p.id), ["soon", "middle", "late", "no-date"]);
});

test("expiring-latest sorts by remaining days descending", () => {
  const sorted = sortProductsForMobile(products, "expiring-latest", referenceDate);
  assert.deepEqual(sorted.map((p) => p.id), ["late", "middle", "soon", "no-date"]);
});

test("products without expiry date stay last for every sort option", () => {
  for (const option of MOBILE_SORT_OPTIONS.map((o) => o.value)) {
    const sorted = sortProductsForMobile(products, option, referenceDate);
    assert.equal(sorted[sorted.length - 1].id, "no-date", `last item for ${option}`);
  }
});

test("global mobile ordering is not limited to a single page slice", () => {
  // Mirrors the dashboard: sort the whole filtered set, then paginate. The
  // earliest expiry overall must lead page 1 even if it was not on the first
  // page of the previous (desktop) order.
  const many: Product[] = Array.from({ length: 30 }, (_, index) =>
    makeProduct({
      id: `p${index}`,
      name: `Product ${index}`,
      createdAt: new Date(2026, 0, 1 + (index % 20)),
      expiryDate: new Date(2026, 11, 1 + index),
    }),
  );
  many.push(makeProduct({ id: "earliest", name: "Earliest", expiryDate: new Date(2026, 9, 4) }));
  many.push(makeProduct({ id: "no-date", name: "NoDate", expiryDate: null }));

  const globallySorted = sortProductsForMobile(many, "expiring-soonest", referenceDate);
  const pageOne = globallySorted.slice(0, 25);
  assert.equal(pageOne[0].id, "earliest");

  const globallyLatest = sortProductsForMobile(many, "expiring-latest", referenceDate);
  assert.equal(globallyLatest[0].id, "p29");

  // Products without an expiry date always trail the whole list, never page 1.
  assert.equal(globallySorted[globallySorted.length - 1].id, "no-date");
  assert.ok(!pageOne.some((product) => product.id === "no-date"));
});

test("sortProductsForMobile does not mutate the input array", () => {
  const original = products.map((p) => p.id);
  sortProductsForMobile(products, "expiring-soonest", referenceDate);
  assert.deepEqual(products.map((p) => p.id), original);
});

test("expiry status filters auto-select the soonest order, others keep newest", () => {
  assert.equal(mobileSortForStatusFilter("SOON"), "expiring-soonest");
  assert.equal(mobileSortForStatusFilter("EXPIRED"), "expiring-soonest");
  assert.equal(mobileSortForStatusFilter("ALL"), DEFAULT_MOBILE_SORT);
  assert.equal(mobileSortForStatusFilter("ACTIVE"), DEFAULT_MOBILE_SORT);
});

const renderMobile = (list: Product[], sortOption?: "newest" | "expiring-soonest" | "expiring-latest") =>
  renderToStaticMarkup(
    createElement(MobileProductList, { products: list, referenceDate, sortOption }),
  );

const orderOf = (html: string, names: string[]) =>
  names
    .map((name) => ({ name, index: html.indexOf(`>${name}<`) }))
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.name);

test("mobile list renders the sort selector with all options", () => {
  const html = renderMobile(products);
  assert.ok(html.includes('aria-label="Сортировка"'));
  for (const option of MOBILE_SORT_OPTIONS) {
    assert.ok(html.includes(`>${option.label}<`), `missing option ${option.label}`);
  }
});

test("controlled mobile list renders rows in the requested order and keeps no-date last", () => {
  const names = products.map((p) => p.name);
  const soonest = renderMobile(products, "expiring-soonest");
  assert.deepEqual(orderOf(soonest, names), ["Soon", "Middle", "Late", "NoDate"]);

  const latest = renderMobile(products, "expiring-latest");
  assert.deepEqual(orderOf(latest, names), ["Late", "Middle", "Soon", "NoDate"]);

  const newest = renderMobile(products, "newest");
  assert.deepEqual(orderOf(newest, names), ["Middle", "Soon", "Late", "NoDate"]);
});
