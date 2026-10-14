"use client";

import { useState, type FormEvent } from "react";
import { expiryLabel, expiryDisplay } from "@/lib/expiry-calendar";
import { Loader2, Barcode, Package, Calendar, X, Hash } from "lucide-react";
import toast from "react-hot-toast";
import { Product } from "@prisma/client";
import { calculateExpiryDate, type ShelfLifeUnit } from "@/lib/shelf-life";
import { useKeyboardInset } from "@/lib/keyboard-inset";

interface EditProductFormProps {
  product: Product;
  onProductUpdated: (product: Product) => void;
  onCancel: () => void;
}

/** Inline form for editing an existing product's barcode, name, quantity, and expiry date. */
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
  const [dateInputType, setDateInputType] = useState(product.manufacturingDate ? "manufacture" : "expiry");
  const [manufacturingDate, setManufacturingDate] = useState(product.manufacturingDate ?? "");
  const [shelfLife, setShelfLife] = useState(String(product.shelfLife ?? ""));
  const [shelfLifeUnit, setShelfLifeUnit] = useState<ShelfLifeUnit>((product.shelfLifeUnit as ShelfLifeUnit) || "months");
  const calculatedExpiry = calculateExpiryDate(manufacturingDate, shelfLife, shelfLifeUnit);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Введите название продукта");
      return;
    }
    if (dateInputType === "manufacture" && !calculatedExpiry) {
      toast.error("Укажите дату изготовления и положительный целый срок хранения.");
      return;
    }

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
      } else {
        const error = await res.json();
        toast.error(error.message || "Ошибка при обновлении");
      }
    } catch (error) {
      toast.error("Ошибка при обновлении товара");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="product-entry min-w-0 space-y-6">
      {/* Barcode */}
      <div>
        <label htmlFor="edit-barcode" className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Barcode size={14} />
          Штрих-код
        </label>
        <input
          id="edit-barcode"
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          placeholder="Например: 4601234567890"
        />
      </div>

      {/* Product name */}
      <div>
        <label htmlFor="edit-name" className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Package size={14} />
          Название продукта
        </label>
        <input
          id="edit-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          placeholder="Введите название"
          required
        />
      </div>

      {/* Quantity */}
      <div>
        <label htmlFor="edit-quantity" className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Hash size={14} />
          Количество <span className="text-slate-400 font-normal normal-case">(опционально)</span>
        </label>
        <input
          id="edit-quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => {
            const val = e.target.value;
            setQuantity(val === "" ? "" : parseInt(val, 10));
          }}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          placeholder="Например: 5"
        />
      </div>

      {/* Expiry date */}
      <div className="entry-segment" role="group" aria-label="Способ указания срока">
        <button type="button" aria-pressed={dateInputType === "expiry"} onClick={() => setDateInputType("expiry")}>Годен до</button>
        <button type="button" aria-pressed={dateInputType === "manufacture"} onClick={() => setDateInputType("manufacture")}>Изготовлен</button>
      </div>
      {dateInputType === "manufacture" ? <>
        <div><label htmlFor="edit-manufacture">Дата изготовления</label><input id="edit-manufacture" type="date" required value={manufacturingDate} onChange={event => setManufacturingDate(event.target.value)} /></div>
        <div><label htmlFor="edit-duration">Срок хранения</label><div className="entry-duration flex gap-2"><input id="edit-duration" type="number" min="1" step="1" required value={shelfLife} onChange={event => setShelfLife(event.target.value)} /><div className="entry-segment flex-1" role="group" aria-label="Единицы срока">{([["days", "Дни"], ["weeks", "Недели"], ["months", "Месяцы"]] as const).map(([unit, label]) => <button key={unit} type="button" aria-pressed={shelfLifeUnit === unit} onClick={() => setShelfLifeUnit(unit)}>{label}</button>)}</div></div></div>
        <p role="status">Годен до: {calculatedExpiry ? expiryDisplay(calculatedExpiry) : "Укажите дату и срок"}</p>
      </> :
      <div>
        <label htmlFor="edit-expiry" className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Calendar size={14} />
          Срок годности (необязательно)
        </label>
        <input
          id="edit-expiry"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
        />
      </div>}

      {/* Separator */}
      <div className="border-t border-slate-100 my-4" />

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all disabled:opacity-60"
        >
          <span className="flex items-center justify-center gap-2">
            <X className="h-4 w-4" />
            Отмена
          </span>
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-[#1554b5] hover:bg-[#12479a] text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Сохранение...
            </span>
          ) : (
            "Сохранить"
          )}
        </button>
      </div>
    </form>
  );
}
