import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInDays, startOfDay } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ExpiryStatus = "expired" | "urgent" | "warning" | "safe"

export function getExpiryStatus(
  expiryDate: Date,
  urgentThreshold = 3,
  warningThreshold = 7,
): ExpiryStatus {
  const now = startOfDay(new Date())
  const expiry = startOfDay(new Date(expiryDate))
  const daysLeft = differenceInDays(expiry, now)

  if (daysLeft < 0) return "expired"
  if (daysLeft <= urgentThreshold) return "urgent"
  if (daysLeft <= warningThreshold) return "warning"
  return "safe"
}
