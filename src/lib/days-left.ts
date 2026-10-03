/**
 * Formats the remaining shelf-life days for the phone product list.
 * Non-finite, negative or missing values return an empty string so the
 * caller can fall back to its previous label.
 */
export function formatDaysLeft(days: number): string {
  if (!Number.isFinite(days) || days < 0) return "";
  const wholeDays = Math.floor(days);
  if (wholeDays === 0) return "сегодня";
  if (wholeDays === 1) return "1 день";
  return `${wholeDays} дн.`;
}
