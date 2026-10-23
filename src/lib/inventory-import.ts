export interface InventoryProduct {
  barcode: string;
  name: string;
  quantity: number | null;
  expiryDate: string | null;
}

interface CalendarDate {
  date: Date;
  day: number;
  month: number;
  year: number;
}

/**
 * Parses a DD.MM.YYYY calendar date in UTC and rejects impossible days.
 * Date-only arithmetic in UTC avoids host timezone and DST shifts.
 */
function parseCalendarDate(date: string, message: string): CalendarDate {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(date);
  if (!match) throw new Error(`${message}: ${date}`);
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText), month = Number(monthText), year = Number(yearText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${message}: ${date}`);
  }
  return { date: parsed, day, month, year };
}

/**
 * A source date without a shelf life is the final expiry date itself.
 * Used by the simple Excel table, where an empty months cell means "expires on".
 */
export function finalExpiryDate(date: string): string {
  return parseCalendarDate(date, "Некорректная дата").date.toISOString().slice(0, 10);
}

/** Date-only arithmetic in UTC avoids host timezone and DST shifts. */
export function expiryFromManufacture(date: string, months: number | null): string | null {
  const { day, month, year } = parseCalendarDate(date, "Некорректная дата производства");
  if (months === null) return null;
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

/**
 * Quantities merge only when both sides carry one. An empty quantity means
 * "unknown", so summing it with a number would invent data the import has no
 * evidence for; the existing value is then left untouched.
 */
export function mergedQuantity(existing: number | null, incoming: number | null): number | null {
  if (existing === null || incoming === null) return existing;
  return existing + incoming;
}

/** A row the import refuses, with the 1-based position in the submitted list. */
export interface RejectedInventoryProduct {
  position: number;
  message: string;
}

/**
 * Validates one submitted row.
 * Returns the normalised product, or the reason it cannot be imported.
 */
function validateInventoryProduct(raw: unknown, position: number): InventoryProduct | string {
  if (!raw || typeof raw !== "object" ||
    typeof (raw as Record<string, unknown>).name !== "string" || !(raw as { name: string }).name.trim() ||
    (raw as { name: string }).name.length > 500 ||
    typeof (raw as Record<string, unknown>).barcode !== "string" || !(raw as { barcode: string }).barcode.trim() ||
    (raw as { barcode: string }).barcode.length > 100) {
    return `Строка ${position}: некорректное название или штрих-код`;
  }
  const { name, barcode } = raw as { name: string; barcode: string };
  const value = raw as { quantity?: unknown; expiryDate?: unknown };
  const quantity = value.quantity ?? null;
  if (quantity !== null && (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0)) {
    return `Строка ${position}: некорректное количество`;
  }
  const expiryDate = value.expiryDate ?? null;
  if (expiryDate !== null && (typeof expiryDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ||
    !Number.isFinite(Date.parse(expiryDate)) || new Date(expiryDate).toISOString().slice(0, 10) !== expiryDate)) {
    return `Строка ${position}: некорректная дата годности`;
  }
  return {
    barcode: barcode.trim(),
    name: name.trim(),
    quantity: quantity as number | null,
    expiryDate: expiryDate as string | null,
  };
}

/**
 * Validates a submitted batch row by row.
 *
 * A broken row is skipped with its reason instead of cancelling the batch: one
 * mistyped date must not cost the manager the whole delivery note. Only the
 * payload itself (not a list, empty, too large) is rejected as a whole.
 */
export function partitionInventoryProducts(input: unknown): {
  products: InventoryProduct[];
  rejected: RejectedInventoryProduct[];
} {
  if (!Array.isArray(input) || !input.length || input.length > 10000) throw new Error("Нужны от 1 до 10000 товаров");
  const products: InventoryProduct[] = [];
  const rejected: RejectedInventoryProduct[] = [];
  for (const [index, raw] of input.entries()) {
    const result = validateInventoryProduct(raw, index + 1);
    if (typeof result === "string") rejected.push({ position: index + 1, message: result });
    else products.push(result);
  }
  return { products, rejected };
}

/**
 * Validates a submitted batch, failing as a whole on the first bad row.
 * Kept for callers that must reject the entire batch.
 */
export function validateInventoryProducts(input: unknown): InventoryProduct[] {
  const { products, rejected } = partitionInventoryProducts(input);
  if (rejected.length) throw new Error(rejected[0].message);
  return products;
}
