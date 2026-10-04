import test from "node:test";
import assert from "node:assert/strict";
import { formatDaysLeft, formatExpiredDaysLeft } from "../src/lib/days-left";

const NBSP = "\u00A0";

test("days left: formats whole day counts", () => {
  assert.equal(formatDaysLeft(0), "сегодня");
  assert.equal(formatDaysLeft(1), `1${NBSP}день`);
  assert.equal(formatDaysLeft(2), `2${NBSP}дн.`);
  assert.equal(formatDaysLeft(45), `45${NBSP}дн.`);
  assert.equal(formatDaysLeft(365), `365${NBSP}дн.`);
});

test("days left: floors non-integer values", () => {
  assert.equal(formatDaysLeft(10.9), `10${NBSP}дн.`);
  assert.equal(formatDaysLeft(1.9), `1${NBSP}день`);
});

test("days left: invalid values return an empty string", () => {
  assert.equal(formatDaysLeft(-1), "");
  assert.equal(formatDaysLeft(NaN), "");
  assert.equal(formatDaysLeft(Infinity), "");
  assert.equal(formatDaysLeft(-Infinity), "");
});

test("expired days left: drops the sign and shows elapsed whole days", () => {
  assert.equal(formatExpiredDaysLeft(-1), `1${NBSP}день`);
  assert.equal(formatExpiredDaysLeft(-3), `3${NBSP}дн.`);
  assert.equal(formatExpiredDaysLeft(-1.9), `1${NBSP}день`);
  assert.equal(formatExpiredDaysLeft(-45.5), `45${NBSP}дн.`);
});

test("expired days left: zero and invalid values return an empty string", () => {
  assert.equal(formatExpiredDaysLeft(0), "");
  assert.equal(formatExpiredDaysLeft(2), "");
  assert.equal(formatExpiredDaysLeft(NaN), "");
  assert.equal(formatExpiredDaysLeft(Infinity), "");
  assert.equal(formatExpiredDaysLeft(-Infinity), "");
});

test("day counts never wrap between the number and the unit", () => {
  const labels = [formatDaysLeft(1), formatDaysLeft(2), formatDaysLeft(45), formatExpiredDaysLeft(-3)];
  for (const label of labels) {
    assert.ok(label.includes(NBSP), `expected a non-breaking space in ${label}`);
    assert.ok(!label.includes(" "), `expected no regular space in ${label}`);
  }
});
