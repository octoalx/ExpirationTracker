import React, { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import type { Product } from "@prisma/client";
import { Loader2, ScanBarcode, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import BarcodeCamera from "./BarcodeCamera";
import { calculateExpiryDate, type ShelfLifeUnit } from "@/lib/shelf-life";
import { interactionFeedback } from "@/lib/interaction-feedback";
import { useKeyboardInset } from "@/lib/keyboard-inset";

interface AddProductFormProps { onProductAdded: (product: Product) => void; initialBarcode?: string }

/** Focused registration with catalog lookup and an explicit calculated-date preview. */
export default function AddProductForm({ onProductAdded, initialBarcode = "" }: AddProductFormProps) {
  useKeyboardInset();
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
  const [error, setError] = useState("");
  const [isLookingUp, setLookingUp] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
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
  const onDetected = useCallback((code: string) => { setBarcode(code); setName(""); setCameraOpen(false); interactionFeedback("scan"); void lookupBarcode(code); }, [lookupBarcode]);
  const calculatedExpiry = calculateExpiryDate(manufacturingDate, shelfLife, shelfLifeUnit);
  const selectedExpiry = dateInputType === "manufacture" ? calculatedExpiry : expiryDate;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving.current) return;
    if (dateInputType === "manufacture" && !calculatedExpiry) { setError("Укажите дату изготовления и положительный целый срок хранения."); return; }
    saving.current = true; setIsLoading(true); setError("");
    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), barcode: barcode.trim(), expiryDate: selectedExpiry, manufacturingDate: dateInputType === "manufacture" ? manufacturingDate : null, shelfLife: dateInputType === "manufacture" ? Number(shelfLife) : null, shelfLifeUnit: dateInputType === "manufacture" ? shelfLifeUnit : null, ...(quantity ? { quantity: Number(quantity) } : {}) }) });
      if (!response.ok) throw new Error("Не удалось сохранить товар. Введённые данные сохранены в форме.");
      const product: Product = await response.json(); interactionFeedback("save"); toast.success(`${product.name} — товар сохранён`); onProductAdded(product);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Ошибка сети. Проверьте подключение и повторите сохранение."); }
    finally { saving.current = false; setIsLoading(false); }
  }

  return <form onSubmit={handleSubmit} className="product-entry space-y-5">
    <fieldset disabled={isLoading} className="space-y-5">
      <details open={!initialBarcode}><summary className="min-h-11 cursor-pointer py-2 text-sm text-slate-600">Штрих-код{barcode && ` · ${barcode}`}</summary><div><label htmlFor="add-barcode">Штрих-код</label><div className="flex gap-2"><input id="add-barcode" inputMode="numeric" value={barcode} placeholder="Введите или отсканируйте код" onChange={event => { barcodeVersion.current++; setLookingUp(false); setBarcode(event.target.value); setName(""); setCatalogMessage(""); }} />
        <button type="button" aria-label="Сканировать штрих-код" className="entry-icon" disabled={cameraOpen || isLookingUp} onClick={() => setCameraOpen(true)}><ScanBarcode /></button></div>
        <button type="button" className="entry-link" disabled={isLookingUp || !barcode.trim()} onClick={() => void lookupBarcode(barcode)}>{isLookingUp ? "Поиск названия…" : "Найти название в каталоге"}</button>
        {cameraOpen && <BarcodeCamera onDetected={onDetected} onClose={closeCamera} />}
      </div></details>
      <div><label htmlFor="add-name">Название товара</label><input id="add-name" required value={name} onChange={event => { barcodeVersion.current++; setLookingUp(false); setCatalogMessage(""); setName(event.target.value); }} placeholder="Например: Герметик силиконовый" />{isLookingUp && <p role="status" className="mt-2 text-sm text-slate-600">Ищем название в каталоге…</p>}{catalogMessage && <p role="status" className="mt-2 text-sm text-slate-600">{catalogMessage}</p>}</div>
      <div className="entry-segment" role="group" aria-label="Способ указания срока"><button type="button" aria-pressed={dateInputType === "expiry"} onClick={() => setDateInputType("expiry")}>Годен до</button><button type="button" aria-pressed={dateInputType === "manufacture"} onClick={() => setDateInputType("manufacture")}>Изготовлен</button></div>
      {dateInputType === "expiry" ? <div><label htmlFor="add-expiry">Дата окончания срока <span className="text-slate-500">(необязательно)</span></label><input id="add-expiry" type="date" value={expiryDate} onChange={event => setExpiryDate(event.target.value)} /></div> : <>
        <div><label htmlFor="add-manufacture">Дата изготовления</label><input id="add-manufacture" type="date" required value={manufacturingDate} onChange={event => setManufacturingDate(event.target.value)} /></div>
        <div><label htmlFor="add-duration">Срок хранения</label><div className="entry-duration flex gap-2"><input id="add-duration" type="number" inputMode="numeric" min="1" step="1" required className="shrink-0" value={shelfLife} onChange={event => setShelfLife(event.target.value)} placeholder="6" /><div className="entry-segment flex-1" role="group" aria-label="Единицы срока">{([["days", "Дни"], ["weeks", "Недели"], ["months", "Месяцы"]] as const).map(([unit, label]) => <button key={unit} type="button" aria-pressed={shelfLifeUnit === unit} onClick={() => setShelfLifeUnit(unit)}>{label}</button>)}</div></div></div>
        <div className="expiry-preview" role="status"><span>Годен до</span><strong>{calculatedExpiry ? format(parseISO(calculatedExpiry), "dd.MM.yyyy") : "Укажите дату и срок"}</strong>{calculatedExpiry && <CheckCircle2 aria-hidden="true" className="size-5 text-blue-700" />}</div>
      </>}
      <div><label htmlFor="add-quantity">Количество <span className="text-slate-500">(необязательно)</span></label><input id="add-quantity" type="number" inputMode="numeric" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="Например: 3" /></div>
    </fieldset>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button type="submit" className="primary-action w-full" disabled={isLoading || isLookingUp || cameraOpen}>{isLoading ? <><Loader2 className="size-5 animate-spin" />Сохраняем…</> : "Сохранить товар"}</button>
  </form>;
}
