import { differenceInCalendarDays } from "date-fns";

interface RecordWithExpiry {
  id: string;
  name: string;
  barcode: string;
  status: string;
  expiryDate: Date | null;
}

/** Operational risk concerns active records and local calendar dates only. */
export function expiryOverview<T extends RecordWithExpiry>(products: T[], now: Date, urgentThreshold: number, warningThreshold: number) {
  const counts = { expired: 0, urgent: 0, warning: 0, safe: 0, unknown: 0 };
  const dated: { product: T; daysLeft: number }[] = [];
  const unknown: T[] = [];
  for (const product of products) {
    if (product.status !== "ACTIVE") continue;
    if (!product.expiryDate || !Number.isFinite(product.expiryDate.getTime())) {
      counts.unknown++;
      unknown.push(product);
      continue;
    }
    const daysLeft = differenceInCalendarDays(product.expiryDate, now);
    dated.push({ product, daysLeft });
    if (daysLeft < 0) counts.expired++;
    else if (daysLeft <= urgentThreshold) counts.urgent++;
    else if (daysLeft <= warningThreshold) counts.warning++;
    else counts.safe++;
  }
  dated.sort((a, b) => a.daysLeft - b.daysLeft || a.product.name.localeCompare(b.product.name));
  return { counts, dated, unknown };
}
