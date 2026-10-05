import test from "node:test";
import assert from "node:assert/strict";
import { computeKeyboardInset } from "../src/lib/keyboard-inset";

test("keyboard covering the bottom of the layout viewport is measured", () => {
  assert.equal(computeKeyboardInset(844, 508, 0), 336);
});

test("visual viewport scrolled down by the browser still reports the covered height", () => {
  assert.equal(computeKeyboardInset(844, 508, 120), 216);
});

test("browser chrome changes and a closed keyboard are not treated as a keyboard", () => {
  assert.equal(computeKeyboardInset(844, 844, 0), 0);
  assert.equal(computeKeyboardInset(844, 790, 0), 0);
});

test("pinch zoom never produces a keyboard inset", () => {
  assert.equal(computeKeyboardInset(844, 400, 0, 2), 0);
});
