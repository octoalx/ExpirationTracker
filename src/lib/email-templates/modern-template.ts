import {
  ExpirationEmailData,
  SummaryEmailData,
  statusConfig,
  escapeHtml,
  formatDate,
  formatDateTime,
  getProductWordForm,
} from "./types";

export function expirationEmailTemplate(data: ExpirationEmailData, appUrl?: string): string {
  const status = statusConfig[data.urgency];
  const daysText = data.daysUntil < 0
    ? `Просрочено на ${Math.abs(data.daysUntil)} дн.`
    : data.daysUntil === 0
    ? "Истекает сегодня!"
    : data.daysUntil === 1
    ? "Истекает завтра!"
    : `Осталось ${data.daysUntil} дн.`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Уведомление о сроке годности — ExpiTrack</title>
  <style type="text/css">
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }

    /* Base styles */
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f8fafc;
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #334155;
    }

    /* Container - Full Width */
    .email-wrapper {
      width: 100%;
      margin: 0;
      background-color: #f8fafc;
    }

    .email-container {
      width: 100%;
      max-width: 100%;
      margin: 0;
      background-color: #ffffff;
      overflow: hidden;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      padding: 40px 48px;
      text-align: center;
    }

    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 8px 0;
      text-decoration: none;
    }

    .logo-icon {
      font-size: 32px;
      margin-right: 8px;
    }

    .tagline {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
    }

    /* Content */
    .content {
      padding: 40px 48px;
    }

    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 24px 0;
    }

    .status-badge {
      display: inline-block;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 32px;
      background-color: ${status.bgColor};
      color: ${status.color};
      border: 2px solid ${status.borderColor};
    }

    .status-icon {
      margin-right: 6px;
    }

    /* Product Card */
    .product-card {
      background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 16px;
      padding: 28px;
      border: 1px solid #e2e8f0;
      margin-bottom: 32px;
    }

    .product-name {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 20px 0;
      line-height: 1.3;
    }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, #e2e8f0 50%, transparent 100%);
      margin: 20px 0;
    }

    .details-table {
      width: 100%;
      border-collapse: collapse;
    }

    .details-table td {
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .details-table tr:last-child td {
      border-bottom: none;
    }

    .detail-label {
      font-size: 14px;
      color: #64748b;
      font-weight: 500;
      width: 40%;
    }

    .detail-value {
      font-size: 15px;
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }

    .days-highlight {
      color: ${status.color};
      font-size: 20px;
      font-weight: 700;
    }

    /* CTA Button */
    .cta-section {
      text-align: center;
      margin: 32px 0;
    }

    .cta-button {
      display: inline-block;
      padding: 16px 32px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
      transition: all 0.2s ease;
    }

    /* Footer */
    .footer {
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      padding: 32px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }

    .footer-logo {
      font-size: 18px;
      font-weight: 700;
      color: #059669;
      margin-bottom: 12px;
    }

    .footer-text {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 16px 0;
      line-height: 1.6;
    }

    .footer-links {
      font-size: 12px;
      color: #94a3b8;
    }

    .footer-links a {
      color: #059669;
      text-decoration: none;
      font-weight: 500;
    }

    .footer-links a:hover {
      text-decoration: underline;
    }

    .separator {
      margin: 0 8px;
      color: #cbd5e1;
    }

    /* Mobile Responsive */
    @media screen and (max-width: 768px) {
      .header {
        padding: 28px 20px;
      }

      .logo {
        font-size: 24px;
      }

      .content {
        padding: 24px 16px;
      }

      .greeting {
        font-size: 18px;
      }

      .product-card {
        padding: 20px;
      }

      .product-name {
        font-size: 20px;
      }

      .cta-button {
        display: block;
        width: 100%;
        padding: 18px;
        font-size: 16px;
      }

      .footer {
        padding: 24px 16px;
      }
    }

    @media screen and (max-width: 480px) {
      .details-table td {
        display: block;
        width: 100%;
        text-align: left !important;
        padding: 8px 0;
      }

      .detail-value {
        text-align: left !important;
        margin-top: 4px;
      }

      .details-table .detail-label {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-wrapper">
    <tr>
      <td>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-container">
          <!-- Header -->
          <tr>
            <td class="header">
              <div class="logo">
                <span class="logo-icon">📦</span>ExpiTrack
              </div>
              <p class="tagline">Контроль сроков годности</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content">
              <p class="greeting">Привет! 👋</p>

              <div class="status-badge">
                <span class="status-icon">${status.icon}</span>
                ${status.label}
              </div>

              <div class="product-card">
                <h2 class="product-name">${escapeHtml(data.productName)}</h2>

                <div class="divider"></div>

                <table role="presentation" class="details-table">
                  <tr>
                    <td class="detail-label">📊 Штрих-код</td>
                    <td class="detail-value">${escapeHtml(data.barcode)}</td>
                  </tr>
                  <tr>
                    <td class="detail-label">📅 Дата истечения</td>
                    <td class="detail-value">${formatDate(data.expiryDate)}</td>
                  </tr>
                  <tr>
                    <td class="detail-label">⏱️ Осталось времени</td>
                    <td class="detail-value days-highlight">${daysText}</td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              <div class="footer-logo">📦 ExpiTrack</div>
              <p class="footer-text">
                Уведомление отправлено: ${formatDateTime(new Date())}<br>
                Система автоматического контроля сроков годности
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function summaryEmailTemplate(data: SummaryEmailData): string {
  const { userName, products, appUrl } = data;

  // Calculate summary stats
  const hasExpired = products.some(p => p.urgency === "expired");
  const hasCritical = products.some(p => p.urgency === "critical");
  const hasWarning = products.some(p => p.urgency === "warning");

  // Determine summary color based on urgency
  const summaryColor = hasExpired ? "#dc2626" : hasCritical ? "#ea580c" : hasWarning ? "#ca8a04" : "#059669";
  const summaryBg = hasExpired ? "#fef2f2" : hasCritical ? "#fff7ed" : hasWarning ? "#fefce8" : "#f0fdf4";
  const summaryBorder = hasExpired ? "#fecaca" : hasCritical ? "#fed7aa" : hasWarning ? "#fde047" : "#bbf7d0";

  // Generate product rows
  const productsHtml = products.map(product => {
    const status = statusConfig[product.urgency];
    const daysText = product.daysUntil < 0
      ? `Просрочено: ${Math.abs(product.daysUntil)} дн.`
      : product.daysUntil === 0
      ? "Истекает сегодня"
      : product.daysUntil === 1
      ? "Истекает завтра"
      : `Осталось: ${product.daysUntil} дн.`;

    return `
    <tr>
      <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
        <div style="font-weight: 600; color: #0f172a; font-size: 15px; margin-bottom: 4px;">
          ${escapeHtml(product.name)}
        </div>
        <div style="font-size: 12px; color: #64748b; font-family: 'Courier New', monospace;">
          📊 ${escapeHtml(product.barcode)}
        </div>
      </td>
      <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; text-align: center; vertical-align: middle; width: 120px;">
        <span style="display: inline-block; padding: 6px 12px; border-radius: 50px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; background-color: ${status.bgColor}; color: ${status.color}; border: 1.5px solid ${status.borderColor};">
          ${status.icon} ${status.label}
        </span>
      </td>
      <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; text-align: right; vertical-align: middle; width: 140px;">
        <div style="font-size: 14px; color: ${status.color}; font-weight: 700;">
          ${daysText}
        </div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
          📅 ${formatDate(product.expiryDate)}
        </div>
      </td>
    </tr>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>📦 ExpiTrack — Сводка по срокам годности</title>
  <style type="text/css">
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
    }

    /* Base styles */
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f8fafc;
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #334155;
    }

    /* Container */
    .email-wrapper {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      background-color: #f8fafc;
    }

    .email-container {
      width: 100%;
      max-width: 800px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      padding: 40px 32px;
      text-align: center;
    }

    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 8px 0;
    }

    .logo-icon {
      font-size: 32px;
      margin-right: 8px;
    }

    .tagline {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
    }

    /* Content */
    .content {
      padding: 32px;
    }

    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 24px 0;
    }

    .greeting-name {
      color: #059669;
    }

    /* Summary Box */
    .summary-box {
      background: ${summaryBg};
      border: 2px solid ${summaryBorder};
      border-radius: 12px;
      padding: 28px 32px;
      margin-bottom: 32px;
    }

    .summary-icon {
      font-size: 32px;
      margin-bottom: 12px;
      display: block;
    }

    .summary-title {
      font-size: 16px;
      font-weight: 700;
      color: ${summaryColor};
      margin: 0 0 8px 0;
    }

    .summary-text {
      font-size: 14px;
      color: #64748b;
      margin: 0;
      line-height: 1.6;
    }

    .product-count {
      font-weight: 700;
      color: ${summaryColor};
    }

    /* Section divider */
    .section-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, #e2e8f0 30%, #e2e8f0 70%, transparent 100%);
      margin: 32px 0;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 16px 0;
    }

    /* Products Table */
    .products-wrapper {
      background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      margin: 0 -8px;
    }

    .products-table {
      width: 100%;
      border-collapse: collapse;
    }

    .table-header {
      background: #f1f5f9;
    }

    .table-header th {
      padding: 14px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      border-bottom: 2px solid #e2e8f0;
    }

    .table-header th:nth-child(2) {
      text-align: center;
    }

    .table-header th:last-child {
      text-align: right;
    }

    .table-row:hover {
      background-color: #f8fafc;
    }

    /* CTA Button */
    .cta-section {
      text-align: center;
      margin: 32px 0;
    }

    .cta-button {
      display: inline-block;
      padding: 16px 32px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
    }

    /* Footer */
    .footer {
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      padding: 32px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }

    .footer-logo {
      font-size: 18px;
      font-weight: 700;
      color: #059669;
      margin-bottom: 12px;
    }

    .footer-text {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 16px 0;
      line-height: 1.6;
    }

    .footer-links {
      font-size: 12px;
      color: #94a3b8;
    }

    .footer-links a {
      color: #059669;
      text-decoration: none;
      font-weight: 500;
    }

    .separator {
      margin: 0 8px;
      color: #cbd5e1;
    }

    /* Mobile Responsive */
    @media screen and (max-width: 768px) {
      .header {
        padding: 28px 24px;
      }

      .logo {
        font-size: 24px;
      }

      .content {
        padding: 24px 20px;
      }

      .greeting {
        font-size: 18px;
      }

      .summary-box {
        padding: 20px;
      }

      .products-wrapper {
        margin: 0;
        border-radius: 8px;
      }

      .products-table th,
      .products-table td {
        padding: 12px 10px;
      }

      .table-header th:nth-child(2),
      .products-table td:nth-child(2) {
        display: none;
      }

      .cta-button {
        display: block;
        width: 100%;
        padding: 18px;
      }

      .footer {
        padding: 24px 20px;
      }
    }

    @media screen and (max-width: 480px) {
      .products-table td {
        font-size: 13px;
      }

      .header {
        padding: 24px 16px;
      }

      .content {
        padding: 20px 16px;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-wrapper">
    <tr>
      <td>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-container">
          <!-- Header -->
          <tr>
            <td class="header">
              <div class="logo">
                <span class="logo-icon">📦</span>ExpiTrack
              </div>
              <p class="tagline">Контроль сроков годности</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content">
              <p class="greeting">
                Привет${userName ? ', <span class="greeting-name">' + escapeHtml(userName) + '</span>' : ''}! У вас <span class="product-count">${products.length} ${getProductWordForm(products.length)}</span> с истекающим сроком.
              </p>

              <!-- Section Divider -->
              <div class="section-divider"></div>
              <p class="section-title">📋 Список товаров</p>

              <!-- Products Table -->
              <div class="products-wrapper">
                <table role="presentation" class="products-table">
                  <thead class="table-header">
                    <tr>
                      <th>Товар / Штрих-код</th>
                      <th>Статус</th>
                      <th style="text-align: right;">Осталось / Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${productsHtml}
                  </tbody>
                </table>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              <div class="footer-logo">📦 ExpiTrack</div>
              <p class="footer-text">
                Уведомление отправлено: ${formatDateTime(new Date())}<br>
                Система автоматического контроля сроков годности
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
