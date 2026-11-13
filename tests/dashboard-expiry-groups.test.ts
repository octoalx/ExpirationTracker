import test from "node:test";
import assert from "node:assert/strict";
import {
  groupByExpiryStatus,
  groupExpiringFirst,
  sliceGroups,
  sortProductsByExpiry,
} from "../src/lib/days-left";

/** Midday UTC keeps the Europe/Minsk calendar day stable in every DST period. */
const NOW = new Date(Date.UTC(2026, 10, 13, 12));

interface Fixture {
  id: string;
  expiryDate: string | null;
  status?: string;
}

const make = (id: string, expiryDate: string | null, status = "ACTIVE"): Fixture => ({
  id,
  expiryDate,
  status,
});

const ids = (items: ReadonlyArray<{ id: string }>) => items.map((item) => item.id);

const groupIds = (groups: ReadonlyArray<{ key: string; items: Fixture[] }>) =>
  Object.fromEntries(groups.map((group) => [group.key, ids(group.items)]));

test("FEFO order leads with the closest expiry date and closes with records without one", () => {
  const products = [
    make("none", null),
    make("late", "2027-01-01"),
    make("near", "2026-11-14"),
    make("overdue", "2026-11-10"),
  ];

  assert.deepEqual(
    ids(sortProductsByExpiry(products, NOW)),
    ["overdue", "near", "late", "none"],
    "records are ordered by remaining days, missing dates last",
  );
  assert.deepEqual(ids(products), ["none", "late", "near", "overdue"], "input array is not mutated");
});

test("equal expiry dates keep the original order so the list never jumps", () => {
  const sameDay = [make("second", "2026-11-20"), make("first", "2026-11-20")];
  assert.deepEqual(ids(sortProductsByExpiry(sameDay, NOW)), ["second", "first"]);
});

test("phone groups use the calendar boundaries: yesterday, today, +1..+3, +4..+7, later, none", () => {
  const products = [
    make("later", "2026-12-01"),
    make("warning-edge", "2026-11-20"),
    make("urgent-edge", "2026-11-16"),
    make("today", "2026-11-13"),
    make("overdue", "2026-11-12"),
    make("none", null),
  ];

  const groups = groupByExpiryStatus(products, { now: NOW, urgentThreshold: 3, warningThreshold: 7 });

  assert.deepEqual(groupIds(groups), {
    expired: ["overdue"],
    today: ["today"],
    urgent: ["urgent-edge"],
    warning: ["warning-edge"],
    safe: ["later"],
    none: ["none"],
  });
  assert.deepEqual(
    groups.map((group) => group.label),
    ["Просрочено", "Сегодня", "Срочно", "Внимание", "В норме", "Без срока"],
  );
  assert.equal(
    groups.reduce((sum, group) => sum + group.count, 0),
    products.length,
    "every record belongs to exactly one group",
  );
});

test("phone group boundaries follow the saved department thresholds", () => {
  const products = [make("day5", "2026-11-18"), make("day9", "2026-11-22")];

  const relaxed = groupByExpiryStatus(products, { now: NOW, urgentThreshold: 5, warningThreshold: 10 });
  assert.deepEqual(groupIds(relaxed), { urgent: ["day5"], warning: ["day9"] });

  const strict = groupByExpiryStatus(products, { now: NOW, urgentThreshold: 1, warningThreshold: 2 });
  assert.deepEqual(groupIds(strict), { safe: ["day5", "day9"] });
});

test("empty groups are not rendered and month-end boundaries stay calendar based", () => {
  const monthEnd = new Date(Date.UTC(2026, 10, 30, 12));
  const groups = groupByExpiryStatus(
    [make("today", "2026-11-30"), make("tomorrow", "2026-12-01")],
    { now: monthEnd, urgentThreshold: 3, warningThreshold: 7 },
  );

  assert.deepEqual(groupIds(groups), { today: ["today"], urgent: ["tomorrow"] });
  assert.ok(!groups.some((group) => group.key === "expired"), "a group without records is omitted");
});

test("archive and defect records are never reported as overdue", () => {
  const products = [
    make("archived-past", "2026-11-01", "ARCHIVED"),
    make("defect-past", "2026-11-01", "DEFECT"),
    make("active-past", "2026-11-01", "ACTIVE"),
  ];

  const groups = groupByExpiryStatus(products, { now: NOW });
  assert.deepEqual(groupIds(groups), {
    expired: ["active-past"],
    safe: ["archived-past", "defect-past"],
  });
});

test("desktop split keeps the urgent block first and stays disjoint from the full list", () => {
  const products = [
    make("later", "2026-12-10"),
    make("overdue", "2026-11-09"),
    make("today", "2026-11-13"),
    make("urgent", "2026-11-15"),
    make("warning", "2026-11-18"),
    make("none", null),
  ];

  const groups = groupExpiringFirst(products, { now: NOW, urgentThreshold: 3, warningThreshold: 7 });

  assert.deepEqual(
    groups.map((group) => group.label),
    ["Скорее истекают", "Все товары"],
  );
  assert.deepEqual(groupIds(groups), {
    expiring: ["overdue", "today", "urgent"],
    all: ["warning", "later", "none"],
  });
  assert.equal(groups[0].hint, "Просрочено: 1 · Срочно: 2");
  assert.deepEqual(
    ids(groups.flatMap((group) => group.items)),
    ids(sortProductsByExpiry(products, NOW)),
    "concatenated groups reproduce the global FEFO order",
  );
});

test("the urgent block is hidden when nothing is expiring", () => {
  const groups = groupExpiringFirst([make("later", "2027-03-01")], { now: NOW });
  assert.deepEqual(
    groups.map((group) => group.key),
    ["all"],
  );
});

test("pagination slices groups without losing, duplicating or reordering records", () => {
  const products = [
    make("p1", "2026-11-10"),
    make("p2", "2026-11-11"),
    make("p3", "2026-11-12"),
    make("p4", "2026-11-13"),
    make("p5", "2026-11-20"),
    make("p6", "2026-12-05"),
    make("p7", null),
  ];
  const groups = groupExpiringFirst(products, { now: NOW });

  const pageSize = 3;
  const pages = [0, 1, 2].map((page) =>
    sliceGroups(groups, page * pageSize, page * pageSize + pageSize),
  );

  assert.deepEqual(ids(pages[0].flatMap((group) => group.items)), ["p1", "p2", "p3"]);
  assert.deepEqual(ids(pages[1].flatMap((group) => group.items)), ["p4", "p5", "p6"]);
  assert.deepEqual(ids(pages[2].flatMap((group) => group.items)), ["p7"]);
  assert.deepEqual(
    pages[0].map((group) => group.key),
    ["expiring"],
    "the first page opens with the urgent group",
  );
  assert.deepEqual(
    pages[1].map((group) => group.key),
    ["expiring", "all"],
    "a group continues across the page boundary without repeating its header",
  );
  const continuedExpiring = pages[1].find((group) => group.key === "expiring");
  assert.equal(continuedExpiring?.count, 4, "the group header keeps its full size on page 2");
  assert.deepEqual(ids(continuedExpiring?.items ?? []), ["p4"], "only the page's share of rows is rendered");
  assert.equal(
    pages.flatMap((page) => page.flatMap((group) => group.items)).length,
    products.length,
    "pages together contain every record exactly once",
  );
});

test("the closest expiry date stays in the first row of the first page for every filter input", () => {
  const all = [
    make("near", "2026-11-10"),
    make("mid", "2026-11-25"),
    make("far", "2027-04-01"),
  ];
  for (const filter of ["ALL", "SOON", "EXPIRED"]) {
    const visible = filter === "ALL" ? all : all.filter((product) => product.id === "near");
    const groups = groupExpiringFirst(visible, { now: NOW });
    const firstPage = sliceGroups(groups, 0, 10);
    assert.equal(
      firstPage[0]?.items[0]?.id,
      "near",
      `filter ${filter} still leads with the nearest expiry date`,
    );
  }
});
