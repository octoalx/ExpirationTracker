import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/auth/signin.tsx", "utf8");

test("the floating label reads the DOM value, not only React state (AC1, AC2)", () => {
  assert.ok(source.includes('peer-[:not(:placeholder-shown)]:-top-2.5'), "filled state is a CSS rule on placeholder-shown");
  assert.ok(!/floated\s*=\s*focused\s*\|\|\s*value\.length/.test(source), "no state-only floating rule remains");
  assert.ok(source.includes("placeholder={label}"), "the placeholder drives the :placeholder-shown state");
  assert.ok(source.includes('className={cn(\n          "peer w-full'), "the input is the peer of its label");
});

test("focus still lifts the label (AC3)", () => {
  assert.ok(source.includes("focused\n            ? FLOATED_LABEL"), "focused label uses the floated style");
  assert.ok(source.includes("onFocus={() => setFocused(true)}"), "focus state is tracked");
});

test("the resting label keeps its size and position (AC2)", () => {
  assert.ok(source.includes('"top-3.5 text-sm peer-[:not(:placeholder-shown)]'), "resting position is top-3.5 text-sm");
});
