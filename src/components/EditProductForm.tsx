"use client";

import { useState, type FormEvent } from "react";
import { format } from "date-fns";
import { Loader2, Barcode, Package, Calendar, X, Hash } from "lucide-react";
import toast from "react-hot-toast";
import { Product } from "@prisma/client";

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
  const [barcode, setBarcode] = useState(product.barcode || "");
  const [name, setName] = useState(product.name);
  const [quantity, setQuantity] = useState<number | "">(product.quantity ?? "");
  const [expiryDate, setExpiryDate] = useState(
    product.expiryDate ? format(new Date(product.expiryDate), "yyyy-MM-dd") : ""
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Введите название продукта");
      return;
    }
    if (!expiryDate) {
      toast.error("Введите срок годности");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          barcode: barcode.trim() || null,
          expiryDate: new Date(expiryDate).toISOString(),
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Barcode */}
      <div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Barcode size={14} />
          Штрих-код
        </label>
        <input
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          placeholder="Например: 4601234567890"
        />
      </div>

      {/* Product name */}
      <div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Package size={14} />
          Название продукта
        </label>
        <input
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
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Hash size={14} />
          Количество <span className="text-slate-400 font-normal normal-case">(опционально)</span>
        </label>
        <input
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
      <div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Calendar size={14} />
          Срок годности
        </label>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
          required
        />
      </div>

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
          className="flex-1 bg-blue-700 hover:bg-blue-800  text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
