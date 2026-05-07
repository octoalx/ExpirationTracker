import {
  SummaryEmailData,
  statusConfig,
  escapeHtml,
  formatDate,
  formatDateTime,
  getProductWordForm,
} from "./types";

/**
 * Outlook-compatible summary email template
 * Uses only table-based layout with inline styles
 * No flexbox, grid, border-radius, box-shadow, or linear-gradient
 */
export function outlookSummaryEmailTemplate(data: SummaryEmailData): string {
  const { userName, products, appUrl } = data;

  // Calculate summary stats
  const hasExpired = products.some(p => p.urgency === "expired");
  const hasCritical = products.some(p => p.urgency === "critical");
  const hasWarning = products.some(p => p.urgency === "warning");

  // Determine summary color based on urgency
  const summaryColor = hasExpired ? "#dc2626" : hasCritical ? "#ea580c" : hasWarning ? "#ca8a04" : "#059669";

  // Generate product rows for Outlook (table-based only)
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
      <!-- Product Name & Barcode -->
      <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; width: 45%;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; color: #0f172a; line-height: 1.4;">
              ${escapeHtml(product.name)}
            </td>
          </tr>
          <tr>
            <td style="font-family: 'Courier New', monospace; font-size: 11px; color: #64748b; padding-top: 4px;">
              📊 ${escapeHtml(product.barcode)}
            </td>
          </tr>
        </table>
      </td>
      
      <!-- Status Badge (table-based for Outlook) -->
      <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; width: 25%;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: ${status.bgColor}; border: 1px solid ${status.borderColor};">
          <tr>
            <td style="padding: 6px 10px; font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: ${status.color}; text-align: center; white-space: nowrap;">
              ${status.icon} ${status.label}
            </td>
          </tr>
        </table>
      </td>
      
      <!-- Days & Date -->
      <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; text-align: right; width: 30%;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; color: ${status.color}; text-align: right;">
              ${daysText}
            </td>
          </tr>
          <tr>
            <td style="font-family: Arial, sans-serif; font-size: 10px; color: #94a3b8; text-align: right; padding-top: 2px;">
              📅 ${formatDate(product.expiryDate)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `;
  }).join("");

  const ctaButton = '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ru">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>ExpiTrack — Сводка по срокам годности</title>
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 16px; line-height: 1.5; color: #334155; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  
  <!-- Outer Wrapper Table -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        
        <!-- Main Container Table (max-width: 600px) -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="800" style="width: 100%; max-width: 800px; background-color: #ffffff; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
          
          <!--[if gte mso 9]>
          <tr>
            <td bgcolor="#ffffff">
          <![endif]-->
          
          <!-- Top Accent Bar (solid color, no gradient) -->
          <tr>
            <td bgcolor="#059669" height="6" style="font-size: 1px; line-height: 1px; background-color: #059669; height: 6px;">
              &nbsp;
            </td>
          </tr>
          
          <!-- Header Section -->
          <tr>
            <td bgcolor="#059669" style="background-color: #059669; padding: 40px 32px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="font-family: Arial, sans-serif; font-size: 28px; font-weight: 700; color: #ffffff;">
                    📦 ExpiTrack
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: Arial, sans-serif; font-size: 14px; color: #d1fae5; padding-top: 8px;">
                    Контроль сроков годности
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Greeting Section -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-family: Arial, sans-serif; font-size: 18px; font-weight: 600; color: #0f172a;">
                    Привет${userName ? ', ' + escapeHtml(userName) : ''}! У вас <strong style="color: ${summaryColor};">${products.length} ${getProductWordForm(products.length)}</strong> с истекающим сроком.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Section Title -->
          <tr>
            <td style="padding: 0 32px 16px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #e2e8f0; padding-top: 24px; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                    📋 Список товаров
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Products Table -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-collapse: collapse;">
                
                <!-- Table Header -->
                <tr>
                  <td style="padding: 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#f1f5f9" style="background-color: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 12px 8px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; width: 45%;">
                          Товар / Штрих-код
                        </td>
                        <td style="padding: 12px 8px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; text-align: center; width: 25%;">
                          Статус
                        </td>
                        <td style="padding: 12px 8px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; text-align: right; width: 30%;">
                          Осталось / Дата
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Product Rows -->
                <tr>
                  <td style="padding: 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse;">
                      ${productsHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 32px;">
              ${ctaButton}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="font-family: Arial, sans-serif; font-size: 18px; font-weight: 700; color: #059669; padding-bottom: 12px;">
                    📦 ExpiTrack
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: Arial, sans-serif; font-size: 13px; color: #64748b; line-height: 1.6; padding-bottom: 16px;">
                    Уведомление отправлено: ${formatDateTime(new Date())}<br/>
                    Система автоматического контроля сроков годности
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!--[if gte mso 9]>
            </td>
          </tr>
          <![endif]-->
          
        </table>
        <!-- End Main Container -->
        
      </td>
    </tr>
  </table>
  <!-- End Outer Wrapper -->
  
</body>
</html>`;
}

/**
 * Outlook-compatible single product expiration email template
 */
export function outlookExpirationEmailTemplate(data: {
  productName: string;
  barcode: string;
  expiryDate: string;
  daysUntil: number;
  urgency: "expired" | "critical" | "warning" | "soon" | "safe";
}, appUrl?: string): string {
  const status = statusConfig[data.urgency];
  const daysText = data.daysUntil < 0
    ? `Просрочено на ${Math.abs(data.daysUntil)} дн.`
    : data.daysUntil === 0
    ? "Истекает сегодня!"
    : data.daysUntil === 1
    ? "Истекает завтра!"
    : `Осталось ${data.daysUntil} дн.`;

  const ctaButton = '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ru">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Уведомление о сроке годности — ExpiTrack</title>
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 16px; line-height: 1.5; color: #334155; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="800" style="width: 100%; max-width: 800px; background-color: #ffffff; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
          
          <!-- Top Accent Bar -->
          <tr>
            <td bgcolor="#059669" height="6" style="font-size: 1px; line-height: 1px; background-color: #059669; height: 6px;">
              &nbsp;
            </td>
          </tr>
          
          <!-- Header -->
          <tr>
            <td bgcolor="#059669" style="background-color: #059669; padding: 40px 32px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="font-family: Arial, sans-serif; font-size: 28px; font-weight: 700; color: #ffffff;">
                    📦 ExpiTrack
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: Arial, sans-serif; font-size: 14px; color: #d1fae5; padding-top: 8px;">
                    Контроль сроков годности
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-family: Arial, sans-serif; font-size: 20px; font-weight: 600; color: #0f172a;">
                    Привет! 👋
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Status Badge -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: ${status.bgColor}; border: 2px solid ${status.borderColor};">
                <tr>
                  <td style="padding: 12px 20px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${status.color}; text-align: center;">
                    <span style="margin-right: 6px;">${status.icon}</span>${status.label}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Product Card -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-collapse: collapse;">
                <tr>
                  <td style="padding: 24px;">
                    
                    <!-- Product Name -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-family: Arial, sans-serif; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.3; padding-bottom: 20px;">
                          ${escapeHtml(data.productName)}
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Divider -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td height="1" bgcolor="#e2e8f0" style="font-size: 1px; line-height: 1px; height: 1px; background-color: #e2e8f0; margin: 20px 0;">
                          &nbsp;
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Product Details -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="font-family: Arial, sans-serif; font-size: 14px; color: #64748b; font-weight: 500; width: 40%;">
                                📊 Штрих-код
                              </td>
                              <td style="font-family: Arial, sans-serif; font-size: 15px; color: #0f172a; font-weight: 600; text-align: right;">
                                ${escapeHtml(data.barcode)}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="font-family: Arial, sans-serif; font-size: 14px; color: #64748b; font-weight: 500; width: 40%;">
                                📅 Дата истечения
                              </td>
                              <td style="font-family: Arial, sans-serif; font-size: 15px; color: #0f172a; font-weight: 600; text-align: right;">
                                ${formatDate(data.expiryDate)}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="font-family: Arial, sans-serif; font-size: 14px; color: #64748b; font-weight: 500; width: 40%;">
                                ⏱️ Осталось времени
                              </td>
                              <td style="font-family: Arial, sans-serif; font-size: 20px; font-weight: 700; color: ${status.color}; text-align: right;">
                                ${daysText}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 32px;">
              ${ctaButton}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="font-family: Arial, sans-serif; font-size: 18px; font-weight: 700; color: #059669; padding-bottom: 12px;">
                    📦 ExpiTrack
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: Arial, sans-serif; font-size: 13px; color: #64748b; line-height: 1.6; padding-bottom: 16px;">
                    Уведомление отправлено: ${formatDateTime(new Date())}<br/>
                    Система автоматического контроля сроков годности
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`;
}
