/** Inventory dates are calendar labels; operational days use Minsk, not device time. */
export const INVENTORY_TIMEZONE = "Europe/Minsk";

export function minskDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: INVENTORY_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function minskTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: INVENTORY_TIMEZONE,
    hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

export function expiryLabel(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function expiryDisplay(value: Date | string | null | undefined): string {
  const label = expiryLabel(value);
  return label ? label.split("-").reverse().join(".") : "—";
}

export function expiryDays(value: Date | string | null | undefined, now: Date = new Date()): number | null {
  const label = expiryLabel(value);
  return label ? Math.round((Date.parse(label) - Date.parse(minskDate(now))) / 86400000) : null;
}

export function expiredOn(value: Date | string | null | undefined, now: Date = new Date()): boolean {
  const days = expiryDays(value, now);
  return days !== null && days < 0;
}
