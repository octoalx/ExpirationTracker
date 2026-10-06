import React, { useState, type FormEvent } from "react";
import { format, differenceInDays } from "date-fns";
import { expiryDays } from "@/lib/expiry-calendar";
import { ru } from "date-fns/locale";
import {
  CalendarCheck,
  Clock,
  AlertCircle,
  CheckCircle,
  Trash2,
  Barcode,
  Calendar,
  Pencil,
  Loader2,
  Package,
} from "lucide-react";
import toast from "react-hot-toast";
import { Product } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductCardProps {
  product: Product;
  onProductDeleted: (id: string) => void;
  onProductConsumed: (product: Product) => void;
  onProductUpdated: (product: Product) => void;
}

/** Card displaying a single product with status, expiry info, and action buttons. */
function ProductCard({
  product,
  onProductDeleted,
  onProductConsumed,
  onProductUpdated
}: ProductCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editBarcode, setEditBarcode] = useState(product.barcode);
  const [editExpiryDate, setEditExpiryDate] = useState(
    product.expiryDate ? format(new Date(product.expiryDate), "yyyy-MM-dd") : ""
  );
  const [isSaving, setIsSaving] = useState(false);

  const daysLeft = expiryDays(product.expiryDate) ?? Number.POSITIVE_INFINITY;
  const isExpired = daysLeft < 0;

  const getStatusConfig = () => {
    if (!product.expiryDate) return { stripeColor: "bg-slate-300", icon: Calendar,
      iconColor: "text-slate-400", statusText: "Срок не указан", statusColor: "text-slate-500" };
    if (isExpired) {
      return {
        stripeColor: "bg-red-500",
        icon: AlertCircle,
        iconColor: "text-red-600",
        statusText: "Просрочен",
        statusColor: "text-red-600"
      };
    }
    if (daysLeft <= 3) {
      return {
        stripeColor: "bg-expiry-soft0",
        icon: Clock,
        iconColor: "text-expiry-ink",
        statusText: `Осталось ${daysLeft} ${getDaysText(daysLeft)}`,
        statusColor: "text-expiry-ink"
      };
    }
    if (daysLeft <= 7) {
      return {
        stripeColor: "bg-expiry-soft0",
        icon: Clock,
        iconColor: "text-expiry-ink",
        statusText: `Осталось ${daysLeft} ${getDaysText(daysLeft)}`,
        statusColor: "text-expiry-ink"
      };
    }
    if (daysLeft <= 30) {
      return {
        stripeColor: "bg-blue-400",
        icon: CalendarCheck,
        iconColor: "text-blue-600",
        statusText: `Осталось ${daysLeft} ${getDaysText(daysLeft)}`,
        statusColor: "text-blue-600"
      };
    }
    return {
      stripeColor: "bg-blue-600",
      icon: CalendarCheck,
      iconColor: "text-blue-600",
      statusText: `Осталось ${daysLeft} ${getDaysText(daysLeft)}`,
      statusColor: "text-blue-600"
    };
  };

  const getDaysText = (days: number): string => {
    const lastDigit = days % 10;
    const lastTwoDigits = days % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "дней";
    if (lastDigit === 1) return "день";
    if (lastDigit >= 2 && lastDigit <= 4) return "дня";
    return "дней";
  };

  const openEdit = () => {
    setEditName(product.name);
    setEditBarcode(product.barcode);
    setEditExpiryDate(product.expiryDate ? format(new Date(product.expiryDate), "yyyy-MM-dd") : "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, barcode: editBarcode, expiryDate: editExpiryDate, version: product.version }),
      });
      if (res.ok) {
        const updated: Product = await res.json();
        toast.success("Товар обновлён");
        onProductUpdated(updated);
        setIsEditOpen(false);
      } else {
        toast.error("Не удалось обновить товар");
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsSaving(false);
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <>
      <div className={cn(
        "relative bg-white rounded-xl",
        "border border-slate-200",
        "flex flex-col min-h-[280px] h-full",
        "transition-all duration-300 ease-out",
        "overflow-hidden"
      )}>
        {/* Top color stripe indicating urgency */}
        <div className={cn("h-1.5 w-full", config.stripeColor)} />

        {/* Edit button */}
        <button
          onClick={openEdit}
          aria-label="Редактировать товар"
          className={cn(
            "absolute top-3.5 right-3.5 z-10",
            "w-7 h-7 flex items-center justify-center rounded-lg",
            "bg-slate-100 text-slate-400",
            "transition-all duration-200",
            "hover:bg-blue-50 hover:text-blue-600",
            "active:scale-90"
          )}
        >
          <Pencil size={13} />
        </button>

        <div className="p-4 flex flex-col h-full justify-between">
          {/* Status and date row */}
          <div className="flex items-center justify-between gap-2 pr-8">
            <div className="flex items-center gap-1.5 min-w-0">
              <StatusIcon className={cn("w-4 h-4 shrink-0", config.iconColor)} />
              <span className={cn("text-sm font-medium truncate", config.statusColor)}>
                {config.statusText}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400 font-medium whitespace-nowrap">
              <Calendar className="w-3 h-3" />
              {product.expiryDate ? format(new Date(product.expiryDate), "dd.MM.yyyy", { locale: ru }) : "—"}
            </div>
          </div>

          {/* Product name */}
          <h3 className="mt-3 font-bold text-slate-800 text-base leading-tight line-clamp-2 min-h-10">
            {product.name}
          </h3>

          {/* Barcode */}
          <div className="mt-2 flex items-start gap-1.5">
            <Barcode className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs text-slate-400 font-mono tracking-wider truncate">
              {product.barcode}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-2 w-full justify-center">
            <button
              onClick={() => onProductConsumed(product)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5",
                "bg-blue-50 text-blue-700",
                "py-2.5 px-3 rounded-xl text-sm font-medium",
                "transition-all duration-200",
                "hover:bg-blue-100 hover:shadow-sm",
                "active:scale-95"
              )}
            >
              <CheckCircle size={14} />
              Использовано
            </button>
            <button
              onClick={() => onProductDeleted(product.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5",
                "bg-red-50 text-red-600",
                "py-2.5 px-3 rounded-xl text-sm font-medium",
                "transition-all duration-200",
                "hover:bg-red-100 hover:shadow-sm",
                "active:scale-95"
              )}
            >
              <Trash2 size={14} />
              Удалить
            </button>
          </div>
        </div>
      </div>

      {/* Edit product dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать товар</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-5 mt-1">
            {/* Product name */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Package size={14} />
                Название продукта
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                placeholder="Название продукта"
              />
            </div>

            {/* Barcode */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Barcode size={14} />
                Штрих-код
              </label>
              <input
                type="text"
                value={editBarcode}
                onChange={(e) => setEditBarcode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-mono tracking-wider"
                placeholder="Штрих-код"
              />
            </div>

            {/* Expiry date */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Calendar size={14} />
                Дата окончания срока годности
              </label>
              <input
                type="date"
                value={editExpiryDate}
                onChange={(e) => setEditExpiryDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>

            <div className="border-t border-slate-100 pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? (
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
        </DialogContent>
      </Dialog>
    </>
  );
}

export default React.memo(ProductCard, (prevProps, nextProps) => {
  // Only re-render if product data changed
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.barcode === nextProps.product.barcode &&
    prevProps.product.expiryDate === nextProps.product.expiryDate &&
    prevProps.product.status === nextProps.product.status
  );
});
