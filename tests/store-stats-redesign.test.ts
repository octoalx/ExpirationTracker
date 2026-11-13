import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expiryBadge } from "../src/components/products/ProductTableEnhanced";

const read = (path: string) => readFileSync(path, "utf8");

const store = read("src/pages/store.tsx");
const inspection = read("src/components/store/Inspection.tsx");
const team = read("src/components/store/StoreTeam.tsx");
const stats = read("src/pages/stats.tsx");

test("/store closes every confirmation through the application dialog, never natively", () => {
  const native = /\bwindow\.(confirm|prompt|alert)\s*\(/g;
  for (const [name, source] of [["store.tsx", store], ["Inspection.tsx", inspection], ["StoreTeam.tsx", team]] as const) {
    assert.deepEqual(source.match(native) ?? [], [], `${name} keeps no native confirmation window`);
  }
  // One dialog per destructive flow: the closing inspection result, the password
  // reset and the revocation of access.
  assert.equal((inspection.match(/<Dialog /g) ?? []).length, 1, "Inspection.tsx has one confirmation dialog");
  assert.equal((team.match(/<Dialog /g) ?? []).length, 2, "StoreTeam.tsx has a dialog for reset and one for revocation");
  for (const copy of ["Новый пароль для", "Отозвать доступ у", "Товары отдела сохранятся, авторство записей будет снято.", "Пароль должен быть не короче"]) {
    assert.ok(team.includes(copy), `StoreTeam.tsx keeps the wording: ${copy}`);
  }
  for (const copy of ["Будет обработана вся запись.", ">Подтвердить<", ">Отмена<"]) {
    assert.ok(inspection.includes(copy), `Inspection.tsx keeps the wording: ${copy}`);
  }
});

test("both screens sit in the dashboard shell: one content width, one heading, one section rhythm", () => {
  for (const [name, source] of [["store.tsx", store], ["stats.tsx", stats]] as const) {
    assert.ok(source.includes("inventory-page mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5"),
      `${name} uses the dashboard container width and gaps`);
    assert.ok(source.includes('className="work-page-title"'), `${name} uses the dashboard heading style`);
    assert.equal(/max-w-(3xl|5xl)/.test(source), false, `${name} keeps no older narrow container`);
  }
});

test("the redesign palette replaces the older one on the two screens", () => {
  for (const [name, source] of [["store.tsx", store], ["stats.tsx", stats], ["Inspection.tsx", inspection]] as const) {
    assert.equal(/(text|bg|border)-(slate|blue|red|emerald)-\d00/.test(source), false, `${name} keeps no legacy colour utilities`);
    assert.equal(source.includes("work-surface"), false, `${name} uses the dash panel instead of the old surface`);
  }
  assert.ok(store.includes("border-dash-line bg-dash-panel"), "store panels use the dash tokens");
  assert.ok(stats.includes("border-dash-line bg-dash-panel"), "stats panels use the dash tokens");
});

test("the walk summary is the dashboard cell strip with one row of mode chips", () => {
  assert.ok(inspection.includes('aria-label="Сводка обхода"'), "the summary is a labelled group");
  assert.ok(inspection.includes("md:text-[40px] md:leading-[48px]"), "the numbers take the dashboard KPI step");
  assert.equal((inspection.match(/aria-label="Режим обхода"/g) ?? []).length, 1, "the modes are a single row");
  for (const label of ["Просрочено", "Срочно", "Внимание", "По риску", "Не найдены (", "Без срока ("]) {
    assert.ok(inspection.includes(label), `the walk keeps its wording: ${label}`);
  }
  // Phone card: the date is the largest element, the state is a badge, the
  // actions fall into one column.
  assert.ok(inspection.includes("text-[22px] font-extrabold leading-7 tabular-nums"), "the expiry date is large on a phone");
  assert.ok(inspection.includes("expiryBadge("), "the state badge comes from the dashboard table");
  assert.ok(inspection.includes("grid grid-cols-1 gap-2 md:flex md:flex-wrap"), "actions stack in one column on a phone");
});

test("/stats shows four indicators in one row and reuses the dashboard expiry labels", () => {
  assert.ok(stats.includes("md:grid-cols-4"), "four cells share one row on a desktop");
  for (const label of ["Просрочено", "Скоро истекает", "В норме", "Без срока"]) {
    assert.ok(stats.includes(`label="${label}"`), `the indicator is kept: ${label}`);
  }
  assert.ok(stats.includes("expiryBadge(getExpiryStatus("), "the risk list takes its labels from the dashboard table");
  assert.ok(stats.includes("Оценка по {stats.activeProducts} активным записям. Близкий срок — до {stats.warningThreshold} дней включительно; срочный — до {stats.urgentThreshold}. Архив и брак исключены из проверки сроков."),
    "the threshold footnote is kept word for word");
});

test("the dashboard table and the statistics list print the same four expiry labels", () => {
  const labels = [["expired", -3], ["urgent", 2], ["warning", 5], ["safe", 30]] as const;
  assert.deepEqual(labels.map(([status, daysLeft]) => expiryBadge(status, daysLeft).label),
    ["Просрочен", "Срочно · 2 дн.", "Внимание · 5 дн.", "Осталось 30 дн."]);
  assert.equal(expiryBadge("urgent", 0).label, "Срочно · сегодня", "the last day reads as today");
});

test("phone targets on both screens stay at least 44 px", () => {
  assert.ok(store.includes('"inline-flex min-h-11 flex-1'), "store tabs take the 44 px step");
  assert.ok(inspection.includes('"inline-flex min-h-11 min-w-0 flex-1'), "walk chips take the 44 px step");
  assert.ok(stats.includes('"inline-flex min-h-11 min-w-0 flex-1'), "risk chips take the 44 px step");
  assert.ok(stats.includes("flex min-h-16 items-center"), "a statistics row is 64 px high on a phone");
  // Application buttons already grow to the 44 px touch target below the desktop breakpoint.
  assert.match(read("src/styles/globals.css"), /\.work-main \[data-slot="button"\] \{ min-height: 44px; \}/);
});
