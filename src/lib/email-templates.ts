import { Product } from "@prisma/client";

type UrgencyLevel = "EXPIRED" | "URGENT" | "WARNING" | "SAFE";

interface ProductWithUrgency extends Product {
  daysUntil: number;
  urgency: UrgencyLevel;
}

const statusConfig: Record<UrgencyLevel, { color: string; bgColor: string; label: string; icon: string }> = {
  EXPIRED: { color: "#dc2626", bgColor: "#fef2f2", label: "ПРОСРОЧЕН", icon: "🔴" },
  URGENT: { color: "#ea580c", bgColor: "#fff7ed", label: "СРОЧНО", icon: "🟠" },
  WARNING: { color: "#ca8a04", bgColor: "#fefce8", label: "ВНИМАНИЕ", icon: "🟡" },
  SAFE: { color: "#059669", bgColor: "#f0fdf4", label: "НОРМА", icon: "🟢" },
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function getProductWordForm(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return "товаров";
  if (lastDigit === 1) return "товар";
  if (lastDigit >= 2 && lastDigit <= 4) return "товара";
  return "товаров";
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function renderExpirationSummary(products: ProductWithUrgency[], userName: string): string {
  const expiredCount = products.filter((p) => p.urgency === "EXPIRED").length;
  const urgentCount = products.filter((p) => p.urgency === "URGENT").length;
  const warningCount = products.filter((p) => p.urgency === "WARNING").length;
  const sortedProducts = [...products].sort((a, b) => a.daysUntil - b.daysUntil);

  const productsHtml = sortedProducts.map((product) => {
    const config = statusConfig[product.urgency];
    const daysText = product.daysUntil < 0
      ? `Просрочен ${Math.abs(product.daysUntil)} ${product.daysUntil === -1 ? "день" : "дней"}`
      : product.daysUntil === 0 ? "Истекает сегодня"
      : `${product.daysUntil} ${product.daysUntil === 1 ? "день" : "дня"} осталось`;

    return `<tr>
      <td style="padding: 12px; border-bottom: px solid #e5e7eb;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">${config.icon}</span>
          <div>
            <div style="font-weight: 600; color: #111827; font-size: 14px;">${escapeHtml(product.name)}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${escapeHtml(product.barcode)}</div>
          </div>
        </div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; color: ${config.color}; background-color: ${config.bgColor};">
          ${config.label}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        <div style="font-size: 14px; color: #374151; font-weight: 500;">${formatDate(product.expiryDate)}</div>
        <div style="font-size: 12px; color: ${config.color}; margin-top: 2px;">${daysText}</div>
      </td>
    </tr>`;
  }).join("");

  const summaryBadges = [
    expiredCount > 0 && `<span style="color: #dc2626; font-weight: 600;">${expiredCount} просрочен</span>`,
    urgentCount > 0 && `<span style="color: #ea580c; font-weight: 600;">${urgentCount} срочно</span>`,
    warningCount > 0 && `<span style="color: #ca8a04; font-weight: 600;">${warningCount} внимание</span>`,
  ].filter(Boolean).join(" • ") || "Все товары в норме";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Уведомление о сроках годности</title></head>
<body style="margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb;"><tr><td align="center" style="padding: 24px 16px;">
    <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr><td style="padding: 32px 24px 16px; text-align: center; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">⏰ Уведомление о сроках</h1>
        <p style="margin: 8px 0 0; color: #d1fae5; font-size: 14px;">${userName ? `Привет, ${escapeHtml(userName)}!` : "Привет!"}</p>
      </td></tr>
      <tr><td style="padding: 24px;">
        <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; color: #065f46; font-size: 16px; font-weight: 600;">${products.length} ${getProductWordForm(products.length)} требуют внимания</p>
          <p style="margin: 0; color: #047857; font-size: 14px;">${summaryBadges}</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
          <thead><tr style="background-color: #f3f4f6;">
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Товар</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Статус</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Срок годности</th>
          </tr></thead>
          <tbody>${productsHtml}</tbody>
        </table>
      </td></tr>
      <tr><td style="padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">ExpiTrack — система отслеживания сроков годности<br><span style="color: #9ca3af;">Отправлено: ${new Date().toLocaleString("ru-RU")}</span></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function renderTestEmail(userName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Тестовое письмо</title></head>
<body style="margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb;"><tr><td align="center" style="padding: 24px 16px;">
    <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr><td style="padding: 32px 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">📧</div>
        <h1 style="margin: 0 0 16px; color: #059669; font-size: 24px; font-weight: 700;">Тестовое письмо</h1>
        <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">${userName ? `Привет, ${escapeHtml(userName)}! ` : ""}Если вы видите это письмо, значит настройки SMTP работают корректно!</p>
        <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; border-radius: 8px; text-align: left;">
          <p style="margin: 0; color: #065f46; font-size: 14px;"><strong>Отправлено:</strong> ${new Date().toLocaleString("ru-RU")}</p>
        </div>
        <p style="margin: 24px 0 0; color: #6b7280; font-size: 12px;">ExpiTrack — система отслеживания сроков годности</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export type { ProductWithUrgency, UrgencyLevel };
