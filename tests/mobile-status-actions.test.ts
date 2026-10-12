import test from "node:test";
import assert from "node:assert/strict";
import { getProductActions } from "../src/lib/product-status-actions";

test("product status actions: order and labels match the owner copy", () => {
  const actions = getProductActions("ACTIVE");
  assert.deepEqual(
    actions.map((action) => [action.key, action.label]),
    [
      ["edit", "Изменить"],
      ["defect", "Брак"],
      ["active", "Активные"],
      ["archive", "Архив"],
    ],
  );
});

test("product status actions: ACTIVE selects only the active button", () => {
  const actions = getProductActions("ACTIVE");
  assert.deepEqual(
    actions.filter((action) => action.selected).map((action) => action.key),
    ["active"],
  );
  assert.equal(actions.find((action) => action.key === "edit")?.selected, false);
});

test("product status actions: DEFECT selects only the defect button", () => {
  const actions = getProductActions("DEFECT");
  assert.deepEqual(
    actions.filter((action) => action.selected).map((action) => action.key),
    ["defect"],
  );
  assert.equal(actions.find((action) => action.key === "edit")?.selected, false);
});

test("product status actions: ARCHIVED selects only the archive button", () => {
  const actions = getProductActions("ARCHIVED");
  assert.deepEqual(
    actions.filter((action) => action.selected).map((action) => action.key),
    ["archive"],
  );
  assert.equal(actions.find((action) => action.key === "edit")?.selected, false);
});

test("product status actions: unknown status selects nothing", () => {
  for (const status of ["UNKNOWN", "active", "", null, undefined]) {
    const actions = getProductActions(status as string | null | undefined);
    assert.equal(actions.length, 4);
    assert.deepEqual(
      actions.filter((action) => action.selected),
      [],
    );
  }
});

test("product status actions: the returned list and items are immutable", () => {
  const actions = getProductActions("ACTIVE");
  assert.equal(Object.isFrozen(actions), true);
  assert.equal(Object.isFrozen(actions[0]), true);
  assert.throws(() => {
    (actions as ProductStatusActionMutable[]).push({
      key: "edit",
      label: "Изменить",
      selected: false,
    });
  }, TypeError);
  // Frozen arrays always reject push; frozen object assignment may only throw
  // in strict mode, so assert the value survives regardless of the host mode.
  const first = actions[0];
  try {
    (first as { selected: boolean }).selected = true;
  } catch {
    // Expected in strict mode.
  }
  assert.equal(first.selected, false);
});

interface ProductStatusActionMutable {
  key: string;
  label: string;
  selected: boolean;
}
