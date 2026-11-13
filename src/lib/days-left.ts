import { expiryDays } from "./expiry-calendar";

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
 * Calendar comparison reports already-expired dates as negative values. The
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
 * product has no valid expiry date. Day boundaries use Europe/Minsk
 * (matching `getExpiryStatus`) so sorting agrees with status badges.
 */
export function getDaysLeft(
  expiryDate: Date | string | null | undefined,
  referenceDate: Date = new Date(),
): number | null {
  return expiryDays(expiryDate, referenceDate);
}

interface MobileSortableProduct {
  expiryDate: Date | string | null;
  createdAt: Date | string;
}

/* ── Expiry groups (dashboard redesign) ── */

/** Buckets used by the phone list and the desktop "Скорее истекают" split. */
export type ExpiryGroupKey = "expired" | "today" | "urgent" | "warning" | "safe" | "none";

export interface ExpiryGroup<T> {
  /** Stable identifier; the desktop split adds `expiring` and `all`. */
  key: string;
  label: string;
  /** Small note next to the label, e.g. `до 3 дн.` or `Просрочено: 2 · Срочно: 1`. */
  hint: string;
  /** Number of records in the group before any pagination slice is applied. */
  count: number;
  items: T[];
}

export interface ExpiryGroupingOptions {
  now?: Date;
  urgentThreshold?: number;
  warningThreshold?: number;
}

interface GroupableProduct {
  expiryDate: Date | string | null;
  /** Archive and defect records are excluded from expiry checks. */
  status?: string | null;
}

const DEFAULT_URGENT_THRESHOLD = 3;
const DEFAULT_WARNING_THRESHOLD = 7;

/** Group order shared by every screen; empty groups are dropped. */
const EXPIRY_GROUP_ORDER: readonly ExpiryGroupKey[] = [
  "expired",
  "today",
  "urgent",
  "warning",
  "safe",
  "none",
];

const EXPIRY_GROUP_LABELS: Readonly<Record<ExpiryGroupKey, string>> = {
  expired: "Просрочено",
  today: "Сегодня",
  urgent: "Срочно",
  warning: "Внимание",
  safe: "В норме",
  none: "Без срока",
};

/**
 * Returns a new array ordered first-expired-first (FEFO): the closest expiry
 * date leads, records without a valid expiry date always close the list and
 * the input order stays as a stable tie-breaker.
 */
export function sortProductsByExpiry<T extends Pick<GroupableProduct, "expiryDate">>(
  products: readonly T[],
  now: Date = new Date(),
): T[] {
  return products
    .map((product, index) => ({ product, index, days: getDaysLeft(product.expiryDate, now) }))
    .sort((a, b) => {
      if (a.days === null && b.days === null) return a.index - b.index;
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days || a.index - b.index;
    })
    .map((entry) => entry.product);
}

function expiryBucket(product: GroupableProduct, options: ExpiryGroupingOptions): ExpiryGroupKey {
  const days = getDaysLeft(product.expiryDate, options.now);
  if (days === null) return "none";
  // Archive and defect records are never reported as overdue or expiring soon.
  if (product.status != null && product.status !== "ACTIVE") return "safe";
  const urgent = options.urgentThreshold ?? DEFAULT_URGENT_THRESHOLD;
  const warning = options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days <= urgent) return "urgent";
  if (days <= warning) return "warning";
  return "safe";
}

function groupHint(key: ExpiryGroupKey, options: ExpiryGroupingOptions): string {
  if (key === "urgent") return `до ${options.urgentThreshold ?? DEFAULT_URGENT_THRESHOLD} дн.`;
  if (key === "warning") return `до ${options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD} дн.`;
  return "";
}

/**
 * Splits products into the phone-list groups «Просрочено», «Сегодня»,
 * «Срочно», «Внимание», «В норме», «Без срока».
 *
 * Records are FEFO-sorted first, so every group keeps the closest expiry date
 * at its top. Groups without records are omitted; the sum of `count` always
 * equals the number of input records, which keeps pagination and bulk
 * selection counts honest.
 */
export function groupByExpiryStatus<T extends GroupableProduct>(
  products: readonly T[],
  options: ExpiryGroupingOptions = {},
): ExpiryGroup<T>[] {
  const buckets = new Map<ExpiryGroupKey, T[]>();
  for (const product of sortProductsByExpiry(products, options.now ?? new Date())) {
    const key = expiryBucket(product, options);
    const items = buckets.get(key);
    if (items) items.push(product);
    else buckets.set(key, [product]);
  }
  const groups: ExpiryGroup<T>[] = [];
  for (const key of EXPIRY_GROUP_ORDER) {
    const items = buckets.get(key);
    if (!items?.length) continue;
    groups.push({
      key,
      label: EXPIRY_GROUP_LABELS[key],
      hint: groupHint(key, options),
      count: items.length,
      items,
    });
  }
  return groups;
}

/**
 * Splits FEFO-sorted products into the two desktop table groups: the records
 * that need attention now — «Скорее истекают» — and everything else under
 * «Все товары». Groups are disjoint, so concatenating them reproduces the
 * global FEFO order.
 */
export function groupExpiringFirst<T extends GroupableProduct>(
  products: readonly T[],
  options: ExpiryGroupingOptions = {},
): ExpiryGroup<T>[] {
  const sorted = sortProductsByExpiry(products, options.now ?? new Date());
  const expiring: T[] = [];
  const rest: T[] = [];
  let expiredCount = 0;
  let urgentCount = 0;
  for (const product of sorted) {
    const bucket = expiryBucket(product, options);
    if (bucket === "expired" || bucket === "today" || bucket === "urgent") {
      expiring.push(product);
      if (bucket === "expired") expiredCount += 1;
      else urgentCount += 1;
    } else {
      rest.push(product);
    }
  }
  const groups: ExpiryGroup<T>[] = [];
  if (expiring.length) {
    groups.push({
      key: "expiring",
      label: "Скорее истекают",
      hint: `Просрочено: ${expiredCount} · Срочно: ${urgentCount}`,
      count: expiring.length,
      items: expiring,
    });
  }
  if (rest.length) {
    groups.push({ key: "all", label: "Все товары", hint: String(rest.length), count: rest.length, items: rest });
  }
  return groups;
}

/**
 * Slices paginated groups by the global record window `[start, end)`, so a
 * group continues across pages without repeating its header and without
 * changing the total number of records. Empty slices are dropped.
 */
export function sliceGroups<T>(
  groups: readonly ExpiryGroup<T>[],
  start: number,
  end: number,
): ExpiryGroup<T>[] {
  const sliced: ExpiryGroup<T>[] = [];
  let offset = 0;
  for (const group of groups) {
    const from = Math.max(0, start - offset);
    const to = Math.min(group.items.length, end - offset);
    offset += group.items.length;
    if (to > from) sliced.push({ ...group, items: group.items.slice(from, to) });
  }
  return sliced;
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
