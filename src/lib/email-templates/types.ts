export interface ExpirationProduct {
  name: string;
  barcode: string;
  expiryDate: string;
  daysUntil: number;
  urgency: "expired" | "critical" | "warning" | "soon" | "safe";
}

export interface ExpirationEmailData {
  productName: string;
  barcode: string;
  expiryDate: string;
  daysUntil: number;
  urgency: "expired" | "critical" | "warning" | "soon" | "safe";
}

export interface SummaryEmailData {
  userName?: string;
  products: ExpirationProduct[];
  appUrl?: string;
}

// Status configuration with 5 levels
export const statusConfig = {
  expired: {
    color: "#dc2626",
    bgColor: "#fef2f2",
    borderColor: "#fecaca",
    icon: "🔴",
    label: "ПРОСРОЧЕН",
    description: "Срок истек",
  },
  critical: {
    color: "#ea580c",
    bgColor: "#fff7ed",
    borderColor: "#fed7aa",
    icon: "🟠",
    label: "СРОЧНО",
    description: "0-3 дня",
  },
  warning: {
    color: "#ca8a04",
    bgColor: "#fefce8",
    borderColor: "#fde047",
    icon: "🟡",
    label: "ВНИМАНИЕ",
    description: "4-7 дней",
  },
  soon: {
    color: "#059669",
    bgColor: "#f0fdf4",
    borderColor: "#86efac",
    icon: "🟢",
    label: "СКОРО",
    description: "8-30 дней",
  },
  safe: {
    color: "#2563eb",
    bgColor: "#eff6ff",
    borderColor: "#93c5fd",
    icon: "🔵",
    label: "НОРМА",
    description: "30+ дней",
  },
};

// Helper functions
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getProductWordForm(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return "товаров";
  }
  if (lastDigit === 1) {
    return "товар";
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return "товара";
  }
  return "товаров";
}
