import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInDays, startOfDay } from "date-fns"

/** Merge Tailwind CSS class names using clsx + tailwind-merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ExpiryStatus = "expired" | "urgent" | "warning" | "safe"

/**
 * Determines the expiry urgency level for a product.
 *
 * @param expiryDate - Product expiration date.
 * @param urgentThreshold - Days threshold for "urgent" status (default 3).
 * @param warningThreshold - Days threshold for "warning" status (default 7).
 * @returns Expiry status: `expired`, `urgent`, `warning`, or `safe`.
 */
export function getExpiryStatus(
  expiryDate: Date | string | null,
  urgentThreshold = 3,
  warningThreshold = 7,
  referenceDate: Date = new Date(),
): ExpiryStatus {
  if (!expiryDate) return "safe"
  const now = startOfDay(referenceDate)
  const expiry = startOfDay(new Date(expiryDate))
  const daysLeft = differenceInDays(expiry, now)

  if (daysLeft < 0) return "expired"
  if (daysLeft <= urgentThreshold) return "urgent"
  if (daysLeft <= warningThreshold) return "warning"
  return "safe"
}
