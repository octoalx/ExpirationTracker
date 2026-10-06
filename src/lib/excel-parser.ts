import * as XLSX from "xlsx";
import { expiryFromManufacture } from "./inventory-import";

export interface ParsedProduct {
  barcode: string;
  name: string;
  quantity: number | null;
  expiryDate?: string | null;
}

export type ExcelFileType = "inventory" | "catalog" | "simple";

export interface ParseResult {
  fileType: ExcelFileType;
  products: ParsedProduct[];
  errors: string[];
}

/**
 * Detects the Excel file type by inspecting cell contents and headers.
 *
 * - `"inventory"` — cell A1..A5 contains "Инвентаризационная опись"
 * - `"catalog"` — row 1 has headers "Штрих-код" or "Наименование товара"
 */
function detectFileType(ws: XLSX.WorkSheet): ExcelFileType | null {
  // Inventory type: first rows contain "Инвентаризационная опись"
  for (let r = 0; r < 5; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell && typeof cell.v === "string" && cell.v.includes("Инвентаризационная опись")) {
      return "inventory";
    }
  }

  // Also check for header row with "Артикул" + "Наименование" (typical for inventory)
  for (let r = 15; r < 22; r++) {
    const artCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
    if (
      artCell && typeof artCell.v === "string" && artCell.v.includes("Артикул") &&
      nameCell && typeof nameCell.v === "string" && nameCell.v.includes("Наименование")
    ) {
      return "inventory";
    }
  }

  // A compact table uses fixed columns and arbitrary header labels.
  const header = [0, 1, 2].map(c => ws[XLSX.utils.encode_cell({ r: 0, c })]?.v);
  const rangeForSimple = XLSX.utils.decode_range(ws["!ref"] || "A1");
  if (rangeForSimple.e.c <= 3 && header.every(value => typeof value === "string" && value.trim()) &&
      String(header[2]).trim().toLowerCase() !== "доступно") {
    return "simple";
  }

  // Catalog type: row 1 has "Штрих-код" or "Наименование товара"
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let c = range.s.c; c <= Math.min(range.e.c, 40); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell && typeof cell.v === "string") {
      if (cell.v.includes("Штрих-код") || cell.v.includes("Наименование товара")) {
        return "catalog";
      }
    }
  }

  return null;
}

/**
 * Parses an "Inventory" type Excel file.
 * Locates the header row containing "Артикул"/"Наименование"; data starts on the next row.
 * Columns: B = barcode, C = product name, D = quantity.
 */
function parseInventory(ws: XLSX.WorkSheet): { products: ParsedProduct[]; errors: string[] } {
  const products: ParsedProduct[] = [];
  const errors: string[] = [];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  // Find header row (contains "Артикул" in column B)
  let headerRow = 17; // default: row 18 (0-indexed)
  for (let r = 10; r < 25; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cell && typeof cell.v === "string" && cell.v.includes("Артикул")) {
      headerRow = r;
      break;
    }
  }
  const DATA_START_ROW = headerRow + 1;

  for (let r = DATA_START_ROW; r <= range.e.r; r++) {
    const barcodeCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
    const qtyCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];

    const barcode = barcodeCell ? String(barcodeCell.v).trim() : "";
    const name = nameCell ? String(nameCell.v).trim() : "";

    // Skip empty rows and "Всего" (totals) rows
    if (!barcode || !name) continue;
    if (name.toLowerCase().startsWith("всего")) continue;

    let quantity: number | null = null;
    if (qtyCell && qtyCell.v !== undefined && qtyCell.v !== "") {
      const parsed = Number(qtyCell.v);
      if (!isNaN(parsed) && parsed > 0) {
        quantity = Math.round(parsed);
      }
    }

    products.push({ barcode, name, quantity });
  }

  return { products, errors };
}

/**
 * Parses a "Product Catalog" type Excel file.
 * Row 1 = headers, data starts at row 2.
 * Default columns: D = barcode, F = product name, I = available quantity.
 */
function parseCatalog(ws: XLSX.WorkSheet): { products: ParsedProduct[]; errors: string[] } {
  const products: ParsedProduct[] = [];
  const errors: string[] = [];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  // Default column indices (overridden by header detection below)
  let barcodeCol = 3;  // D (0-indexed)
  let nameCol = 5;     // F (0-indexed)
  let qtyCol = 8;      // I (0-indexed)

  // Detect columns by header text
  for (let c = range.s.c; c <= Math.min(range.e.c, 40); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell && typeof cell.v === "string") {
      const val = cell.v.trim().toLowerCase();
      if (val.startsWith("штрих-код")) barcodeCol = c;
      else if (val === "наименование товара") nameCol = c;
      else if (val === "доступно") qtyCol = c;
    }
  }

  for (let r = 1; r <= range.e.r; r++) {
    const barcodeCell = ws[XLSX.utils.encode_cell({ r, c: barcodeCol })];
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: nameCol })];
    const qtyCell = ws[XLSX.utils.encode_cell({ r, c: qtyCol })];

    const barcode = barcodeCell ? String(barcodeCell.v).trim() : "";
    const name = nameCell ? String(nameCell.v).trim() : "";

    if (!barcode || !name) continue;

    let quantity: number | null = null;
    if (qtyCell && qtyCell.v !== undefined && qtyCell.v !== "") {
      const parsed = Number(qtyCell.v);
      if (!isNaN(parsed) && parsed > 0) {
        quantity = Math.round(parsed);
      }
    }

    products.push({ barcode, name, quantity });
  }

  return { products, errors };
}

/**
 * Main entry point: accepts an Excel file buffer, detects file type, and parses product data.
 *
 * @param buffer - Raw Excel file buffer.
 * @returns Parsed products, detected file type, and any parsing errors.
 */
function parseSimple(ws: XLSX.WorkSheet, date1904: boolean): { products: ParsedProduct[]; errors: string[] } {
  const products: ParsedProduct[] = [];
  const errors: string[] = [];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = 1; r <= range.e.r; r++) {
    const cells = [0, 1, 2, 3].map(c => ws[XLSX.utils.encode_cell({ r, c })]);
    const values = cells.map(cell => String(cell?.v ?? "").trim());
    if (values.every(value => !value)) continue;
    try {
      const [barcode, name, dateText, monthsText] = values;
      if (!barcode || !name) throw new Error("Укажите штрих-код и название");
      if (!dateText) throw new Error("Укажите дату");
      if (monthsText && !/^\d+$/.test(monthsText)) throw new Error("Срок должен быть целым числом месяцев");
      let sourceDate = dateText;
      if (cells[2]?.t === "n") {
        const date = XLSX.SSF.parse_date_code(Number(cells[2].v), { date1904 });
        if (!date) throw new Error("Некорректная дата Excel");
        sourceDate = `${date.d}.${date.m}.${date.y}`;
      } else {
        const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
        if (iso) sourceDate = `${iso[3]}.${iso[2]}.${iso[1]}`;
      }
      const expiryDate = expiryFromManufacture(sourceDate, monthsText ? Number(monthsText) : null);
      products.push({ barcode, name, quantity: null, expiryDate });
    } catch (error) {
      errors.push(`Строка ${r + 1}: ${error instanceof Error ? error.message : "Некорректные данные"}`);
    }
  }
  return { products, errors };
}

export function parseExcelFile(buffer: Buffer | ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: buffer instanceof ArrayBuffer ? "array" : "buffer" });
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];

  if (!ws) {
    return { fileType: "inventory", products: [], errors: ["Файл пустой или не содержит листов"] };
  }

  const fileType = detectFileType(ws);

  if (!fileType) {
    return {
      fileType: "inventory",
      products: [],
      errors: ["Не удалось определить тип файла. Поддерживаются: простая таблица, Инвентаризация и Каталог товаров."],
    };
  }

  const result = fileType === "simple" ? parseSimple(ws, !!workbook.Workbook?.WBProps?.date1904)
    : fileType === "inventory" ? parseInventory(ws) : parseCatalog(ws);

  return {
    fileType,
    products: result.products,
    errors: result.errors,
  };
}
