import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const settings = read("src/pages/settings.tsx");
const card = read("src/components/IntegrationCard.tsx");
const telegram = read("src/components/TelegramConnect.tsx");
const store = read("src/pages/store.tsx");
const stats = read("src/pages/stats.tsx");

const SCREENS: ReadonlyArray<[string, string]> = [
  ["settings.tsx", settings],
  ["IntegrationCard.tsx", card],
  ["TelegramConnect.tsx", telegram],
];

test("/settings takes the dashboard shell: one content width, one heading, one panel", () => {
  assert.ok(settings.includes("inventory-page mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5"),
    "settings uses the dashboard container width and gaps");
  assert.ok(settings.includes('className="work-page-title"'), "settings uses the dashboard heading style");
  assert.equal(/max-w-(3xl|4xl|5xl)/.test(settings), false, "the older narrow container is gone");
  assert.equal(settings.includes("work-surface"), false, "the old surface is replaced by the dash panel");
  assert.ok(settings.includes("rounded-xl border border-dash-line bg-dash-panel"), "the tab panel is a dash panel");
  // The same shell as the two screens already rebuilt on this system.
  for (const [name, source] of [["store.tsx", store], ["stats.tsx", stats]] as const) {
    assert.ok(source.includes("inventory-page mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5"),
      `${name} keeps the same container`);
  }
});

test("the redesign palette replaces the older one and no dark variant is added", () => {
  const legacy = /(text|bg|border|from|to)-(slate|blue|red|rose|amber|emerald|orange|gray|zinc)-\d{2,3}/;
  for (const [name, source] of SCREENS) {
    assert.equal(legacy.test(source), false, `${name} keeps no legacy colour utility`);
    assert.equal(source.includes("dark:"), false, `${name} adds no dark variant`);
    assert.equal(/linear-gradient|bg-linear|gradient-/.test(source), false, `${name} keeps no gradient card`);
  }
  for (const token of ["text-dash-ink", "text-dash-muted", "border-dash-control", "bg-dash-soft"]) {
    assert.ok(settings.includes(token) || card.includes(token) || telegram.includes(token), `the dash token is used: ${token}`);
  }
});

test("the four tabs are one row with icons, an underline and the unsaved marker", () => {
  assert.equal((settings.match(/role="tablist"/g) ?? []).length, 1, "the tabs are a single strip");
  assert.equal((settings.match(/role="tab"/g) ?? []).length, 1, "the tab button is rendered once, in the map");
  for (const label of ["Личные данные", "Команда", "Интеграции", "Статусы"]) {
    assert.ok(settings.includes(`label: "${label}"`), `the tab is kept: ${label}`);
  }
  assert.ok(settings.includes("flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 py-2"),
    "tabs are a row of equal cells with a 64 px phone target");
  assert.ok(settings.includes("sm:min-h-12 sm:flex-row sm:gap-2 sm:text-sm"), "tabs become one horizontal row on a desktop");
  assert.ok(settings.includes('className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-dash-accent"'),
    "the active tab is marked by the dashboard accent underline");
  assert.ok(settings.includes('aria-label="Есть несохранённые изменения"'), "the unsaved marker stays");
  assert.ok(settings.includes("Сохраняются только изменённые поля этой вкладки. * — есть несохранённые изменения."),
    "the save hint stays word for word");
  // Icon duplicates: «Статусы» no longer borrows the defect triangle and every tab has its own icon.
  assert.equal(settings.includes("AlertTriangle"), false, "the statuses tab no longer uses the defect triangle");
  const icons = [...settings.matchAll(/label: "[^"]+", icon: (\w+)/g)].map(match => match[1]);
  assert.deepEqual(icons, ["User", "Users", "Bell", "Gauge"], "each tab has its own icon");
  assert.equal(new Set(icons).size, icons.length, "no icon is repeated");
});

test("the statuses tab shows two dashboard cells instead of gradient cards", () => {
  for (const label of ["Срочно", "Внимание", "Дней до истечения"]) {
    assert.ok(settings.includes(label), `the wording is kept: ${label}`);
  }
  assert.ok(settings.includes('aria-label="Срочно, дней до истечения"') && settings.includes('aria-label="Внимание, дней до истечения"'),
    "each cell carries its own labelled number");
  assert.equal((settings.match(/md:text-\[40px\] md:leading-\[48px\]/g) ?? []).length, 2,
    "both numbers take the dashboard KPI step");
  assert.ok(settings.includes("bg-dash-expired") && settings.includes("bg-dash-amber-bar"),
    "red and amber live in the dot marker only");
  assert.ok(settings.includes("text-dash-expired") && settings.includes("text-dash-amber-ink"),
    "red and amber live in the number text only");
  // The values are the answered settings, not a hardcoded pair.
  assert.ok(settings.includes("value={settings.urgentThreshold}") && settings.includes("value={settings.warningThreshold}"),
    "thresholds come from the settings response");
  assert.equal(/urgentThreshold: 3[,}\s]/.test(settings.replace("urgentThreshold: 3 as number | string", "")), false,
    "no second hardcoded urgent threshold outside the initial state");
});

test("the integrations tab shares one card style and a secondary test-email button", () => {
  for (const copy of ["Telegram · помощник для обхода", "Личные уведомления в Telegram", "Расписание уведомлений",
    "Время Минска (Europe/Minsk). Используется для Telegram и email.", "Email (SMTP)", "Тестовое письмо"]) {
    assert.ok(settings.includes(copy), `the wording is kept: ${copy}`);
  }
  assert.equal((settings.match(/rounded-\[10px\] border border-dash-line p-4/g) ?? []).length, 2,
    "the Telegram and schedule blocks share the card border");
  assert.ok(card.includes("rounded-[10px] border border-dash-line"), "the email card takes the same border");
  assert.ok(settings.includes("border border-dash-control bg-white px-4 text-[13px] font-semibold text-dash-ink-2"),
    "the test email button is a secondary action");
  assert.equal(settings.includes("rose"), false, "the pink test button is gone");
  // One switch component for both places, on the dash tokens.
  assert.ok(card.includes("export function IntegrationSwitch"), "the switch is shared");
  assert.ok(settings.includes("<IntegrationSwitch"), "the settings page reuses it");
  assert.ok(card.includes('role="switch"') && card.includes('aria-checked={checked}'), "the switch keeps its semantics");
  assert.ok(telegram.includes("text-dash-ink") && telegram.includes("text-dash-muted") && telegram.includes("text-dash-accent"),
    "the Telegram block is on the dash tokens");
});

test("the password rule has one source for both the wording and the check", () => {
  assert.ok(settings.includes("const PASSWORD_MIN_LENGTH = 8"));
  assert.ok(settings.includes("const PASSWORD_MAX_BYTES = 72"));
  assert.ok(settings.includes("newPassword.length < PASSWORD_MIN_LENGTH"),
    "the check reads the shared minimum");
  assert.ok(settings.includes("encode(newPassword).length > PASSWORD_MAX_BYTES"),
    "the check reads the shared byte limit");
  assert.ok(settings.includes("{PASSWORD_HINT}"), "the note under the fields is generated from the same numbers");
  assert.equal((settings.match(/Пароль: минимум/g) ?? []).length, 1, "the error text is written once");
  assert.ok(settings.includes("Новые пароли не совпадают.") && settings.includes("Безопасность аккаунта"),
    "the rest of the password wording is kept");
});

test("phone targets on the screen stay at least 44 px", () => {
  assert.ok(settings.includes("min-h-11 rounded-[10px] border border-dash-control"), "fields take the 44 px step");
  assert.ok(settings.includes("flex min-h-16 flex-1 flex-col"), "tabs take the 64 px step on a phone");
  assert.ok(card.includes("min-h-11 min-w-11 shrink-0"), "the switch target is at least 44 px");
  assert.ok(settings.includes('className="primary-action gap-2 text-[15px]"'), "the save action is the shared primary button");
  // The phone navigation is fixed, so the page keeps room under the last control.
  assert.match(read("src/styles/globals.css"), /\.work-main \{ padding-bottom: calc\(6rem \+ env\(safe-area-inset-bottom\)\); \}/);
});
