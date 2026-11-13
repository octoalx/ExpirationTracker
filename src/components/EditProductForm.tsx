"use client";

import React, { useRef, useState, type FormEvent } from "react";
import { expiryLabel } from "@/lib/expiry-calendar";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { Product } from "@prisma/client";
import { format, parseISO } from "date-fns";
import { calculateExpiryDate, type ShelfLifeUnit } from "@/lib/shelf-life";
import { useKeyboardInset } from "@/lib/keyboard-inset";
import { fieldError, validateProductForm, type ProductFormError } from "@/lib/product-form";

interface EditProductFormProps {
  product: Product;
  onProductUpdated: (product: Product) => void;
  onCancel: () => void;
}

/** Dialog form for an existing record; the field order matches the add dialog. */
export default function EditProductForm({
  product,
  onProductUpdated,
  onCancel,
}: EditProductFormProps) {
  useKeyboardInset();
  const [barcode, setBarcode] = useState(product.barcode || "");
  const [name, setName] = useState(product.name);
  const [quantity, setQuantity] = useState<number | "">(product.quantity ?? "");
  const [expiryDate, setExpiryDate] = useState(
    expiryLabel(product.expiryDate) ?? ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [dateInputType, setDateInputType] = useState<"expiry" | "manufacture">(product.manufacturingDate ? "manufacture" : "expiry");
  const [manufacturingDate, setManufacturingDate] = useState(product.manufacturingDate ?? "");
  const [shelfLife, setShelfLife] = useState(String(product.shelfLife ?? ""));
  const [shelfLifeUnit, setShelfLifeUnit] = useState<ShelfLifeUnit>((product.shelfLifeUnit as ShelfLifeUnit) || "months");
  const [errors, setErrors] = useState<ProductFormError[]>([]);
  const [serverError, setServerError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const calculatedExpiry = calculateExpiryDate(manufacturingDate, shelfLife, shelfLifeUnit);
  const barcodeError = fieldError(errors, "barcode");
  const nameError = fieldError(errors, "name");
  const manufactureError = fieldError(errors, "manufacture");
  const shelfLifeError = fieldError(errors, "shelfLife");
  const quantityError = fieldError(errors, "quantity");

  const focusFirstError = (found: ReadonlyArray<ProductFormError>) => {
    const ids: Record<string, string> = { barcode: "edit-barcode", name: "edit-name", manufacture: "edit-manufacture", shelfLife: "edit-duration", quantity: "edit-quantity" };
    const id = ids[found[0]?.field ?? ""];
    if (id) formRef.current?.querySelector<HTMLInputElement>(`#${id}`)?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateProductForm({
      barcode,
      name,
      mode: dateInputType,
      manufacturingDate,
      shelfLife,
      shelfLifeUnit,
      quantity: quantity === "" ? "" : String(quantity),
    });
    setErrors(found);
    setServerError("");
    if (found.length > 0) { focusFirstError(found); return; }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: product.version,
          name: name.trim(),
          barcode: barcode.trim(),
          expiryDate: dateInputType === "manufacture" ? calculatedExpiry : expiryDate || null,
          manufacturingDate: dateInputType === "manufacture" ? manufacturingDate : null,
          shelfLife: dateInputType === "manufacture" ? Number(shelfLife) : null,
          shelfLifeUnit: dateInputType === "manufacture" ? shelfLifeUnit : null,
          quantity: quantity === "" ? null : quantity,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        toast.success("Товар обновлен");
        onProductUpdated(updated);
        return;
      }
      const payload = await res.json().catch(() => null);
      setServerError(payload?.message ?? payload?.error ?? "Не удалось сохранить изменения. Проверьте поля и повторите.");
    } catch {
      setServerError("Ошибка сети. Проверьте подключение и повторите сохранение.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="product-entry flex min-w-0 flex-col gap-5">
      <fieldset disabled={isLoading} className="flex min-w-0 flex-col gap-4">
        {/* 1. Barcode */}
        <div className="min-w-0">
          <label htmlFor="edit-barcode">Штрих-код</label>
          <input
            id="edit-barcode"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={barcode}
            placeholder="Например: 4601234567890"
            aria-invalid={barcodeError ? true : undefined}
            aria-describedby={barcodeError ? "edit-barcode-error" : undefined}
            onChange={(e) => { setBarcode(e.target.value); setErrors([]); }}
          />
          {barcodeError && <p id="edit-barcode-error" className="field-error">{barcodeError}</p>}
        </div>

        {/* 2. Name */}
        <div className="min-w-0">
          <label htmlFor="edit-name">Название товара</label>
          <input
            id="edit-name"
            type="text"
            value={name}
            placeholder="Например: Герметик силиконовый"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "edit-name-error" : undefined}
            onChange={(e) => { setName(e.target.value); setErrors([]); }}
          />
          {nameError && <p id="edit-name-error" className="field-error">{nameError}</p>}
        </div>

        {/* 3. Expiry route */}
        <div className="min-w-0">
          <span className="entry-label">Срок годности</span>
          <div className="entry-segment" role="group" aria-label="Способ указания срока">
            <button type="button" aria-pressed={dateInputType === "expiry"} onClick={() => { setDateInputType("expiry"); setErrors([]); }}>Годен до</button>
            <button type="button" aria-pressed={dateInputType === "manufacture"} onClick={() => { setDateInputType("manufacture"); setErrors([]); }}>Изготовлен</button>
          </div>
        </div>

        {/* 4. Dates for the chosen route */}
        {dateInputType === "manufacture" ? <>
          <div className="min-w-0">
            <label htmlFor="edit-manufacture">Дата изготовления</label>
            <input
              id="edit-manufacture"
              type="date"
              value={manufacturingDate}
              aria-invalid={manufactureError ? true : undefined}
              aria-describedby={manufactureError ? "edit-manufacture-error" : undefined}
              onChange={(event) => { setManufacturingDate(event.target.value); setErrors([]); }}
            />
            {manufactureError && <p id="edit-manufacture-error" className="field-error">{manufactureError}</p>}
          </div>
          <div className="entry-duration min-w-0">
            <div className="min-w-0">
              <label htmlFor="edit-duration">Срок хранения</label>
              <input
                id="edit-duration"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={shelfLife}
                placeholder="6"
                aria-invalid={shelfLifeError ? true : undefined}
                aria-describedby={shelfLifeError ? "edit-duration-error" : undefined}
                onChange={(event) => { setShelfLife(event.target.value); setErrors([]); }}
              />
            </div>
            <div className="entry-segment" role="group" aria-label="Единицы срока">
              {([["days", "Дни"], ["weeks", "Недели"], ["months", "Месяцы"]] as const).map(([unit, label]) => (
                <button key={unit} type="button" aria-pressed={shelfLifeUnit === unit} onClick={() => setShelfLifeUnit(unit)}>{label}</button>
              ))}
            </div>
            {shelfLifeError && <p id="edit-duration-error" className="field-error">{shelfLifeError}</p>}
          </div>
          <div className="expiry-preview" role="status" aria-live="polite">
            <span>Годен до</span>
            <strong>{calculatedExpiry ? format(parseISO(calculatedExpiry), "dd.MM.yyyy") : "Укажите дату и срок"}</strong>
            {calculatedExpiry && <CheckCircle2 aria-hidden="true" className="size-5" />}
          </div>
        </> : <div className="min-w-0">
          <label htmlFor="edit-expiry">Дата окончания срока <span className="field-optional">(необязательно)</span></label>
          <input
            id="edit-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>}

        {/* 5. Quantity */}
        <div className="min-w-0">
          <label htmlFor="edit-quantity">Количество <span className="field-optional">(необязательно)</span></label>
          <input
            id="edit-quantity"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={quantity}
            placeholder="Например: 5"
            aria-invalid={quantityError ? true : undefined}
            aria-describedby={quantityError ? "edit-quantity-error" : undefined}
            onChange={(e) => {
              const value = e.target.value;
              setQuantity(value === "" ? "" : parseInt(value, 10));
              setErrors([]);
            }}
          />
          {quantityError && <p id="edit-quantity-error" className="field-error">{quantityError}</p>}
        </div>
      </fieldset>

      {serverError && <p role="alert" className="form-error"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{serverError}</p>}

      <div className="product-dialog-actions">
        <button type="button" className="dialog-action-secondary" disabled={isLoading} onClick={onCancel}>Отмена</button>
        <button type="submit" className="primary-action dialog-action-primary" disabled={isLoading}>
          {isLoading ? <><Loader2 className="size-5 animate-spin" />Сохранение…</> : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
