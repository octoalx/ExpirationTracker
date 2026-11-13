import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateExpiryDate } from "../src/lib/shelf-life";
import { fieldError, validateProductForm, type ProductFormValues } from "../src/lib/product-form";

const base: ProductFormValues = {
  barcode: "4601234567890",
  name: "Герметик силиконовый",
  mode: "expiry",
  manufacturingDate: "",
  shelfLife: "",
  shelfLifeUnit: "months",
  quantity: "",
};

const valid = (patch: Partial<ProductFormValues> = {}): ProductFormValues => ({ ...base, ...patch });

const fields = (values: ProductFormValues) => validateProductForm(values).map((error) => error.field);

test("a complete product passes the shared field check", () => {
  assert.deepEqual(validateProductForm(valid()), []);
  assert.deepEqual(validateProductForm(valid({ quantity: "3" })), []);
  assert.deepEqual(validateProductForm(valid({ mode: "manufacture", manufacturingDate: "2026-11-01", shelfLife: "3" })), []);
});

test("the barcode rule matches the API: 8–14 digits, no spaces or letters", () => {
  assert.deepEqual(fields(valid({ barcode: "" })), ["barcode"]);
  assert.deepEqual(fields(valid({ barcode: "   " })), ["barcode"]);
  assert.deepEqual(fields(valid({ barcode: "4601234" })), ["barcode"], "seven digits is too short");
  assert.deepEqual(fields(valid({ barcode: "460123456789012" })), ["barcode"], "fifteen digits is too long");
  assert.deepEqual(fields(valid({ barcode: "46012 34567890" })), ["barcode"], "a space is not a digit");
  assert.deepEqual(fields(valid({ barcode: "4601234567890" })), []);
});

test("a product without a name is refused under the name field", () => {
  assert.deepEqual(fields(valid({ name: "" })), ["name"]);
  assert.deepEqual(fields(valid({ name: "   " })), ["name"]);
});

test("the manufacture route refuses a missing date, a missing term and a non-positive term", () => {
  assert.deepEqual(fields(valid({ mode: "manufacture", shelfLife: "3" })), ["manufacture"]);
  assert.deepEqual(fields(valid({ mode: "manufacture", manufacturingDate: "2026-11-01" })), ["shelfLife"]);
  for (const shelfLife of ["0", "-2", "1.5", "шесть"]) {
    assert.deepEqual(fields(valid({ mode: "manufacture", manufacturingDate: "2026-11-01", shelfLife })), ["shelfLife"], `term ${shelfLife}`);
  }
});

test("the calculated expiry for 01.11.2026 plus three months is 01.02.2027", () => {
  assert.equal(calculateExpiryDate("2026-11-01", "3", "months"), "2027-02-01");
  assert.equal(fieldError(validateProductForm(valid({ mode: "manufacture", manufacturingDate: "2026-11-01", shelfLife: "3" })), "shelfLife"), "");
});

test("month end keeps calendar arithmetic in the manufacture route", () => {
  // A 31-day month plus one month lands on the last day of the next month, not on the 3rd of March.
  assert.equal(calculateExpiryDate("2027-01-31", "1", "months"), "2027-02-28");
  assert.deepEqual(validateProductForm(valid({ mode: "manufacture", manufacturingDate: "2027-01-31", shelfLife: "1" })), []);
});

test("quantity is optional but must be a positive whole number when given", () => {
  assert.deepEqual(fields(valid({ quantity: "" })), []);
  assert.deepEqual(fields(valid({ quantity: "0" })), ["quantity"]);
  assert.deepEqual(fields(valid({ quantity: "-1" })), ["quantity"]);
  assert.deepEqual(fields(valid({ quantity: "2.5" })), ["quantity"]);
  assert.deepEqual(fields(valid({ quantity: "12" })), []);
});

test("every reported error carries a Russian message the dialog can print", () => {
  const errors = validateProductForm(valid({ barcode: "", name: "", quantity: "0" }));
  assert.deepEqual(errors.map((error) => error.field), ["barcode", "name", "quantity"]);
  for (const error of errors) {
    assert.match(error.message, /[А-Яа-яЁё]/, `message for ${error.field} is Russian`);
    assert.ok(!/[\u0000-\u001f]/.test(error.message));
  }
});

/* ── Dialogs: structure the browser pass checks by eye ── */

const read = (path: string) => readFileSync(path, "utf8");
const addForm = read("src/components/AddProductForm.tsx");
const editForm = read("src/components/EditProductForm.tsx");
const importModal = read("src/components/ImportExcelModal.tsx");
const dashboard = read("src/pages/dashboard.tsx");

const order = (source: string, markers: string[]) => markers.map((marker) => {
  const index = source.indexOf(marker);
  assert.ok(index >= 0, `${marker} is present`);
  return index;
});

const sorted = (source: string, markers: string[]) => {
  const positions = order(source, markers);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `${markers.join(" → ")} stay in this order`);
};

test("both dialogs order the fields like the scanner flow: code, name, route, dates, quantity", () => {
  sorted(addForm, ['id="add-barcode"', 'id="add-name"', 'role="group" aria-label="Способ указания срока"', 'id="add-manufacture"', 'id="add-quantity"']);
  sorted(editForm, ['id="edit-barcode"', 'id="edit-name"', 'role="group" aria-label="Способ указания срока"', 'id="edit-manufacture"', 'id="edit-quantity"']);
});

test("the add dialog no longer hides fields behind nested disclosures", () => {
  assert.ok(!addForm.includes("<details"), "no <details> inside the add form");
  assert.ok(!dashboard.includes("<details"), "no <details> inside the dashboard dialogs");
});

test("the camera entry point exists on the phone only", () => {
  assert.match(addForm, /\{!isDesktop && <button type="button" aria-label="Сканировать штрих-код"/);
  assert.ok(!editForm.includes("BarcodeCamera"), "the edit dialog never opens the camera");
});

test("the calculated expiry is shown before saving and follows the typed date and term", () => {
  for (const source of [addForm, editForm]) {
    assert.ok(source.includes('className="expiry-preview"'), "the preview block is rendered");
    assert.ok(source.includes('aria-live="polite"'), "the preview announces the recalculated date");
    assert.ok(source.includes("calculateExpiryDate(manufacturingDate, shelfLife, shelfLifeUnit)"));
  }
});

test("field errors sit under their field and are wired with aria-describedby", () => {
  for (const [source, prefix] of [[addForm, "add"], [editForm, "edit"]] as const) {
    for (const field of ["barcode", "name", "quantity"]) {
      // The barcode field always points at a note, so its description is either the
      // error or the short format hint; the other fields point at the message alone.
      const describedBy = source.includes(`aria-describedby={${field}Error ? "${prefix}-${field}-error" : "${prefix}-${field}-hint"}`)
        || source.includes(`aria-describedby={${field}Error ? "${prefix}-${field}-error" : undefined}`);
      assert.ok(describedBy, `${prefix}: ${field} describedby`);
      assert.ok(source.includes(`<p id="${prefix}-${field}-error" className="field-error">`), `${prefix}: ${field} message`);
    }
    assert.ok(source.includes('aria-invalid={'), "invalid fields are marked for assistive tech");
  }
});

test("a refused save is reported inside the dialog instead of a toast", () => {
  for (const source of [addForm, editForm]) {
    assert.ok(source.includes('role="alert"'), "the dialog carries the server message");
    assert.ok(source.includes("setServerError("), "the server message is kept in dialog state");
    assert.ok(!source.includes("toast.error"), "no error toast covers the dialog");
  }
});

test("both dialogs pin their actions in one block with Сохранить and Отмена", () => {
  for (const source of [addForm, editForm]) {
    assert.ok(source.includes('className="product-dialog-actions"'), "one action block");
    assert.ok(source.includes('className="dialog-action-secondary"'), "a secondary button");
    assert.ok(source.includes('className="primary-action dialog-action-primary"'), "a primary button");
  }
});

test("Excel import is one button in the page header, next to Добавить", () => {
  const header = dashboard.slice(dashboard.indexOf("<header"), dashboard.indexOf("</header>"));
  assert.ok(header.includes("Импорт из Excel"), "the header names the import");
  assert.ok(header.includes("setIsImportOpen(true)"), "the header opens the import dialog");
  assert.ok(header.includes("<span>Добавить</span>"), "Добавить sits in the same header");
  assert.ok(!dashboard.includes("Добавить несколько товаров из файла"), "the nesting wrapper is gone");
});

test("the import dialog shows found rows and error rows before the import button", () => {
  const preview = importModal.slice(importModal.indexOf('state === "previewing"'), importModal.indexOf('state === "uploading"'));
  assert.ok(preview.includes("Найдено строк:"), "found rows are counted");
  assert.ok(preview.includes("Строк с ошибкой:"), "error rows are counted");
  assert.ok(!preview.includes("toast"), "the preview does not depend on toasts");
  const importButton = importModal.indexOf("Импортировать {foundCount} товаров");
  assert.ok(importButton > -1 && importButton > importModal.indexOf("Найдено строк:") - 1, "counts precede the import button");
});
