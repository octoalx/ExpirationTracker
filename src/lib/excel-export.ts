import type { Product } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const HEADERS = ["№", "Название", "Штрихкод", "Срок годности", "Количество", "Фактическое"];

const ALIGN_LEFT = { horizontal: "left" as const, vertical: "middle" as const };

const THIN_BORDER = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};

const HEADER_BORDER = {
  top: { style: "medium" as const },
  left: { style: "medium" as const },
  bottom: { style: "medium" as const },
  right: { style: "medium" as const },
};

/**
 * Generates a styled Excel file from selected products and opens it in a new browser tab.
 * Columns: №, Название, Штрихкод, Срок годности, Количество, Фактическое (empty).
 * All cells left-aligned, bordered. Headers bold with medium borders.
 */
export async function exportProductsToExcel(products: Product[], userName?: string): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Товары");

  /* ── Header row ── */
  const headerRow = ws.addRow(HEADERS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 14 };
    cell.alignment = ALIGN_LEFT;
    cell.border = HEADER_BORDER;
  });

  /* ── Data rows ── */
  const dataRows = products.map((p, i) => [
    i + 1,
    p.name,
    p.barcode || "",
    p.expiryDate ? format(new Date(p.expiryDate), "dd.MM.yyyy", { locale: ru }) : "",
    p.quantity ?? "",
    "",
  ]);

  for (const rowData of dataRows) {
    const row = ws.addRow(rowData);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = ALIGN_LEFT;
      cell.border = THIN_BORDER;
      cell.numFmt = "@";
    });
  }

  /* ── Auto-fit column widths ── */
  // ExcelJS width is in default-font character units (Calibri 11).
  // Headers use size 14 bold → scale by (14/11)*1.05 ≈ 1.34 to match rendered width.
  const HEADER_SCALE = (14 / 11) * 1.05;
  const PADDING = 2;

  ws.columns.forEach((col, idx) => {
    const headerWidth = (HEADERS[idx]?.length ?? 0) * HEADER_SCALE;

    let maxDataWidth = 0;
    for (const rowData of dataRows) {
      const cellLen = String(rowData[idx] ?? "").length;
      if (cellLen > maxDataWidth) maxDataWidth = cellLen;
    }

    col.width = Math.ceil(Math.max(headerWidth, maxDataWidth)) + PADDING;
  });

  /* ── Generate blob and trigger named download ── */
  const dateStr = format(new Date(), "dd.MM.yyyy", { locale: ru });
  const safeName = (userName || "export").replace(/[^\wа-яА-ЯёЁ\s-]/g, "").trim();
  const fileName = `${safeName}_${dateStr}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
