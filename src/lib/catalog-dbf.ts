import type { CatalogEntryInput } from "./catalog-parser";

const MAX_RECORDS = 1000000;
export const MAX_DBF_BYTES = 256 * 1024 * 1024;

interface Field { name: string; type: string; offset: number; length: number }
interface Table { bytes: Uint8Array; count: number; headerSize: number; recordSize: number; fields: Map<string, Field> }
export interface DbfCatalogResult {
  entries: CatalogEntryInput[];
  goodsRows: number;
  barcodeRows: number;
  deletedGoods: number;
  deletedBarcodes: number;
  duplicateBarcodes: number;
}

/** Only the known character-based dBASE III export is accepted. */
function table(buffer: ArrayBuffer, file: string, required: string[]): Table {
  if (buffer.byteLength < 33 || buffer.byteLength > MAX_DBF_BYTES) throw new Error(`${file}: некорректный размер DBF (максимум 256 МБ)`);
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  if (bytes[0] !== 0x03 || bytes[29] !== 0xc9) throw new Error(`${file}: ожидается DBF III в кодировке Windows-1251`);
  const count = view.getUint32(4, true), headerSize = view.getUint16(8, true), recordSize = view.getUint16(10, true);
  if (count > MAX_RECORDS || headerSize < 33 || headerSize > bytes.length || recordSize < 2 || headerSize + count * recordSize > bytes.length) {
    throw new Error(`${file}: повреждён или обрезан DBF`);
  }
  const fields = new Map<string, Field>();
  let offset = 1, cursor = 32;
  const ascii = new TextDecoder("ascii");
  while (cursor < headerSize && bytes[cursor] !== 0x0d) {
    if (cursor + 32 >= headerSize) throw new Error(`${file}: повреждён заголовок DBF`);
    const rawName = bytes.subarray(cursor, cursor + 11);
    const zero = rawName.indexOf(0);
    const name = ascii.decode(zero < 0 ? rawName : rawName.subarray(0, zero)).toUpperCase();
    const length = bytes[cursor + 16], type = String.fromCharCode(bytes[cursor + 11]);
    if (!name || !length || fields.has(name)) throw new Error(`${file}: некорректные поля DBF`);
    fields.set(name, { name, type, offset, length });
    offset += length; cursor += 32;
  }
  if (bytes[cursor] !== 0x0d || offset !== recordSize) throw new Error(`${file}: повреждён заголовок DBF`);
  for (const name of required) {
    const field = fields.get(name);
    if (!field || (name === "IDSET" ? !["N", "C"].includes(field.type) : field.type !== "C")) {
      throw new Error(`${file}: отсутствует или не поддерживается поле ${name}`);
    }
  }
  return { bytes, count, headerSize, recordSize, fields };
}

/** Join records by composite identity, never their physical row position. */
export function parseDbfCatalog(goodsBuffer: ArrayBuffer, barcodeBuffer: ArrayBuffer): DbfCatalogResult {
  const goods = table(goodsBuffer, "goods.dbf", ["ARTICUL", "IDSET", "NAME"]);
  const barcodes = table(barcodeBuffer, "barcode.dbf", ["ARTICUL", "IDSET", "BARCODE"]);
  const decoder = new TextDecoder("windows-1251", { fatal: true });
  const value = (source: Table, row: number, name: string) => {
    const field = source.fields.get(name)!;
    const start = source.headerSize + row * source.recordSize + field.offset;
    const raw = source.bytes.subarray(start, start + field.length);
    if (raw.includes(0x98)) throw new Error(`DBF, строка ${row + 1}: недопустимый символ Windows-1251`);
    return decoder.decode(raw).trim();
  };
  const deleted = (source: Table, row: number, file: string) => {
    const marker = source.bytes[source.headerSize + row * source.recordSize];
    if (marker !== 0x20 && marker !== 0x2a) throw new Error(`${file}, строка ${row + 1}: повреждена запись`);
    return marker === 0x2a;
  };
  const identity = (source: Table, row: number, file: string) => {
    const article = value(source, row, "ARTICUL"), idset = value(source, row, "IDSET");
    if (!article || !/^\d+$/.test(idset)) throw new Error(`${file}, строка ${row + 1}: некорректные ARTICUL или IDSET`);
    return JSON.stringify([article, idset]);
  };
  const names = new Map<string, string>(), entries = new Map<string, CatalogEntryInput>();
  const result: DbfCatalogResult = { entries: [], goodsRows: goods.count, barcodeRows: barcodes.count, deletedGoods: 0, deletedBarcodes: 0, duplicateBarcodes: 0 };
  for (let row = 0; row < goods.count; row++) {
    if (deleted(goods, row, "goods.dbf")) { result.deletedGoods++; continue; }
    const key = identity(goods, row, "goods.dbf"), name = value(goods, row, "NAME");
    if (!name || name.length > 500 || /[\u0000-\u001f]/.test(name)) throw new Error(`goods.dbf, строка ${row + 1}: некорректное название`);
    if (names.has(key) && names.get(key) !== name) throw new Error(`goods.dbf, строка ${row + 1}: разные названия для одного ARTICUL + IDSET`);
    names.set(key, name);
  }
  for (let row = 0; row < barcodes.count; row++) {
    if (deleted(barcodes, row, "barcode.dbf")) { result.deletedBarcodes++; continue; }
    const key = identity(barcodes, row, "barcode.dbf"), barcode = value(barcodes, row, "BARCODE"), name = names.get(key);
    if (!/^[0-9]{8,14}$/.test(barcode)) throw new Error(`barcode.dbf, строка ${row + 1}: штрих-код должен содержать 8–14 цифр`);
    if (!name) throw new Error(`barcode.dbf, строка ${row + 1}: товар отсутствует в goods.dbf. Выберите файлы одной выгрузки.`);
    const previous = entries.get(barcode);
    if (previous && previous.name !== name) throw new Error(`Штрих-код ${barcode} имеет разные названия`);
    if (previous) result.duplicateBarcodes++;
    entries.set(barcode, { barcode, name });
  }
  if (!entries.size) throw new Error("В паре DBF нет товаров для загрузки");
  result.entries = [...entries.values()];
  return result;
}
