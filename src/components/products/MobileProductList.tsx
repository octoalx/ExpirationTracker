import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@prisma/client";
import { format, differenceInDays, startOfDay } from "date-fns";
import { ArrowUpDown, ChevronDown, Pencil, Archive, AlertTriangle, CheckCircle2, Trash2, ScanBarcode, Circle, type LucideIcon } from "lucide-react";
import toast from "react-hot-toast";
import { cn, getExpiryStatus } from "@/lib/utils";
import { createPendingDeletes, type PendingDeletes } from "@/lib/pending-delete";
import { resolveSwipe, shouldStartDrag } from "@/lib/swipe-gesture";
import { DEFAULT_MOBILE_SORT, MOBILE_SORT_OPTIONS, formatDaysLeft, formatExpiredDaysLeft, sortProductsForMobile, type MobileSortOption } from "@/lib/days-left";
import { getProductActions, type ProductStatusActionKey } from "@/lib/product-status-actions";

interface Props {
  products: Product[];
  urgentThreshold?: number;
  warningThreshold?: number;
  referenceDate?: Date;
  onProductEdit?: (product: Product) => void;
  onProductDelete?: (product: Product) => void;
  /** Removes the product from the parent list after a successful DELETE. */
  onProductRemoved?: (productId: string) => void;
  onProductArchive?: (product: Product) => void;
  onProductDefect?: (product: Product) => void;
  onProductMoveToActive?: (product: Product) => void;
  /** Phone-list order. Controlled when provided; otherwise managed internally. */
  sortOption?: MobileSortOption;
  onSortChange?: (sort: MobileSortOption) => void;
}

const DELETE_DELAY_MS = 6000;
const ACTION_WIDTH = 96;
/** Corner radius (px) shared by the row card; the red layer slides under it. */
const CARD_RADIUS = 12;

/** Icon shown above each expandable-row action label. */
const ACTION_ICONS: Record<ProductStatusActionKey, LucideIcon> = {
  edit: Pencil,
  defect: AlertTriangle,
  active: CheckCircle2,
  archive: Archive,
};

/** Fill used when an action represents the product's current status. */
const SELECTED_ACTION_STYLES: Record<ProductStatusActionKey, string> = {
  edit: "",
  defect: "border-red-600 bg-red-600 text-white",
  active: "border-blue-600 bg-blue-600 text-white",
  archive: "border-slate-600 bg-slate-600 text-white",
};

interface GestureState {
  id: string;
  startX: number;
  startY: number;
  moved: boolean;
  /** Set once the gesture became a horizontal drag and captured the pointer. */
  captured: boolean;
}

/** Phone inventory: readable dates, swipe-to-delete with undo, progressive disclosure of actions. */
export default function MobileProductList(props: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ id: string; x: number } | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [internalSort, setInternalSort] = useState<MobileSortOption>(DEFAULT_MOBILE_SORT);
  const sortOption = props.sortOption ?? internalSort;
  const handleSortChange = (next: MobileSortOption) => {
    setInternalSort(next);
    props.onSortChange?.(next);
  };

  const productsRef = useRef(props.products);
  productsRef.current = props.products;
  const removedRef = useRef(props.onProductRemoved);
  removedRef.current = props.onProductRemoved;
  const fallbackDeleteRef = useRef(props.onProductDelete);
  fallbackDeleteRef.current = props.onProductDelete;
  const toastIdsRef = useRef(new Map<string, string>());

  const gestureRef = useRef<GestureState | null>(null);
  const suppressClickRef = useRef(false);

  const pendingRef = useRef<PendingDeletes | null>(null);
  if (!pendingRef.current) {
    pendingRef.current = createPendingDeletes({
      delayMs: DELETE_DELAY_MS,
      commit: async (id, { keepalive }) => {
        const product = productsRef.current.find((p) => p.id === id);
        try {
          const response = await fetch(`/api/products/${id}`, { method: "DELETE", keepalive });
          if (!response.ok) throw new Error("DELETE failed");
          const toastId = toastIdsRef.current.get(id);
          if (toastId) {
            toast.dismiss(toastId);
            toastIdsRef.current.delete(id);
          }
          setPendingIds((prev) => prev.filter((pendingId) => pendingId !== id));
          if (removedRef.current) removedRef.current(id);
          else if (product) fallbackDeleteRef.current?.(product);
        } catch (error) {
          toast.error("Не удалось удалить товар. Повторите попытку.");
          throw error;
        }
      },
      onRestore: (id) => {
        setPendingIds((prev) => prev.filter((pendingId) => pendingId !== id));
        const toastId = toastIdsRef.current.get(id);
        if (toastId) {
          toast.dismiss(toastId);
          toastIdsRef.current.delete(id);
        }
      },
    });
  }

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const flushPending = () => pending.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    window.addEventListener("pagehide", flushPending);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushPending);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  /* Close the open row when tapping anywhere outside it. */
  useEffect(() => {
    if (!openId) return;
    const onOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const row = target?.closest?.("[data-mobile-swipe-row]");
      if (row?.getAttribute("data-mobile-swipe-row") !== openId) setOpenId(null);
    };
    document.addEventListener("pointerdown", onOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", onOutsidePointerDown);
  }, [openId]);

  const scheduleDelete = useCallback((product: Product) => {
    const pending = pendingRef.current;
    if (!pending || pending.has(product.id)) return;
    setOpenId(null);
    setPendingIds((prev) => (prev.includes(product.id) ? prev : [...prev, product.id]));
    pending.schedule(product.id);
    const toastId = toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span>Товар удалён</span>
          <button
            type="button"
            className="min-h-9 rounded-md px-2 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            onClick={() => {
              pendingRef.current?.undo(product.id);
              toast.dismiss(t.id);
            }}
          >
            Отменить
          </button>
        </span>
      ),
      { duration: DELETE_DELAY_MS }
    );
    toastIdsRef.current.set(product.id, toastId);
  }, []);

  const handlePointerDown = (product: Product) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (pendingIds.includes(product.id)) return;
    gestureRef.current = { id: product.id, startX: event.clientX, startY: event.clientY, moved: false, captured: false };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) gesture.moved = true;
    if (shouldStartDrag({ deltaX: dx, deltaY: dy })) {
      if (!gesture.captured) {
        gesture.captured = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      setDragOffset({ id: gesture.id, x: Math.max(-ACTION_WIDTH, Math.min(0, dx)) });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    setDragOffset(null);
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    const result = resolveSwipe({ deltaX: dx, deltaY: dy, startOpen: openId === gesture.id });
    if (result === "open") setOpenId(gesture.id);
    else if (result === "close") setOpenId(null);
    if (gesture.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 50);
    }
  };

  const handlePointerCancel = () => {
    gestureRef.current = null;
    setDragOffset(null);
  };

  const runProductAction = (product: Product, actionKey: ProductStatusActionKey) => {
    switch (actionKey) {
      case "edit":
        props.onProductEdit?.(product);
        break;
      case "defect":
        props.onProductDefect?.(product);
        break;
      case "active":
        props.onProductMoveToActive?.(product);
        break;
      case "archive":
        props.onProductArchive?.(product);
        break;
    }
  };

  const visibleProducts = sortProductsForMobile(
    props.products.filter((product) => !pendingIds.includes(product.id)),
    sortOption,
    props.referenceDate,
  );

  return <div className="inventory-list">
    <div className="flex items-center justify-end pb-1">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <ArrowUpDown aria-hidden="true" className="size-4" />
        <select
          aria-label="Сортировка"
          value={sortOption}
          onChange={(event) => handleSortChange(event.target.value as MobileSortOption)}
          className="min-h-11 rounded-lg bg-transparent pr-2 text-sm text-slate-700"
        >
          {MOBILE_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    </div>
    <div className="flex items-center justify-between pb-2 text-sm text-slate-600"><span>Товар</span><span className="pr-8">Годен до</span></div>
    {visibleProducts.map(product => {
      const urgency = getExpiryStatus(product.expiryDate, props.urgentThreshold, props.warningThreshold, props.referenceDate);
      const days = product.expiryDate ? differenceInDays(startOfDay(new Date(product.expiryDate)), startOfDay(props.referenceDate ?? new Date())) : null;
      const safeLabel = days === null ? "" : formatDaysLeft(days);
      const label = days === null ? "Срок не указан" : urgency === "expired" ? "Просрочен" : urgency === "safe" ? (safeLabel || "В норме") : urgency === "urgent" ? "Срочно" : "Внимание";
      const daysLabel = days === null
        ? null
        : urgency === "expired"
          ? formatExpiredDaysLeft(days) || null
          : urgency === "urgent" || urgency === "warning"
            ? formatDaysLeft(days) || null
            : null;
      const open = expanded === product.id;
      const isOpen = openId === product.id;
      const isDragging = dragOffset?.id === product.id;
      const offset = isDragging ? dragOffset.x : isOpen ? -ACTION_WIDTH : 0;
      const StatusIcon = product.status === "ARCHIVED" ? Archive : product.status === "DEFECT" ? AlertTriangle : CheckCircle2;
      return <div key={product.id} className="border-t border-slate-200">
        <div
          data-mobile-swipe-row={product.id}
          className={cn("inventory-record relative my-2 overflow-hidden rounded-xl", open && "inventory-record-highlighted")}
        >
          {/* Red layer sits under the white card; its width tracks the swipe so it
              is fully hidden at rest and its left edge tucks under the card radius. */}
          <div
            className={cn(
              "absolute inset-y-0 right-0 flex justify-end overflow-hidden rounded-r-xl bg-red-600",
              offset === 0 && "invisible"
            )}
            style={{ width: offset < 0 ? Math.abs(offset) + CARD_RADIUS : 0 }}
          >
            <button
              type="button"
              aria-label={`Удалить ${product.name}`}
              aria-hidden={!isOpen}
              tabIndex={isOpen ? 0 : -1}
              onClick={() => scheduleDelete(product)}
              className={cn(
                "flex w-24 shrink-0 flex-col items-center justify-center gap-1 bg-red-600 text-sm font-semibold text-white hover:bg-red-700",
                !isOpen && "pointer-events-none"
              )}
            >
              <Trash2 aria-hidden="true" className="size-5" />
              Удалить
            </button>
          </div>
          <div
            className={cn("relative rounded-xl bg-white", !isDragging && "transition-transform duration-200")}
            style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
            onPointerDown={handlePointerDown(product)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`record-${product.id}`}
                onClick={() => {
                  if (suppressClickRef.current) return;
                  if (isOpen) { setOpenId(null); return; }
                  setExpanded(open ? null : product.id);
                }}
                className="inventory-row flex min-w-0 flex-1 items-center gap-2 px-3 py-4 text-left"
              >
                <span className="min-w-0 flex-1"><span className="block text-base font-bold leading-snug text-slate-950 break-words">{product.name}</span>
                  <span className="mt-1.5 flex items-start gap-2 text-sm tabular-nums text-slate-600"><ScanBarcode aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-all">{product.barcode}</span></span>
                  <span className="mt-1 block text-sm text-slate-600">{product.quantity == null ? "Количество не указано" : `${product.quantity} шт.`}</span>
                  <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold leading-4", product.status === "ACTIVE" ? "border-blue-200 bg-blue-50 text-blue-800" : product.status === "DEFECT" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-300 bg-slate-100 text-slate-700")}><StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />{product.status === "ACTIVE" ? "Активен" : product.status === "ARCHIVED" ? "Архив" : "Брак"}</span>
                </span>
                <span className="w-[112px] shrink-0 self-start text-right"><span className="block text-base tabular-nums text-slate-950">{product.expiryDate ? format(new Date(product.expiryDate), "dd.MM.yyyy") : "—"}</span>
                  <span className={cn("mt-1.5 block text-sm leading-5", urgency === "expired" || urgency === "urgent" ? "text-red-700" : urgency === "warning" ? "text-expiry-ink" : "text-slate-600")}><Circle aria-hidden="true" fill="currentColor" strokeWidth={0} className={cn("mr-1.5 inline-block size-2.5 align-baseline", days === null ? "text-slate-400" : urgency === "safe" ? "text-blue-700" : urgency === "expired" || urgency === "urgent" ? "text-red-600" : "text-expiry-marker")} />{label}
                    {daysLabel && <span className="block tabular-nums">{daysLabel}</span>}
                  </span>
                </span>
                <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")} />
              </button>
            </div>
            {open && <div id={`record-${product.id}`} className="record-actions grid grid-cols-4 gap-2 px-3 pb-4 pt-1">
              {getProductActions(product.status).map((action) => {
                const ActionIcon = ACTION_ICONS[action.key];
                return (
                  <button
                    key={action.key}
                    type="button"
                    aria-label={`${action.label} ${product.name}`}
                    aria-pressed={action.selected}
                    onClick={() => {
                      if (action.selected) return;
                      runProductAction(product, action.key);
                    }}
                    className={cn(
                      "record-action-button flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center text-xs font-semibold leading-tight transition duration-150 ease-out active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
                      action.selected
                        ? SELECTED_ACTION_STYLES[action.key]
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200",
                    )}
                  >
                    <ActionIcon aria-hidden="true" className="size-5 shrink-0" />
                    <span className="whitespace-nowrap">{action.label}</span>
                  </button>
                );
              })}
            </div>}
          </div>
        </div>
      </div>;
    })}
  </div>;
}
