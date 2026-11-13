import { calculateExpiryDate, type ShelfLifeUnit } from "./shelf-life";

/** Fields the add and edit dialogs validate and report errors for, in visual order. */
export type ProductFormField = "barcode" | "name" | "manufacture" | "shelfLife" | "quantity";

export interface ProductFormValues {
  barcode: string;
  name: string;
  /** Which expiry route the user picked in the segment control. */
  mode: "expiry" | "manufacture";
  manufacturingDate: string;
  shelfLife: string;
  shelfLifeUnit: ShelfLifeUnit;
  quantity: string;
}

export interface ProductFormError {
  field: ProductFormField;
  message: string;
}

/** The rule both POST /api/products and PATCH /api/products/[id] enforce. */
export const BARCODE_PATTERN = /^\d{8,14}$/;

const positiveInteger = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

/**
 * Client-side check of one product form. The server repeats it and stays
 * authoritative; this copy exists so the message lands under its own field.
 */
export function validateProductForm(values: ProductFormValues): ProductFormError[] {
  const errors: ProductFormError[] = [];

  const barcode = values.barcode.trim();
  if (!barcode) errors.push({ field: "barcode", message: "Введите штрих-код — от 8 до 14 цифр." });
  else if (!BARCODE_PATTERN.test(barcode)) errors.push({ field: "barcode", message: "Штрих-код — от 8 до 14 цифр, без пробелов и букв." });

  if (!values.name.trim()) errors.push({ field: "name", message: "Введите название товара." });

  if (values.mode === "manufacture") {
    if (!values.manufacturingDate) errors.push({ field: "manufacture", message: "Укажите дату изготовления." });
    if (!values.shelfLife.trim()) errors.push({ field: "shelfLife", message: "Укажите срок хранения." });
    else if (!positiveInteger(values.shelfLife)) errors.push({ field: "shelfLife", message: "Срок хранения — целое число больше нуля." });
    else if (values.manufacturingDate && !calculateExpiryDate(values.manufacturingDate, values.shelfLife, values.shelfLifeUnit)) {
      errors.push({ field: "shelfLife", message: "Срок не рассчитан: проверьте дату изготовления." });
    }
  }

  const quantity = values.quantity.trim();
  if (quantity && !positiveInteger(quantity)) errors.push({ field: "quantity", message: "Количество — целое число больше нуля." });

  return errors;
}

/** The message for one field, or an empty string when the field is valid. */
export function fieldError(errors: ReadonlyArray<ProductFormError>, field: ProductFormField): string {
  return errors.find((error) => error.field === field)?.message ?? "";
}
