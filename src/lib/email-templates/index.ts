import {
  SummaryEmailData,
  ExpirationEmailData,
  ExpirationProduct,
} from "./types";
import {
  summaryEmailTemplate as modernSummaryTemplate,
  expirationEmailTemplate as modernExpirationTemplate,
} from "./modern-template";
import {
  outlookSummaryEmailTemplate,
  outlookExpirationEmailTemplate,
} from "./outlook-template";
import {
  textFallbackSummary,
  textFallbackExpiration,
  ultraMinimalText,
} from "./outlook-fallback";

// Re-export types
export type { SummaryEmailData, ExpirationEmailData, ExpirationProduct } from "./types";

// Template type
export type EmailTemplateType = "modern" | "outlook" | "fallback" | "ultra-minimal";

/**
 * Extract clean email address from string that might contain display name
 * Examples: "Name <email@domain.com>" -> "email@domain.com"
 *          "email@domain.com" -> "email@domain.com"
 */
function extractEmailAddress(input: string): string {
  // Match email pattern inside angle brackets or standalone
  const match = input.match(/<([^>]+@[^>]+)>/);
  if (match) {
    return match[1].trim().toLowerCase();
  }
  // No angle brackets, assume it's just the email
  return input.trim().toLowerCase();
}

/**
 * Detect email client type based on various signals
 * Returns the appropriate template type for the detected client
 *
 * Detection order of priority:
 * 1. User preference/settings
 * 2. Domain-based detection (Outlook domains)
 * 3. User-Agent string analysis
 * 4. Default to modern
 */
export function detectEmailClient(
  recipientEmail?: string,
  userAgent?: string,
  userPreference?: "modern" | "outlook" | "auto"
): "outlook" | "modern" {
  // If user explicitly chose a template, respect that
  if (userPreference && userPreference !== "auto") {
    return userPreference;
  }

  // Domain-based detection for Outlook/Exchange
  if (recipientEmail) {
    const outlookDomains = [
      "outlook.com",
      "hotmail.com",
      "live.com",
      "msn.com",
      "windowslive.com",
      "outlook.co.uk",
      "outlook.fr",
      "outlook.de",
      "outlook.jp",
    ];

    const exchangeDomains = [
      "microsoft.com",
      "office365.com",
      "onmicrosoft.com",
    ];

    // Extract clean email address (handles "Name <email@domain.com>" format)
    const emailLower = extractEmailAddress(recipientEmail);

    // Check Outlook consumer domains
    const isOutlookDomain = outlookDomains.some(domain =>
      emailLower.endsWith(`@${domain}`)
    );

    // Check Exchange/Office365 (common business emails)
    const isExchangeDomain = exchangeDomains.some(domain =>
      emailLower.includes(domain)
    );

    // Check for corporate Exchange servers (MX record check would be better,
    // but we do basic detection here)
    if (isOutlookDomain || isExchangeDomain) {
      return "outlook";
    }
  }

  // User-Agent based detection (for webmail clients)
  if (userAgent) {
    const outlookUserAgents = [
      "Outlook",
      "Microsoft Outlook",
      "MSOffice",
      "Microsoft Office",
    ];

    const uaLower = userAgent.toLowerCase();
    const isOutlookUA = outlookUserAgents.some(agent =>
      uaLower.includes(agent.toLowerCase())
    );

    if (isOutlookUA) {
      return "outlook";
    }
  }

  // Default to modern template for all other clients
  // (Gmail, Apple Mail, Thunderbird, etc.)
  return "modern";
}

/**
 * Get email template based on type and data
 * 
 * @param type - Template type: "summary" | "expiration"
 * @param data - Template data
 * @param templateStyle - Which style to use: "modern" | "outlook" | "auto"
 * @param recipientEmail - Email address for auto-detection (if style is "auto")
 * @returns HTML string for the email
 */
export function getEmailTemplate(
  type: "summary" | "expiration",
  data: SummaryEmailData | ExpirationEmailData,
  templateStyle: "modern" | "outlook" | "auto" = "auto",
  recipientEmail?: string
): { html: string; text: string; templateUsed: EmailTemplateType } {
  // Determine which template to use
  const templateToUse: "modern" | "outlook" =
    templateStyle === "auto"
      ? detectEmailClient(recipientEmail)
      : templateStyle;

  let html: string;
  let text: string;
  let templateUsed: EmailTemplateType = templateToUse;

  try {
    if (type === "summary") {
      const summaryData = data as SummaryEmailData;

      if (templateToUse === "outlook") {
        html = outlookSummaryEmailTemplate(summaryData);
      } else {
        html = modernSummaryTemplate(summaryData);
      }

      text = textFallbackSummary(summaryData);
    } else {
      const expirationData = data as ExpirationEmailData;
      const appUrl = (data as { appUrl?: string }).appUrl;

      if (templateToUse === "outlook") {
        html = outlookExpirationEmailTemplate(expirationData, appUrl);
      } else {
        html = modernExpirationTemplate(expirationData, appUrl);
      }

      text = textFallbackExpiration(expirationData, appUrl);
    }
  } catch (error) {
    // Fallback to ultra-minimal text if HTML generation fails
    console.error("[EmailTemplates] HTML generation failed, using fallback:", error);
    
    html = `<pre style="font-family: monospace; white-space: pre-wrap;">${
      type === "summary" 
        ? ultraMinimalText(data as SummaryEmailData)
        : textFallbackExpiration(data as ExpirationEmailData)
    }</pre>`;
    
    text = type === "summary"
      ? ultraMinimalText(data as SummaryEmailData)
      : textFallbackExpiration(data as ExpirationEmailData);
    
    templateUsed = "ultra-minimal";
  }

  return { html, text, templateUsed };
}

/**
 * Generate both modern and Outlook templates for testing/comparison
 */
export function generateBothTemplates(
  type: "summary" | "expiration",
  data: SummaryEmailData | ExpirationEmailData
): {
  modern: { html: string; text: string };
  outlook: { html: string; text: string };
} {
  const appUrl = (data as { appUrl?: string }).appUrl;

  if (type === "summary") {
    const summaryData = data as SummaryEmailData;
    return {
      modern: {
        html: modernSummaryTemplate(summaryData),
        text: textFallbackSummary(summaryData),
      },
      outlook: {
        html: outlookSummaryEmailTemplate(summaryData),
        text: textFallbackSummary(summaryData),
      },
    };
  } else {
    const expirationData = data as ExpirationEmailData;
    return {
      modern: {
        html: modernExpirationTemplate(expirationData, appUrl),
        text: textFallbackExpiration(expirationData, appUrl),
      },
      outlook: {
        html: outlookExpirationEmailTemplate(expirationData, appUrl),
        text: textFallbackExpiration(expirationData, appUrl),
      },
    };
  }
}

// Direct exports for specific use cases
export {
  modernSummaryTemplate,
  modernExpirationTemplate,
  outlookSummaryEmailTemplate,
  outlookExpirationEmailTemplate,
  textFallbackSummary,
  textFallbackExpiration,
  ultraMinimalText,
};
