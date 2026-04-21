import { useState, useEffect } from "react";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { Loader2, Barcode, Calendar, Package } from "lucide-react";

const AddProductForm = ({ onProductAdded }) => {
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dateInputType, setDateInputType] = useState<"expiry" | "manufacture">(
    "expiry",
  );
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [shelfLife, setShelfLife] = useState("");
  const [shelfLifeUnit, setShelfLifeUnit] = useState<
    "days" | "weeks" | "months"
  >("months");

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const productData = { name, barcode, expiryDate };
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productData),
    });
    if (res.ok) {
      onProductAdded(await res.json());
      setBarcode("");
      setName("");
      setExpiryDate("");
      setManufacturingDate("");
      setShelfLife("");
    }
  };

  const inputStyles =
    "bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 transition-all duration-300 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100/50 focus:shadow-inner";
  const labelStyles =
    "text-slate-600 font-semibold text-xs uppercase tracking-wider mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Barcode Input */}
      <div>
        <label htmlFor="barcode" className={labelStyles}>
          Штрих-код
        </label>
        <div className="relative">
          <Barcode
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            id="barcode"
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className={`${inputStyles} pl-10`}
            placeholder="8000500310427"
          />
          {isLoading && (
            <Loader2 className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          )}
        </div>
      </div>

      {/* Name Input */}
      <div>
        <label htmlFor="name" className={labelStyles}>
          Название продукта
        </label>
        <div className="relative">
          <Package
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputStyles} pl-10`}
            placeholder="Герметик"
            required
          />
        </div>
      </div>

      {/* Date Calculation Type */}
      <div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="expiry"
              checked={dateInputType === "expiry"}
              onChange={() => setDateInputType("expiry")}
              className="accent-emerald-600"
            />
            <span className={labelStyles}>Срок годности</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="manufacture"
              checked={dateInputType === "manufacture"}
              onChange={() => setDateInputType("manufacture")}
              className="accent-emerald-600"
            />
            <span className={labelStyles}>Дата изготовления</span>
          </label>
        </div>
      </div>

      <div className="min-h-30">
        {dateInputType === "expiry" ? (
          <div>
            <label htmlFor="expiryDate" className={labelStyles}>
              Дата окончания срока годности
            </label>
            <div className="relative">
              <Calendar
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={20}
              />
              <input
                id="expiryDate"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={`${inputStyles} pl-10`}
                required
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="manufacturingDate" className={labelStyles}>
                Дата изготовления
              </label>
              <input
                id="manufacturingDate"
                type="date"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                className={inputStyles}
                required
              />
            </div>
            <div>
              <label htmlFor="shelfLife" className={labelStyles}>
                Срок годности
              </label>
              <div className="flex flex-wrap sm:flex-nowrap">
                <input
                  id="shelfLife"
                  type="number"
                  value={shelfLife}
                  onChange={(e) => setShelfLife(e.target.value)}
                  className={`${inputStyles} rounded-r-none z-10 min-w-0`}
                  required
                />
                <select
                  value={shelfLifeUnit}
                  onChange={(e) => setShelfLifeUnit(e.target.value as any)}
                  /* Добавляем w-[140px] для фиксации ширины и focus:z-20 для рамки */
                  className={`${inputStyles} rounded-l-none -ml-px w-35 shrink-0 focus:z-20 relative`}
                >
                  <option value="days">Дней</option>
                  <option value="weeks">Недель</option>
                  <option value="months">Месяцев</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-bold transition-all shadow-lg shadow-emerald-200/70 hover:shadow-emerald-300 hover:scale-[1.02] transform"
      >
        Добавить товар
      </button>
    </form>
  );
};

export default AddProductForm;
