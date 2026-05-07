import * as XLSX from "xlsx";

export interface ParsedProduct {
  barcode: string;
  name: string;
  quantity: number | null;
}

export type ExcelFileType = "inventory" | "catalog";

export interface ParseResult {
  fileType: ExcelFileType;
  products: ParsedProduct[];
  errors: string[];
}

/**
 * Определяет тип Excel-файла по содержимому первой ячейки / заголовков.
 * - "inventory" (Инвентаризация): A1 содержит "Инвентаризационная опись"
 * - "catalog" (Каталог товаров): строка 1 содержит заголовки "Штрих-код" или "Наименование товара"
 */
function detectFileType(ws: XLSX.WorkSheet): ExcelFileType | null {
  // Тип "Инвентаризация": ячейка A1 или A2 содержит "Инвентаризационная опись"
  for (let r = 0; r < 5; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell && typeof cell.v === "string" && cell.v.includes("Инвентаризационная опись")) {
      return "inventory";
    }
  }

  // Также проверяем наличие строки-заголовка с "Артикул" + "Наименование" (типично для инвентаризации)
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

  // Тип "Каталог": строка 1 содержит заголовки "Штрих-код" или "Наименование товара"
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
 * Парсит файл типа "Инвентаризация" (book1.xlsx):
 * - Ищем строку-заголовок с "Артикул"/"Наименование", данные начинаются со следующей строки
 * - B = штрихкод (Артикул), C = наименование, D = количество
 */
function parseInventory(ws: XLSX.WorkSheet): { products: ParsedProduct[]; errors: string[] } {
  const products: ParsedProduct[] = [];
  const errors: string[] = [];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  // Находим строку-заголовок (содержит "Артикул" в колонке B)
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
    const barcodeCell = ws[XLSX.utils.encode_cell({ r, c: 1 })]; // B
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];    // C
    const qtyCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];     // D

    const barcode = barcodeCell ? String(barcodeCell.v).trim() : "";
    const name = nameCell ? String(nameCell.v).trim() : "";

    // Пропускаем пустые строки и строки "Всего"
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
 * Парсит файл типа "Каталог товаров" (CS25.xls):
 * - Строка 1 = заголовки, данные со строки 2
 * - D = штрихкод осн., F = наименование товара, I = доступно (количество)
 */
function parseCatalog(ws: XLSX.WorkSheet): { products: ParsedProduct[]; errors: string[] } {
  const products: ParsedProduct[] = [];
  const errors: string[] = [];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  // Определяем индексы колонок по заголовкам (на случай если порядок изменится)
  let barcodeCol = 3;  // D (0-indexed)
  let nameCol = 5;     // F (0-indexed)
  let qtyCol = 8;      // I (0-indexed)

  // Попытка найти колонки по заголовкам
  for (let c = range.s.c; c <= Math.min(range.e.c, 40); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell && typeof cell.v === "string") {
      const val = cell.v.trim().toLowerCase();
      if (val.includes("штрих-код осн")) barcodeCol = c;
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
 * Главная функция: принимает Buffer Excel-файла, определяет тип, парсит данные.
 */
export function parseExcelFile(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
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
      errors: ["Не удалось определить тип файла. Поддерживаются: Инвентаризация и Каталог товаров."],
    };
  }

  const result = fileType === "inventory" ? parseInventory(ws) : parseCatalog(ws);

  return {
    fileType,
    products: result.products,
    errors: result.errors,
  };
}
