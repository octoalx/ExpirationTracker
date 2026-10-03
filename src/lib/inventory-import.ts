export interface InventoryProduct {
  barcode: string;
  name: string;
  quantity: number | null;
  expiryDate: string | null;
}

/** With months, the source is a manufacture date; otherwise it is final expiry. UTC avoids timezone shifts. */
export function expiryFromManufacture(date: string, months: number | null): string {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(date);
  if (!match) throw new Error(`Некорректная дата производства: ${date}`);
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText), month = Number(monthText), year = Number(yearText);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) {
    throw new Error(`Некорректная дата производства: ${date}`);
  }
  if (months === null) return start.toISOString().slice(0, 10);
  if (!Number.isInteger(months) || months <= 0 || months > 1200) throw new Error("Некорректный срок хранения в месяцах");
  const end = new Date(Date.UTC(year, month - 1 + months + 1, 0));
  end.setUTCDate(Math.min(day, end.getUTCDate()));
  return end.toISOString().slice(0, 10);
}

export function parseLegacyInventory(text: string) {
  const products: InventoryProduct[] = [];
  let excluded = 0, missingShelfLife = 0;
  for (const [index, line] of text.replace(/^\uFEFF/, "").split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const fields = line.split("\t").map(value => value.trim());
    if (fields[2]?.toUpperCase() === "OLD") { excluded++; continue; }
    if (fields.length !== 5 || !/^\d{8,14}$/.test(fields[0]) || !fields[1] || fields[2]) {
      throw new Error(`Строка ${index + 1}: некорректный формат`);
    }
    if (fields[4] && !/^\d+$/.test(fields[4])) throw new Error(`Строка ${index + 1}: некорректный срок хранения`);
    const months = fields[4] ? Number(fields[4]) : null;
    const expiryDate = expiryFromManufacture(fields[3], months);
    if (months === null) missingShelfLife++;
    products.push({ barcode: fields[0], name: fields[1], quantity: null, expiryDate });
  }
  if (!products.length) throw new Error("Нет товаров для импорта после исключения OLD");
  return { products, excluded, missingShelfLife };
}

/** Validate the entire payload before issuing any database writes. */
export function validateInventoryProducts(input: unknown): InventoryProduct[] {
  if (!Array.isArray(input) || !input.length || input.length > 10000) throw new Error("Нужны от 1 до 10000 товаров");
  return input.map((raw, index) => {
    if (!raw || typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 500 ||
      typeof raw.barcode !== "string" || !raw.barcode.trim() || raw.barcode.length > 100) {
      throw new Error(`Строка ${index + 1}: некорректное название или штрих-код`);
    }
    const quantity = raw.quantity ?? null;
    if (quantity !== null && (!Number.isInteger(quantity) || quantity <= 0)) throw new Error(`Строка ${index + 1}: некорректное количество`);
    const expiryDate = raw.expiryDate ?? null;
    if (expiryDate !== null && (typeof expiryDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ||
      !Number.isFinite(Date.parse(expiryDate)) || new Date(expiryDate).toISOString().slice(0, 10) !== expiryDate)) {
      throw new Error(`Строка ${index + 1}: некорректная дата годности`);
    }
    return { barcode: raw.barcode.trim(), name: raw.name.trim(), quantity, expiryDate };
  });
}
