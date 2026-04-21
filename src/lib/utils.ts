import { differenceInDays } from "date-fns";

export type ExpiryStatus = "urgent" | "warning" | "safe" | "expired";

export const getExpiryStatus = (
  date: Date,
  urgentThreshold: number = 3,
  warningThreshold: number = 7,
): ExpiryStatus => {
  const today = new Date();
  const daysLeft = differenceInDays(date, today);

  if (daysLeft < 0) {
    return "expired";
  }
  if (daysLeft < urgentThreshold) {
    return "urgent";
  }
  if (daysLeft < warningThreshold) {
    return "warning";
  }
  return "safe";
};
