import { Product } from "@prisma/client";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { getExpiryStatus, ExpiryStatus } from "../lib/utils";
import { Trash2, CheckCircle, Undo2, ScanBarcode } from "lucide-react";

interface ProductCardProps {
  product: Product;
  onProductDeleted: (productId: string) => void;
  onProductConsumed: (product: Product) => void;
  onProductMovedToActive: (product: Product) => void;
  settings: { urgentThreshold: number; warningThreshold: number };
}

const statusColors: Record<
  ExpiryStatus,
  { bg: string; text: string; border: string; dot: string; progress: string }
> = {
  urgent: {
    bg: "bg-rose-100",
    text: "text-rose-800",
    border: "border-rose-500",
    dot: "bg-rose-500",
    progress: "bg-rose-500",
  },
  warning: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-500",
    dot: "bg-amber-500",
    progress: "bg-amber-500",
  },
  safe: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-500",
    dot: "bg-emerald-500",
    progress: "bg-emerald-500",
  },
  expired: {
    bg: "bg-gray-200",
    text: "text-gray-600",
    border: "border-gray-400",
    dot: "bg-gray-400",
    progress: "bg-gray-400",
  },
};

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onProductDeleted,
  onProductConsumed,
  onProductMovedToActive,
  settings,
}) => {
  if (!settings) {
    return null;
  }

  const expiryDate = new Date(product.expiryDate);
  const now = new Date();
  const totalDays = differenceInDays(expiryDate, new Date(product.createdAt));
  const daysLeft = differenceInDays(expiryDate, now);
  const progressPercentage =
    totalDays > 0 ? Math.max(0, (daysLeft / totalDays) * 100) : 0;

  const status = getExpiryStatus(
    expiryDate,
    settings.urgentThreshold,
    settings.warningThreshold,
  );
  const colors = statusColors[status];

  const badgeText = () => {
    if (status === "expired") {
      return `Истек срок годности ${format(expiryDate, "dd.MM.yyyy")}`;
    }
    return `Истекает через ${formatDistanceToNow(expiryDate, {
      locale: ru,
    })} (${format(expiryDate, "dd.MM.yyyy")})`;
  };

  const handleConsume = async () => {
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONSUMED" }),
    });
    if (res.ok) {
      const updatedProduct = await res.json();
      onProductConsumed(updatedProduct);
    }
  };

  const handleMoveToActive = async () => {
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    if (res.ok) {
      const updatedProduct = await res.json();
      onProductMovedToActive(updatedProduct);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/products/${product.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onProductDeleted(product.id);
    }
  };

  return (
    <div
      className={`relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group`}
    >
      <div className="p-4 flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <span className={`w-3 h-3 rounded-full ${colors.dot}`}></span>
          <p className={`font-bold text-lg text-slate-800`}>{product.name}</p>
        </div>
        <div className="flex items-center space-x-1 text-sm text-gray-400">
          <ScanBarcode size={16} />
          <span>{product.barcode}</span>
        </div>
        <p className="text-sm text-gray-500">{badgeText()}</p>

        {/* Buttons */}
        <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {product.status === "CONSUMED" ? (
            <button
              onClick={handleMoveToActive}
              className="p-2 bg-transparent text-blue-500 hover:bg-blue-100 rounded-full"
              title="Вернуть в активные"
            >
              <Undo2 size={20} />
            </button>
          ) : (
            <button
              onClick={handleConsume}
              className="p-2 bg-transparent text-green-500 hover:bg-green-100 rounded-full"
              title="Использовать"
            >
              <CheckCircle size={20} />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-2 bg-transparent text-red-500 hover:bg-red-100 rounded-full"
            title="Удалить"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-200">
        <div
          className={`h-1 ${colors.progress}`}
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProductCard;
