import {
  SummaryEmailData,
  ExpirationEmailData,
  statusConfig,
  formatDate,
  getProductWordForm,
} from "./types";

/**
 * Minimal text-only fallback template for Outlook
 * Used when HTML rendering fails completely
 */
export function textFallbackSummary(data: SummaryEmailData): string {
  const { userName, products, appUrl } = data;

  const lines: string[] = [
    "═══════════════════════════════════════",
    "           📦 EXPITRACK",
    "      Контроль сроков годности",
    "═══════════════════════════════════════",
    "",
    `Привет${userName ? ', ' + userName : ''}! У вас ${products.length} ${getProductWordForm(products.length)} с истекающим сроком.`,
    "",
    "───────────────────────────────────────",
    "СПИСОК ТОВАРОВ:",
    "───────────────────────────────────────",
    "",
  ];

  products.forEach((product, index) => {
    const status = statusConfig[product.urgency];
    const daysText = product.daysUntil < 0
      ? `❌ ПРОСРОЧЕНО: ${Math.abs(product.daysUntil)} дн.`
      : product.daysUntil === 0
      ? "⏰ ИСТЕКАЕТ СЕГОДНЯ"
      : product.daysUntil === 1
      ? "⏰ Истекает завтра"
      : `⏳ Осталось: ${product.daysUntil} дн.`;

    lines.push(`${index + 1}. ${product.name}`);
    lines.push(`   Штрих-код: ${product.barcode}`);
    lines.push(`   Статус: [${status.label}]`);
    lines.push(`   ${daysText}`);
    lines.push(`   Дата истечения: ${formatDate(product.expiryDate)}`);
    lines.push("");
  });

  lines.push("───────────────────────────────────────");
  lines.push("");

  lines.push("═══════════════════════════════════════");
  lines.push("ExpiTrack — система автоматического");
  lines.push("контроля сроков годности");
  lines.push(`Отправлено: ${new Date().toLocaleString("ru-RU")}`);
  lines.push("═══════════════════════════════════════");

  return lines.join("\n");
}

/**
 * Minimal text-only fallback for single product notification
 */
export function textFallbackExpiration(data: ExpirationEmailData, appUrl?: string): string {
  const status = statusConfig[data.urgency];

  const daysText = data.daysUntil < 0
    ? `❌ ПРОСРОЧЕНО НА ${Math.abs(data.daysUntil)} ДН.`
    : data.daysUntil === 0
    ? "⏰ ИСТЕКАЕТ СЕГОДНЯ!"
    : data.daysUntil === 1
    ? "⏰ Истекает завтра!"
    : `⏳ Осталось: ${data.daysUntil} дн.`;

  const lines: string[] = [
    "═══════════════════════════════════════",
    "           📦 EXPITRACK",
    "      Контроль сроков годности",
    "═══════════════════════════════════════",
    "",
    "Привет!",
    "",
    `СТАТУС: [${status.icon} ${status.label}]`,
    "",
    `📦 Товар: ${data.productName}`,
    `📊 Штрих-код: ${data.barcode}`,
    `📅 Дата истечения: ${formatDate(data.expiryDate)}`,
    `⏱️ ${daysText}`,
    "",
    "───────────────────────────────────────",
  ];

  lines.push("");
  lines.push("═══════════════════════════════════════");
  lines.push("ExpiTrack — система автоматического");
  lines.push("контроля сроков годности");
  lines.push(`Отправлено: ${new Date().toLocaleString("ru-RU")}`);
  lines.push("═══════════════════════════════════════");

  return lines.join("\n");
}

/**
 * Ultra-minimal plain text for worst-case scenarios
 * No special characters, basic ASCII only
 */
export function ultraMinimalText(data: SummaryEmailData): string {
  const { products } = data;

  const lines: string[] = [
    "EXPITRACK - Srok Godnosti",
    "=========================",
    "",
    `Tovarov trebuyushchikh vnimaniya: ${products.length}`,
    "",
    "SPISOK:"
  ];

  products.forEach((product, index) => {
    const status = statusConfig[product.urgency];
    const daysText = product.daysUntil < 0
      ? `PROSROCHENO: ${Math.abs(product.daysUntil)} dn.`
      : `Ostalos: ${product.daysUntil} dn.`;

    lines.push(`${index + 1}. ${product.name} [${status.label}]`);
    lines.push(`   Shtrikh-kod: ${product.barcode}`);
    lines.push(`   ${daysText}, do ${formatDate(product.expiryDate)}`);
    lines.push("");
  });

  lines.push("=========================");
  lines.push(`Otpravleno: ${new Date().toLocaleString("ru-RU")}`);

  return lines.join("\n");
}
