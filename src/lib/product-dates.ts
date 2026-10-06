import { calculateExpiryDate, type ShelfLifeUnit } from "./shelf-life";
import { expiredOn } from "./expiry-calendar";

/** Omitted date fields preserve metadata; explicit expiry switches to expiry mode. */
export function productDates(body: Record<string, unknown>) {
  if (body.manufacturingDate != null && body.manufacturingDate !== "") {
    const { manufacturingDate, shelfLife, shelfLifeUnit } = body;
    if (typeof manufacturingDate !== "string" || typeof shelfLife !== "number" ||
        !Number.isSafeInteger(shelfLife) || !["days", "weeks", "months"].includes(String(shelfLifeUnit))) {
      throw new Error("Укажите дату изготовления и корректный срок хранения.");
    }
    const expiry = calculateExpiryDate(manufacturingDate, String(shelfLife), shelfLifeUnit as ShelfLifeUnit);
    if (!expiry) throw new Error("Укажите дату изготовления и корректный срок хранения.");
    const expiryDate = new Date(expiry);
    return { manufacturingDate, shelfLife, shelfLifeUnit: String(shelfLifeUnit), expiryDate, isExpired: expiredOn(expiryDate) };
  }
  if (body.expiryDate === undefined) return {};
  const expiryDate = body.expiryDate ? new Date(String(body.expiryDate)) : null;
  if (expiryDate && !Number.isFinite(expiryDate.getTime())) throw new Error("Некорректная дата окончания срока.");
  return { manufacturingDate: null, shelfLife: null, shelfLifeUnit: null, expiryDate, isExpired: expiredOn(expiryDate) };
}
