import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(path, "utf8");

const page = read("src/pages/admin/index.tsx");
const users = read("src/components/admin/UsersTab.tsx");
const departments = read("src/components/admin/DepartmentsTab.tsx");
const logs = read("src/components/admin/LogsTab.tsx");
const backup = read("src/components/admin/BackupTab.tsx");
const telegram = read("src/components/admin/TelegramStatus.tsx");
const catalog = read("src/components/CatalogImport.tsx");
const labels = read("src/lib/admin-labels.ts");
const confirm = read("src/components/admin/ConfirmAction.tsx");

const ADMIN_SOURCES: ReadonlyArray<[string, string]> = [
  ["index.tsx", page],
  ["UsersTab.tsx", users],
  ["DepartmentsTab.tsx", departments],
  ["LogsTab.tsx", logs],
  ["BackupTab.tsx", backup],
  ["TelegramStatus.tsx", telegram],
  ["CatalogImport.tsx", catalog],
  ["ConfirmAction.tsx", confirm],
];

test("the admin panel takes the same shell as the other redesigned screens", () => {
  assert.ok(page.includes("inventory-page admin-workspace mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5"),
    "the admin page uses the dashboard container width and gaps");
  assert.ok(page.includes('className="work-page-title"'), "the page heading uses the shared title style");
  for (const [name, source] of ADMIN_SOURCES) {
    assert.equal(/(text|bg|border|from|to)-(slate|blue|red|rose|amber|emerald|orange|gray|zinc)-\d{2,3}/.test(source), false,
      `${name} keeps no legacy colour utility`);
    assert.equal(source.includes("dark:"), false, `${name} adds no dark variant`);
    assert.equal(source.includes("work-surface"), false, `${name} keeps no old surface`);
  }
  assert.ok(page.includes("rounded-xl border border-dash-line bg-dash-panel") || page.includes("bg-dash-panel"),
    "the panel uses the dash surface");
});

test("the six tabs are one strip with icons and the accent underline", () => {
  assert.equal((page.match(/role="tablist"/g) ?? []).length, 1, "the tabs are a single strip");
  assert.equal((page.match(/role="tab"/g) ?? []).length, 1, "the tab button is rendered once, in the map");
  for (const label of ["Пользователи", "Отделы", "Журнал", "Каталог", "Копии данных", "Telegram"]) {
    assert.ok(page.includes(`label: "${label}"`), `the tab is kept: ${label}`);
  }
  assert.equal((page.match(/label: "/g) ?? []).length, 6, "there are exactly six tabs");
  assert.ok(page.includes("grid-cols-3 gap-1 sm:grid-cols-6"), "two rows of three on a phone, one row on a desktop");
  assert.ok(page.includes("min-h-16 flex-col items-center justify-center gap-1 px-1 py-2"),
    "tabs keep a 64 px phone target");
  assert.ok(page.includes("absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-dash-accent"),
    "the active tab is marked by the dashboard accent underline");
  // Rights and hash navigation stay untouched.
  assert.ok(page.includes('if (session?.user?.role !== "ADMIN")'), "the access check is unchanged");
  assert.ok(page.includes("Нет доступа") && page.includes("Этот раздел доступен администратору."),
    "the no-access wording is kept");
  assert.ok(page.includes("window.location.hash") && page.includes("router.replace({ hash: id }"),
    "the hash tab navigation is kept");
});

test("roles and actions read in Russian, the database keeps its codes", () => {
  assert.ok(labels.includes('USER: "Сотрудник"') && labels.includes('ADMIN: "Администратор"'),
    "one dictionary maps both roles");
  assert.ok(users.includes("roleLabel(user.role)") || users.includes("roleLabel(role)"),
    "the role pill goes through the dictionary");
  assert.equal(/>\s*\{user\.role\}/.test(users), false, "the raw role code is never printed");
  for (const legacy of ["Сделать USER", "Сделать ADMIN", "Сделать пользователем"]) {
    assert.equal(users.includes(legacy), false, `the English action is gone: ${legacy}`);
  }
  assert.ok(users.includes("Снять права администратора") && users.includes("Назначить администратором"),
    "the role action reads in Russian");
  assert.ok(users.includes("Администраторов: ") || users.includes("Администраторов:"), "the summary count reads in Russian");
  // The codes survive only as protocol values.
  assert.ok(users.includes('value="USER"') && users.includes('value="ADMIN"'), "the form still posts the role codes");
});

test("the Issue Log page and its components are gone, the logs tab stays", () => {
  assert.equal(existsSync("src/pages/admin/issues.tsx"), false, "the route file is removed");
  assert.equal(existsSync("src/components/admin/issues"), false, "the issue components are removed");
  assert.equal(existsSync(join("src", "pages", "admin", "issues.tsx")), false, "no issues page anywhere in the admin folder");
  assert.deepEqual(readdirSync("src/pages/admin"), ["index.tsx"], "the admin folder holds the panel only");
  assert.equal(existsSync("src/pages/api/admin/issues.ts"), true, "the API route is untouched");
  assert.ok(logs.includes("/api/admin/logs"), "the Журнал tab reads the log API");
});

test("every irreversible admin action asks in the app dialog, not in a browser window", () => {
  for (const [name, source] of ADMIN_SOURCES) {
    assert.equal(/window\.(confirm|prompt|alert)\s*\(/.test(source), false, `${name} uses no browser dialog`);
    assert.equal(/(^|[^.\w])(confirm|prompt|alert)\s*\(/.test(source), false, `${name} calls no bare browser dialog`);
  }
  for (const [name, source] of [["UsersTab.tsx", users], ["DepartmentsTab.tsx", departments],
    ["LogsTab.tsx", logs], ["BackupTab.tsx", backup], ["TelegramStatus.tsx", telegram]] as const) {
    assert.ok(source.includes("ConfirmAction"), `${name} asks through the shared confirm dialog`);
  }
  assert.ok(deleteCount(users) >= 1, "deleting an account is confirmed");
  assert.ok(deleteCount(departments) >= 1, "deleting a department is confirmed");
  assert.ok(logs.includes('title="Очистить журнал?"'), "clearing the log is confirmed");
  assert.equal((backup.match(/<ConfirmAction/g) ?? []).length, 2, "restoring and deleting a copy are both confirmed");
  assert.ok(backup.includes('confirmLabel="Восстановить"') && backup.includes('confirmLabel="Удалить копию"'),
    "both copy actions keep their own wording");
  assert.equal((telegram.match(/<ConfirmAction/g) ?? []).length, 1, "stopping and resuming Telegram share one confirm dialog");
  assert.ok(confirm.includes('role="dialog"') || confirm.includes("<Dialog"), "the confirm is a real dialog");
});

function deleteCount(source: string): number {
  return (source.match(/<ConfirmAction/g) ?? []).length;
}

test("the catalog save button is the main blue action, red stays for danger", () => {
  assert.ok(catalog.includes('className="primary-action gap-2 text-[15px]"'), "«Сохранить каталог» is the primary action");
  const emerald = /(bg|text|border)-emerald-\d{2,3}/;
  assert.equal(emerald.test(catalog), false, "the green button is gone");
  assert.ok(catalog.includes("Сохранить каталог"), "the wording is kept");
  assert.ok(catalog.includes("не больше 256 МБ"), "the DBF size error replaces the CSV one");
  // Red is only on destructive controls.
  assert.equal((users.match(/\bbg-dash-expired(?!-soft)/g) ?? []).length, 0, "no red fills in the accounts tab");
  assert.ok(confirm.includes("bg-dash-expired"), "the irreversible confirm carries the red fill");
});

test("the phone keeps 44 px targets and the accounts table becomes cards", () => {
  assert.ok(users.includes('className="space-y-3 md:hidden"'), "the accounts tab keeps its phone cards");
  assert.ok(users.includes('hidden overflow-hidden rounded-xl border border-dash-line bg-dash-panel md:block'),
    "the desktop table is hidden on a phone");
  for (const [name, source] of ADMIN_SOURCES) {
    // The old 32 px shared buttons and hand-made small heights are gone; targets come from the action classes.
    assert.equal(/<Button\b/.test(source), false, `${name} no longer uses the 32 px shared button`);
    assert.equal(/className="[^"]*\bh-(6|7|8)\b/.test(source), false, `${name} hardcodes no sub-44 px height`);
    for (const match of source.match(/const ICON_ACTION =[\s\S]*?;/g) ?? []) {
      assert.ok(match.includes("size-11"), `${name} keeps its icon buttons at 44 px`);
    }
  }
  assert.ok((users.match(/min-h-11/g) ?? []).length >= 2, "the accounts controls keep at least a 44 px target");
});
