import { useState, useEffect, type FormEvent } from "react";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { Loader2, Barcode, Package, Calendar, Factory, Hash } from "lucide-react";
import toast from "react-hot-toast";

interface AddProductFormProps {
  onProductAdded: (product: Record<string, unknown>) => void;
  initialBarcode?: string;
}

type DateInputType = "expiry" | "manufacture";
type ShelfLifeUnit = "days" | "weeks" | "months";

export default function AddProductForm({
  onProductAdded,
  initialBarcode = "",
}: AddProductFormProps) {
  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dateInputType, setDateInputType] = useState<DateInputType>("expiry");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [shelfLife, setShelfLife] = useState("");
  const [shelfLifeUnit, setShelfLifeUnit] = useState<ShelfLifeUnit>("months");

  // Автоматический расчёт срока годности
  useEffect(() => {
    if (
      dateInputType === "manufacture" &&
      manufacturingDate &&
      shelfLife &&
      shelfLifeUnit
    ) {
      const startDate = new Date(manufacturingDate);
      const life = parseInt(shelfLife, 10);
      let endDate;
      if (shelfLifeUnit === "days") endDate = addDays(startDate, life);
      else if (shelfLifeUnit === "weeks") endDate = addWeeks(startDate, life);
      else endDate = addMonths(startDate, life);
      setExpiryDate(format(endDate, "yyyy-MM-dd"));
    }
  }, [dateInputType, manufacturingDate, shelfLife, shelfLifeUnit]);

  useEffect(() => {
    if (initialBarcode) setBarcode(initialBarcode);
  }, [initialBarcode]);

  const resetForm = () => {
    setBarcode("");
    setName("");
    setQuantity("");
    setExpiryDate("");
    setManufacturingDate("");
    setShelfLife("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const productData: { name: string; barcode: string; expiryDate: string; quantity?: number } = { name, barcode, expiryDate };
      if (quantity !== "" && quantity > 0) {
        productData.quantity = quantity;
      }
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Товар добавлен!");
        resetForm();
        onProductAdded(data);
      } else {
        toast.error("Не удалось добавить товар");
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Штрих-код */}
      <div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Barcode size={14} />
          Штрих-код
        </label>
        <input
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          placeholder="Например: 4601234567890"
        />
      </div>

      {/* Название */}
      <div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Package size={14} />
          Название продукта
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          placeholder="Например: Цемент М500"
          required
        />
      </div>

      {/* Количество */}
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
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          placeholder="Например: 5"
        />
      </div>

      {/* Разделитель */}
      <div className="border-t border-slate-100 my-4" />

      {/* Способ указания даты */}
      <div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          <Calendar size={14} />
          Способ указания даты
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="expiry"
              checked={dateInputType === "expiry"}
              onChange={() => setDateInputType("expiry")}
              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700">Срок годности</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="manufacture"
              checked={dateInputType === "manufacture"}
              onChange={() => setDateInputType("manufacture")}
              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700">Дата изготовления</span>
          </label>
        </div>
      </div>

      {/* Поля в зависимости от выбора */}
      {dateInputType === "expiry" ? (
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            <Calendar size={14} />
            Дата окончания срока годности
          </label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
            required
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <Factory size={14} />
              Дата изготовления
            </label>
            <input
              type="date"
              value={manufacturingDate}
              onChange={(e) => setManufacturingDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
              required
            />
          </div>

          <div>
  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
    Срок хранения
  </label>
  <div className="flex gap-3">
    <input
      type="number"
      value={shelfLife}
      onChange={(e) => setShelfLife(e.target.value)}
      className="w-28 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
      placeholder="Кол-во"
    />
    
    <div className="flex-1 grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => setShelfLifeUnit("days")}
        className={`py-3 rounded-xl text-sm font-medium transition-all ${
          shelfLifeUnit === "days"
            ? "bg-emerald-600 text-white shadow-md"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        Дни
      </button>
      <button
        type="button"
        onClick={() => setShelfLifeUnit("weeks")}
        className={`py-3 rounded-xl text-sm font-medium transition-all ${
          shelfLifeUnit === "weeks"
            ? "bg-emerald-600 text-white shadow-md"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        Недели
      </button>
      <button
        type="button"
        onClick={() => setShelfLifeUnit("months")}
        className={`py-3 rounded-xl text-sm font-medium transition-all ${
          shelfLifeUnit === "months"
            ? "bg-emerald-600 text-white shadow-md"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        Месяцы
      </button>
    </div>
  </div>
</div>
        </div>
      )}

      {/* Разделитель */}
      <div className="border-t border-slate-100 my-4" />

      {/* Кнопка отправки */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Добавление...
          </span>
        ) : (
          "Добавить товар"
        )}
      </button>
    </form>
  );
}