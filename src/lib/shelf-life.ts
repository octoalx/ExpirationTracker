import { addDays, addMonths, addWeeks, format, isValid, parseISO } from "date-fns";

export type ShelfLifeUnit = "days" | "weeks" | "months";

/** Calendar arithmetic uses the input date, avoiding UTC conversion of date-only values. */
export function calculateExpiryDate(date: string, duration: string, unit: ShelfLifeUnit): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+$/.test(duration)) return "";
  const start = parseISO(date);
  const amount = Number(duration);
  if (!isValid(start) || !Number.isSafeInteger(amount) || amount <= 0) return "";
  const end = unit === "days" ? addDays(start, amount) : unit === "weeks" ? addWeeks(start, amount) : addMonths(start, amount);
  return isValid(end) ? format(end, "yyyy-MM-dd") : "";
}
