export interface CatalogEntryInput {
  barcode: string;
  name: string;
}

/** Decode legacy exports without corrupting Cyrillic product names. */
export function decodeProductText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1251").decode(buffer);
  }
}

/** Parse quoted semicolon-separated records, including escaped quotes. */
function csvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === ";") {
      row.push(value); value = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(cell => cell.trim())) records.push(row);
      row = []; value = "";
    } else value += char;
  }
  if (quoted) throw new Error("Незакрытая кавычка в CSV");
  row.push(value);
  if (row.some(cell => cell.trim())) records.push(row);
  return records;
}

export function validateCatalogEntries(input: unknown): CatalogEntryInput[] {
  if (!Array.isArray(input) || !input.length || input.length > 10000) {
    throw new Error("Каталог должен содержать от 1 до 10000 товаров");
  }
  const entries = new Map<string, CatalogEntryInput>();
  for (const [index, raw] of input.entries()) {
    if (!raw || typeof raw.barcode !== "string" || typeof raw.name !== "string") {
      throw new Error(`Строка ${index + 1}: некорректные поля`);
    }
    const barcode = raw.barcode.trim(), name = raw.name.trim();
    if (!/^\d{8,14}$/.test(barcode) || !name || name.length > 500) {
      throw new Error(`Строка ${index + 1}: проверьте штрих-код и название`);
    }
    const existing = entries.get(barcode);
    if (existing && existing.name !== name) {
      throw new Error(`Штрих-код ${barcode} имеет разные названия`);
    }
    entries.set(barcode, { barcode, name });
  }
  return [...entries.values()];
}

export function parseCatalogCsv(text: string): CatalogEntryInput[] {
  const [header, ...rows] = csvRecords(text.replace(/^\uFEFF/, ""));
  const barcodeColumn = header?.findIndex(cell => cell.trim().toLowerCase().startsWith("штрих-код"));
  const nameColumn = header?.findIndex(cell => cell.trim().toLowerCase() === "наименование товара");
  if (barcodeColumn === undefined || barcodeColumn < 0 || nameColumn === undefined || nameColumn < 0) {
    throw new Error("Нужны колонки «Штрих-код» и «Наименование товара»");
  }
  // The supplied export ends with an empty barcode and a numeric row total.
  const last = rows.at(-1);
  if (last && !last[barcodeColumn]?.trim() && /^\d+$/.test(last[nameColumn]?.trim() ?? "") && Number(last[nameColumn]) === rows.length - 1) rows.pop();
  return validateCatalogEntries(rows.map(row => ({ barcode: row[barcodeColumn], name: row[nameColumn] })));
}
