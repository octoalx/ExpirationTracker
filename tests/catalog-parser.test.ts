import test from "node:test";
import assert from "node:assert/strict";
import { decodeProductText, parseCatalogCsv, validateCatalogEntries } from "../src/lib/catalog-parser";

test("catalog import preserves leading zeroes and quoted names", () => {
  assert.deepEqual(parseCatalogCsv('\uFEFFШтрих-код осн.;Наименование товара\r\n0123456789012;"Герметик; белый ""A"""\r\n'),
    [{ barcode: "0123456789012", name: 'Герметик; белый "A"' }]);
});

test("UTF-8 and Windows-1251 decode without losing Cyrillic", () => {
  assert.equal(decodeProductText(new TextEncoder().encode("Товар").buffer), "Товар");
  assert.equal(decodeProductText(Uint8Array.from([0xd2, 0xee, 0xe2, 0xe0, 0xf0]).buffer), "Товар");
});

test("duplicate conflicts and invalid rows reject the whole catalog", () => {
  assert.throws(() => validateCatalogEntries([{ barcode: "12345678", name: "A" }, { barcode: "12345678", name: "B" }]), /разные названия/);
  assert.throws(() => validateCatalogEntries([{ barcode: 12345678, name: "A" }]), /некорректные поля/);
  assert.throws(() => parseCatalogCsv('Штрих-код;Наименование товара\n12345678;"A'), /кавычка/);
  assert.throws(() => parseCatalogCsv('Штрих-код;Наименование товара\n;A'), /проверьте/);
  assert.throws(() => validateCatalogEntries([]));
});

test("identical repeated catalog entries are idempotent", () => {
  const entry = { barcode: "12345678", name: "A" };
  assert.deepEqual(validateCatalogEntries([entry, entry]), [entry]);
});

test("export footer count is ignored only when it matches the row total", () => {
  assert.equal(parseCatalogCsv("Штрих-код;Наименование товара\n12345678;A\n;1").length, 1);
  assert.throws(() => parseCatalogCsv("Штрих-код;Наименование товара\n12345678;A\n;2"));
});
