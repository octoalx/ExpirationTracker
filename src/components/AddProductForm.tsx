import React, { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import type { Product } from "@prisma/client";
import { Loader2, ScanBarcode, CheckCircle2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import BarcodeCamera from "./BarcodeCamera";
import { calculateExpiryDate, type ShelfLifeUnit } from "@/lib/shelf-life";
import { interactionFeedback } from "@/lib/interaction-feedback";
import { useKeyboardInset } from "@/lib/keyboard-inset";
import { useIsDesktop } from "@/lib/media-query";
import { fieldError, validateProductForm, type ProductFormError } from "@/lib/product-form";

interface AddProductFormProps {
  onProductAdded: (product: Product) => void;
  initialBarcode?: string;
  /** Closes the dialog from the pinned action block; the header cross stays too. */
  onCancel?: () => void;
}

/** Field order follows the scanner flow: code, name, expiry route, dates, quantity. */
export default function AddProductForm({ onProductAdded, initialBarcode = "", onCancel }: AddProductFormProps) {
  useKeyboardInset();
  /** Same rule as the dashboard: the camera entry point exists on the phone only. */
  const isDesktop = useIsDesktop();
  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dateInputType, setDateInputType] = useState<"expiry" | "manufacture">("expiry");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [shelfLife, setShelfLife] = useState("");
  const [shelfLifeUnit, setShelfLifeUnit] = useState<ShelfLifeUnit>("months");
  const [catalogMessage, setCatalogMessage] = useState("");
  const [errors, setErrors] = useState<ProductFormError[]>([]);
  const [serverError, setServerError] = useState("");
  const [isLookingUp, setLookingUp] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const barcodeVersion = useRef(0);
  const saving = useRef(false);
  const lookupBarcode = useCallback(async (code: string) => {
    const version = ++barcodeVersion.current;
    setLookingUp(true); setCatalogMessage("");
    try {
      const response = await fetch(`/api/catalog?barcode=${encodeURIComponent(code.trim())}`);
      const data = await response.json();
      if (version !== barcodeVersion.current) return;
      if (response.status === 404) { setCatalogMessage("В каталоге нет названия. Введите его вручную."); return; }
      if (!response.ok) throw new Error(data.error || "Не удалось прочитать каталог. Повторите поиск или введите название.");
      setName(data.name); setCatalogMessage("Название найдено. Укажите срок годности.");
    } catch (failure) {
      if (version === barcodeVersion.current) setCatalogMessage(failure instanceof Error ? failure.message : "Ошибка сети. Повторите поиск.");
    } finally { if (version === barcodeVersion.current) setLookingUp(false); }
  }, []);
  useEffect(() => { if (initialBarcode) void lookupBarcode(initialBarcode); return () => { barcodeVersion.current++; }; }, [initialBarcode, lookupBarcode]);
  const closeCamera = useCallback(() => setCameraOpen(false), []);
  useEffect(() => { if (isDesktop) setCameraOpen(false); }, [isDesktop]);
  const onDetected = useCallback((code: string) => { setBarcode(code); setName(""); setErrors([]); setCameraOpen(false); interactionFeedback("scan"); void lookupBarcode(code); }, [lookupBarcode]);
  const calculatedExpiry = calculateExpiryDate(manufacturingDate, shelfLife, shelfLifeUnit);
  const selectedExpiry = dateInputType === "manufacture" ? calculatedExpiry : expiryDate;
  const barcodeError = fieldError(errors, "barcode");
  const nameError = fieldError(errors, "name");
  const manufactureError = fieldError(errors, "manufacture");
  const shelfLifeError = fieldError(errors, "shelfLife");
  const quantityError = fieldError(errors, "quantity");

  /** The first refused field receives focus, so a phone user sees its message. */
  const focusFirstError = (found: ReadonlyArray<ProductFormError>) => {
    const ids: Record<string, string> = { barcode: "add-barcode", name: "add-name", manufacture: "add-manufacture", shelfLife: "add-duration", quantity: "add-quantity" };
    const id = ids[found[0]?.field ?? ""];
    if (id) formRef.current?.querySelector<HTMLInputElement>(`#${id}`)?.focus();
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving.current) return;
    const found = validateProductForm({ barcode, name, mode: dateInputType, manufacturingDate, shelfLife, shelfLifeUnit, quantity });
    setErrors(found); setServerError("");
    if (found.length > 0) { focusFirstError(found); return; }
    saving.current = true; setIsLoading(true);
    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), barcode: barcode.trim(), expiryDate: selectedExpiry, manufacturingDate: dateInputType === "manufacture" ? manufacturingDate : null, shelfLife: dateInputType === "manufacture" ? Number(shelfLife) : null, shelfLifeUnit: dateInputType === "manufacture" ? shelfLifeUnit : null, ...(quantity ? { quantity: Number(quantity) } : {}) }) });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? data?.error ?? "Не удалось сохранить товар. Введённые данные сохранены в форме.");
      }
      const product: Product = await response.json(); interactionFeedback("save"); toast.success(`${product.name} — товар сохранён`); onProductAdded(product);
    } catch (failure) { setServerError(failure instanceof Error ? failure.message : "Ошибка сети. Проверьте подключение и повторите сохранение."); }
    finally { saving.current = false; setIsLoading(false); }
  }

  return <form ref={formRef} onSubmit={handleSubmit} noValidate className="product-entry flex min-w-0 flex-col gap-5">
    <fieldset disabled={isLoading} className="flex min-w-0 flex-col gap-4">
      {/* 1. Barcode — the scanner writes here first. */}
      <div className="min-w-0">
        <label htmlFor="add-barcode">Штрих-код</label>
        <div className="flex min-w-0 gap-2">
          <input
            id="add-barcode"
            inputMode="numeric"
            autoComplete="off"
            value={barcode}
            placeholder="Введите или отсканируйте код"
            aria-invalid={barcodeError ? true : undefined}
            aria-describedby={barcodeError ? "add-barcode-error" : "add-barcode-hint"}
            onChange={event => { barcodeVersion.current++; setLookingUp(false); setBarcode(event.target.value); setName(""); setCatalogMessage(""); setErrors([]); }}
          />
          {!isDesktop && <button type="button" aria-label="Сканировать штрих-код" className="entry-icon md:hidden" disabled={cameraOpen || isLookingUp} onClick={() => setCameraOpen(true)}><ScanBarcode /></button>}
        </div>
        {barcodeError
          ? <p id="add-barcode-error" className="field-error">{barcodeError}</p>
          : <p id="add-barcode-hint" className="field-hint">8–14 цифр. На телефоне можно отсканировать камерой.</p>}
        {cameraOpen && <BarcodeCamera onDetected={onDetected} onClose={closeCamera} />}
        <button type="button" className="entry-link" disabled={isLookingUp || !barcode.trim()} onClick={() => void lookupBarcode(barcode)}>{isLookingUp ? "Поиск названия…" : "Найти название в каталоге"}</button>
        {isLookingUp && <p role="status" className="field-hint">Ищем название в каталоге…</p>}
        {catalogMessage && <p role="status" className="field-hint">{catalogMessage}</p>}
      </div>

      {/* 2. Name — filled by the catalog lookup or typed by hand. */}
      <div className="min-w-0">
        <label htmlFor="add-name">Название товара</label>
        <input
          id="add-name"
          value={name}
          placeholder="Например: Герметик силиконовый"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "add-name-error" : undefined}
          onChange={event => { barcodeVersion.current++; setLookingUp(false); setCatalogMessage(""); setName(event.target.value); setErrors([]); }}
        />
        {nameError && <p id="add-name-error" className="field-error">{nameError}</p>}
      </div>

      {/* 3. Expiry route. */}
      <div className="min-w-0">
        <span className="entry-label">Срок годности</span>
        <div className="entry-segment" role="group" aria-label="Способ указания срока">
          <button type="button" aria-pressed={dateInputType === "expiry"} onClick={() => { setDateInputType("expiry"); setErrors([]); }}>Годен до</button>
          <button type="button" aria-pressed={dateInputType === "manufacture"} onClick={() => { setDateInputType("manufacture"); setErrors([]); }}>Изготовлен</button>
        </div>
      </div>

      {/* 4. Dates for the chosen route; the calculated date updates as you type. */}
      {dateInputType === "expiry" ? <div className="min-w-0">
        <label htmlFor="add-expiry">Дата окончания срока <span className="field-optional">(необязательно)</span></label>
        <input id="add-expiry" type="date" value={expiryDate} onChange={event => setExpiryDate(event.target.value)} />
      </div> : <>
        <div className="min-w-0">
          <label htmlFor="add-manufacture">Дата изготовления</label>
          <input
            id="add-manufacture"
            type="date"
            value={manufacturingDate}
            aria-invalid={manufactureError ? true : undefined}
            aria-describedby={manufactureError ? "add-manufacture-error" : undefined}
            onChange={event => { setManufacturingDate(event.target.value); setErrors([]); }}
          />
          {manufactureError && <p id="add-manufacture-error" className="field-error">{manufactureError}</p>}
        </div>
        <div className="entry-duration min-w-0">
          <div className="min-w-0">
            <label htmlFor="add-duration">Срок хранения</label>
            <input
              id="add-duration"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={shelfLife}
              placeholder="6"
              aria-invalid={shelfLifeError ? true : undefined}
              aria-describedby={shelfLifeError ? "add-duration-error" : undefined}
              onChange={event => { setShelfLife(event.target.value); setErrors([]); }}
            />
          </div>
          <div className="entry-segment" role="group" aria-label="Единицы срока">
            {([["days", "Дни"], ["weeks", "Недели"], ["months", "Месяцы"]] as const).map(([unit, label]) => <button key={unit} type="button" aria-pressed={shelfLifeUnit === unit} onClick={() => setShelfLifeUnit(unit)}>{label}</button>)}
          </div>
          {shelfLifeError && <p id="add-duration-error" className="field-error">{shelfLifeError}</p>}
        </div>
        <div className="expiry-preview" role="status" aria-live="polite">
          <span>Годен до</span>
          <strong>{calculatedExpiry ? format(parseISO(calculatedExpiry), "dd.MM.yyyy") : "Укажите дату и срок"}</strong>
          {calculatedExpiry && <CheckCircle2 aria-hidden="true" className="size-5" />}
        </div>
      </>}

      {/* 5. Quantity. */}
      <div className="min-w-0">
        <label htmlFor="add-quantity">Количество <span className="field-optional">(необязательно)</span></label>
        <input
          id="add-quantity"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={quantity}
          placeholder="Например: 3"
          aria-invalid={quantityError ? true : undefined}
          aria-describedby={quantityError ? "add-quantity-error" : undefined}
          onChange={event => { setQuantity(event.target.value); setErrors([]); }}
        />
        {quantityError && <p id="add-quantity-error" className="field-error">{quantityError}</p>}
      </div>
    </fieldset>

    {serverError && <p role="alert" className="form-error"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{serverError}</p>}

    <div className="product-dialog-actions">
      {onCancel && <button type="button" className="dialog-action-secondary" disabled={isLoading} onClick={onCancel}>Отмена</button>}
      <button type="submit" className="primary-action dialog-action-primary" disabled={isLoading || isLookingUp || cameraOpen}>{isLoading ? <><Loader2 className="size-5 animate-spin" />Сохраняем…</> : "Сохранить товар"}</button>
    </div>
  </form>;
}
