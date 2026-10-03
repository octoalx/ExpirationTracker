import test from "node:test";
import assert from "node:assert/strict";
import { formatDaysLeft } from "../src/lib/days-left";

test("days left: formats whole day counts", () => {
  assert.equal(formatDaysLeft(0), "сегодня");
  assert.equal(formatDaysLeft(1), "1 день");
  assert.equal(formatDaysLeft(2), "2 дн.");
  assert.equal(formatDaysLeft(45), "45 дн.");
  assert.equal(formatDaysLeft(365), "365 дн.");
});

test("days left: floors non-integer values", () => {
  assert.equal(formatDaysLeft(10.9), "10 дн.");
  assert.equal(formatDaysLeft(1.9), "1 день");
});

test("days left: invalid values return an empty string", () => {
  assert.equal(formatDaysLeft(-1), "");
  assert.equal(formatDaysLeft(NaN), "");
  assert.equal(formatDaysLeft(Infinity), "");
});
