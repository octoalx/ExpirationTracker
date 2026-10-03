import test from "node:test";
import assert from "node:assert/strict";
import { parseDbfCatalog } from "../src/lib/catalog-dbf";

type Field = [string, number, string?];
const goodsFields: Field[] = [["ARTICUL", 15], ["NAME", 200], ["IDSET", 8, "N"]];
const barcodeFields: Field[] = [["ARTICUL", 15], ["BARCODE", 26], ["IDSET", 8, "N"]];
const decoder = new TextDecoder("windows-1251");
const encoding = new Map(Array.from({ length: 256 }, (_, byte) => [decoder.decode(Uint8Array.of(byte)), byte]));
function dbf(fields: Field[], records: Array<Record<string, string> & { deleted?: string }>) {
  const header = 32 + 32 * fields.length + 1, size = 1 + fields.reduce((sum, field) => sum + field[1], 0);
  const buffer = new ArrayBuffer(header + records.length * size + 1), bytes = new Uint8Array(buffer), view = new DataView(buffer);
  bytes[0] = 3; bytes[29] = 0xc9;
  view.setUint32(4, records.length, true); view.setUint16(8, header, true); view.setUint16(10, size, true);
  fields.forEach(([name, width, type = "C"], index) => {
    bytes.set(new TextEncoder().encode(name), 32 + index * 32);
    bytes[32 + index * 32 + 11] = type.charCodeAt(0); bytes[32 + index * 32 + 16] = width;
  });
  bytes[header - 1] = 13;
  records.forEach((record, index) => {
    let offset = header + index * size; bytes[offset++] = record.deleted ? 42 : 32;
    for (const [name, width] of fields) {
      bytes.fill(32, offset, offset + width);
      const text = record[name] ?? "";
      const encoded = [...text].map(char => { const byte = encoding.get(char); if (byte === undefined) throw Error("Fixture encoding failed"); return byte; });
      bytes.set(encoded, offset); offset += width;
    }
  });
  bytes[bytes.length - 1] = 26;
  return buffer;
}
const item = { ARTICUL: "article-A", NAME: "Товар ёлка", IDSET: "1" };
const code = { ARTICUL: "article-A", BARCODE: "0123456789012", IDSET: "1" };
const parse = (goods: Array<Record<string, string>> = [item], barcodes: Array<Record<string, string>> = [code]) => parseDbfCatalog(dbf(goodsFields, goods), dbf(barcodeFields, barcodes));

test("DBF pair joins by article and set across reordered records and preserves text/cyrillic", () => {
  const result = parse([item, { ...item, IDSET: "2", NAME: "Второй товар" }], [{ ...code, IDSET: "2", BARCODE: "9876543210123" }, code]);
  assert.deepEqual(result.entries, [{ barcode: "9876543210123", name: "Второй товар" }, { barcode: "0123456789012", name: "Товар ёлка" }]);
  assert.equal(result.goodsRows, 2); assert.equal(result.barcodeRows, 2);
});

test("DBF pair skips deleted rows and collapses only identical barcode duplicates", () => {
  const result = parse([item, { ...item, deleted: "yes" }], [code, code, { ...code, deleted: "yes" }]);
  assert.equal(result.entries.length, 1); assert.equal(result.deletedGoods, 1); assert.equal(result.deletedBarcodes, 1); assert.equal(result.duplicateBarcodes, 1);
});

test("DBF pair rejects mismatched keys and ambiguous names before returning entries", () => {
  assert.throws(() => parse([item], [{ ...code, IDSET: "2" }]), /одной выгрузки/);
  assert.throws(() => parse([item, { ...item, NAME: "Conflict" }]), /разные названия/);
  assert.throws(() => parse([item, { ...item, ARTICUL: "article-B", NAME: "Другой" }], [code, { ...code, ARTICUL: "article-B" }]), /разные названия/);
  assert.throws(() => parse([{ ...item, NAME: "" }]), /название/);
  assert.throws(() => parse([item], [{ ...code, BARCODE: "article-A" }]), /8–14/);
});

test("DBF validates required columns, header integrity, versions, encoding and row markers", () => {
  const good = dbf(goodsFields, [item]), bar = dbf(barcodeFields, [code]);
  assert.throws(() => parseDbfCatalog(good.slice(0, -10), bar), /обрезан/);
  assert.throws(() => parseDbfCatalog(dbf([["ARTICUL", 15], ["NAME", 200]], [item]), bar), /IDSET/);
  const wrongVersion = good.slice(0); new Uint8Array(wrongVersion)[0] = 0x30;
  assert.throws(() => parseDbfCatalog(wrongVersion, bar), /DBF III/);
  const wrongEncoding = good.slice(0); new Uint8Array(wrongEncoding)[29] = 0;
  assert.throws(() => parseDbfCatalog(wrongEncoding, bar), /Windows-1251/);
  const wrongMarker = good.slice(0); const header = new DataView(wrongMarker).getUint16(8, true); new Uint8Array(wrongMarker)[header] = 0;
  assert.throws(() => parseDbfCatalog(wrongMarker, bar), /повреждена запись/);
  const badText = good.slice(0); new Uint8Array(badText)[header + 16] = 0x98;
  assert.throws(() => parseDbfCatalog(badText, bar), /недопустимый символ/);
  assert.throws(() => parse([], []), /нет товаров/);
});
