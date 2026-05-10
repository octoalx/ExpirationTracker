/**
 * Formats a date value using `Intl.DateTimeFormat` (en-US locale by default).
 *
 * @param date - Date value to format (Date, string, number, or undefined).
 * @param opts - Optional `Intl.DateTimeFormatOptions` overrides.
 * @returns Formatted date string, or empty string on invalid input.
 */
export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
) {
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: opts.month ?? "long",
      day: opts.day ?? "numeric",
      year: opts.year ?? "numeric",
      ...opts,
    }).format(new Date(date));
  } catch (_err) {
    return "";
  }
}
