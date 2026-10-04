import { differenceInDays, startOfDay } from "date-fns";

/** Sort orders offered by the phone product list. */
export type MobileSortOption = "newest" | "expiring-soonest" | "expiring-latest";

/** Default phone list order: newest products first. */
export const DEFAULT_MOBILE_SORT: MobileSortOption = "newest";

/** Compact sort selector options shared by the dashboard components. */
export const MOBILE_SORT_OPTIONS: ReadonlyArray<{ value: MobileSortOption; label: string }> = [
  { value: "newest", label: "Сначала новые" },
  { value: "expiring-soonest", label: "Скорее истекают" },
  { value: "expiring-latest", label: "Позже истекают" },
];

/**
 * Picks the phone-list order that should be applied automatically when the
 * user switches to an expiry-status filter. "Soon" and "expired" tabs start
 * with the closest expiry dates; every other filter keeps the newest-first
 * default. The choice stays manual afterwards because the caller only reacts
 * to status changes.
 */
export function mobileSortForStatusFilter(statusFilter: string): MobileSortOption {
  return statusFilter === "SOON" || statusFilter === "EXPIRED"
    ? "expiring-soonest"
    : DEFAULT_MOBILE_SORT;
}

/** Non-breaking space that keeps a day count and its unit on one line. */
const NBSP = " ";

/**
 * Formats the remaining shelf-life days for the phone product list.
 * Non-finite, negative or missing values return an empty string so the
 * caller can fall back to its previous label.
 */
export function formatDaysLeft(days: number): string {
  if (!Number.isFinite(days) || days < 0) return "";
  const wholeDays = Math.floor(days);
  if (wholeDays === 0) return "сегодня";
  if (wholeDays === 1) return `1${NBSP}день`;
  return `${wholeDays}${NBSP}дн.`;
}

/**
 * Formats the overdue part of an expired product for the phone list.
 *
 * differenceInDays reports already-expired dates as negative values. The
 * badge drops the minus sign and shows the elapsed whole days, e.g. `-3`
 * becomes `3 дн.` and `-1` becomes `1 день`. Zero (expires today) and
 * invalid values return an empty string.
 */
export function formatExpiredDaysLeft(daysLeft: number): string {
  if (!Number.isFinite(daysLeft) || daysLeft >= 0) return "";
  return formatDaysLeft(Math.abs(daysLeft));
}

/**
 * Remaining whole calendar days until the expiry date, or `null` when the
 * product has no valid expiry date. Day boundaries are compared in local
 * time (matching `getExpiryStatus`) so sorting agrees with status badges.
 */
export function getDaysLeft(
  expiryDate: Date | string | null | undefined,
  referenceDate: Date = new Date(),
): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  if (!Number.isFinite(expiry.getTime())) return null;
  return differenceInDays(startOfDay(expiry), startOfDay(referenceDate));
}

interface MobileSortableProduct {
  expiryDate: Date | string | null;
  createdAt: Date | string;
}

/**
 * Returns a new array ordered for the phone list.
 *
 * - `newest` — newest `createdAt` first.
 * - `expiring-soonest` / `expiring-latest` — by remaining days ascending or
 *   descending.
 *
 * Products without a valid expiry date are always placed at the end,
 * regardless of the selected order, and the input order is kept as a stable
 * tie-breaker.
 */
export function sortProductsForMobile<T extends MobileSortableProduct>(
  products: readonly T[],
  sort: MobileSortOption,
  referenceDate?: Date,
): T[] {
  const indexed = products.map((product, index) => ({ product, index }));
  indexed.sort((a, b) => {
    const aDays = getDaysLeft(a.product.expiryDate, referenceDate);
    const bDays = getDaysLeft(b.product.expiryDate, referenceDate);

    // Products without a valid expiry date belong at the end for every order.
    if (aDays === null && bDays === null) {
      if (sort !== "newest") return a.index - b.index;
    } else if (aDays === null) {
      return 1;
    } else if (bDays === null) {
      return -1;
    }

    if (sort === "newest") {
      const aTime = new Date(a.product.createdAt).getTime();
      const bTime = new Date(b.product.createdAt).getTime();
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeB - safeA || a.index - b.index;
    }

    const diff = sort === "expiring-soonest" ? aDays - bDays : bDays - aDays;
    return diff || a.index - b.index;
  });
  return indexed.map((entry) => entry.product);
}
