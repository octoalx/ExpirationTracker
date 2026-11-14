import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/products/MobileProductList.tsx", "utf8");

test("the status bar is a separate inset element, not a border on the rounded header row (AC1)", () => {
  assert.ok(source.includes('<span aria-hidden="true" className={cn("pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full"'), "absolute bar with 12 px vertical inset");
  assert.ok(!/className=\{cn\("flex items-center gap-1 border-l-4", GROUP_MARKER/.test(source), "header row no longer carries the coloured border");
});

test("group colours are background classes that match the desktop status colours (AC3)", () => {
  for (const cls of ["bg-dash-expired", "bg-dash-amber-bar", "bg-dash-control"]) assert.ok(source.includes(cls), cls);
  assert.ok(!/GROUP_MARKER[\s\S]*?border-l-dash/.test(source), "no border colour left in the map");
});
