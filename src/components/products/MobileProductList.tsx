import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@prisma/client";
import { Archive, AlertTriangle, CheckCircle2, ChevronDown, Circle, Pencil, ScanBarcode, Trash2, type LucideIcon } from "lucide-react";
import toast from "react-hot-toast";
import { cn, getExpiryStatus } from "@/lib/utils";
import { createPendingDeletes, type PendingDeletes } from "@/lib/pending-delete";
import { resolveSwipe, shouldStartDrag } from "@/lib/swipe-gesture";
import { formatDaysLeft, formatExpiredDaysLeft, type ExpiryGroup } from "@/lib/days-left";
import { getProductActions, type ProductStatusActionKey } from "@/lib/product-status-actions";
import { expiryDays, expiryDisplay } from "@/lib/expiry-calendar";

type ProductStatus = "ACTIVE" | "ARCHIVED" | "DEFECT";

interface Props {
  canDelete?: boolean;
  /** Groups for the current page; a flat list is rendered when omitted. */
  groups?: ExpiryGroup<Product>[];
  products: Product[];
  urgentThreshold?: number;
  warningThreshold?: number;
  referenceDate?: Date;
  onProductEdit?: (product: Product) => void;
  onProductDelete?: (product: Product) => void;
  /** Removes the product from the parent list after a successful DELETE. */
  onProductRemoved?: (productId: string) => void;
  onProductStatusChange?: (product: Product, status: ProductStatus) => void;
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

const ACTION_STATUS: Record<Exclude<ProductStatusActionKey, "edit">, ProductStatus> = {
  defect: "DEFECT",
  active: "ACTIVE",
  archive: "ARCHIVED",
};

/** Fill used when an action represents the product's current status. */
const SELECTED_ACTION_STYLES: Record<ProductStatusActionKey, string> = {
  edit: "",
  defect: "border-red-600 bg-red-600 text-white",
  active: "border-blue-600 bg-blue-600 text-white",
  archive: "border-slate-600 bg-slate-600 text-white",
};

/**
 * Left status bar colour for each phone group. The bar is a separate absolutely positioned
 * element inside the record, so it is not clipped by the rounded corners of the card.
 */
const GROUP_MARKER: Record<string, string> = {
  expired: "bg-dash-expired",
  today: "bg-dash-expired",
  urgent: "bg-dash-expired",
  warning: "bg-dash-amber-bar",
  safe: "bg-dash-control",
  none: "bg-dash-control",
};

interface GestureState {
  id: string;
  startX: number;
  startY: number;
  moved: boolean;
  /** Set once the gesture became a horizontal drag and captured the pointer. */
  captured: boolean;
}

/** Phone inventory: grouped by expiry, readable dates, swipe-to-delete with undo. */
export default function MobileProductList(props: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ id: string; x: number } | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

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
          const response = await fetch(`/api/products/${id}?version=${product?.version ?? 0}`, { method: "DELETE", keepalive });
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
    if (actionKey === "edit") {
      props.onProductEdit?.(product);
      return;
    }
    props.onProductStatusChange?.(product, ACTION_STATUS[actionKey]);
  };

  const visibleProducts = props.products.filter((product) => !pendingIds.includes(product.id));
  const renderGroups: ExpiryGroup<Product>[] = props.groups?.length
    ? props.groups
        .map((group) => ({ ...group, items: group.items.filter((product) => !pendingIds.includes(product.id)) }))
        .filter((group) => group.items.length > 0)
    : [{ key: "all", label: "", hint: "", count: visibleProducts.length, items: visibleProducts }];

  return (
    <div className="inventory-list">
      {renderGroups.map((group) => (
        <section key={group.key} aria-label={group.label || undefined}>
          {group.label && (
            <div className="flex items-baseline gap-2 px-1 pb-1 pt-3">
              <b className="text-base font-extrabold text-dash-ink">{group.label}</b>
              <span className="text-[13px] font-semibold text-dash-muted">{group.count}</span>
              {group.hint && <span className="text-[13px] font-semibold text-dash-muted">{group.hint}</span>}
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-dash-line bg-dash-panel">
            {group.items.map((product) => {
              const urgency = getExpiryStatus(product.expiryDate, props.urgentThreshold, props.warningThreshold, props.referenceDate);
              const days = expiryDays(product.expiryDate, props.referenceDate ?? new Date());
              const statusLabel = product.status === "ACTIVE" ? "Активен" : product.status === "ARCHIVED" ? "Архив" : "Брак";
              const StatusIcon = product.status === "ARCHIVED" ? Archive : product.status === "DEFECT" ? AlertTriangle : CheckCircle2;
              const hasDate = days !== null;
              const label = !hasDate
                ? "Срок не указан"
                : urgency === "expired"
                  ? "Просрочен"
                  : urgency === "urgent"
                    ? days === 0 ? "Срочно · сегодня" : "Срочно"
                    : urgency === "warning"
                      ? "Внимание"
                      : `Осталось ${formatDaysLeft(days)}`;
              const daysLabel = !hasDate
                ? null
                : urgency === "expired"
                  ? formatExpiredDaysLeft(days) || null
                  : urgency === "urgent" || urgency === "warning"
                    ? (days === 0 ? null : formatDaysLeft(days) || null)
                    : null;
              const badgeClass = !hasDate
                ? "bg-dash-surface text-dash-muted"
                : urgency === "expired"
                  ? "bg-dash-expired text-white"
                  : urgency === "urgent"
                    ? "bg-red-50 text-red-700"
                    : urgency === "warning"
                      ? "bg-expiry-soft text-expiry-ink"
                      : "bg-dash-surface text-dash-ink-2";
              const markerClass = !hasDate
                ? "text-dash-muted"
                : urgency === "safe"
                  ? "text-blue-700"
                  : urgency === "warning"
                    ? "text-expiry-marker"
                    : urgency === "expired"
                      ? "text-red-700"
                      : "text-red-600";
              const open = expanded === product.id;
              const isOpen = openId === product.id;
              const isDragging = dragOffset?.id === product.id;
              const offset = isDragging ? dragOffset.x : isOpen ? -ACTION_WIDTH : 0;
              return (
                <div key={product.id} className="border-t border-dash-line first:border-t-0">
                  <div
                    data-mobile-swipe-row={product.id}
                    className={cn("inventory-record relative my-2 overflow-hidden rounded-xl", open && "inventory-record-highlighted")}
                  >
                    {/* Red layer sits under the white card; its width tracks the swipe so it
                        is fully hidden at rest and its left edge tucks under the card radius. */}
                    <div
                      className={cn(
                        "absolute inset-y-0 right-0 flex justify-end overflow-hidden rounded-r-xl bg-red-600",
                        (offset === 0 || props.canDelete === false) && "invisible"
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
                      className="relative rounded-xl bg-white"
                      style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y", transition: isDragging ? undefined : "transform 200ms" }}
                      onPointerDown={props.canDelete === false ? undefined : handlePointerDown(product)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                    >
                      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full", GROUP_MARKER[group.key] ?? "bg-transparent")} />
                      <div className="flex items-center gap-1 border-l-4 border-transparent">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={`record-${product.id}`}
                          onClick={() => {
                            if (suppressClickRef.current) return;
                            if (isOpen) { setOpenId(null); return; }
                            setExpanded(open ? null : product.id);
                          }}
                          className="inventory-row flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <span className="text-[22px] font-extrabold leading-7 tabular-nums text-dash-ink">{expiryDisplay(product.expiryDate)}</span>
                              <span className={cn("inline-flex flex-col items-start rounded-md px-2 py-0.5 text-xs font-bold leading-4", badgeClass)}>
                                <span>{label}<span className="block tabular-nums">{daysLabel}</span></span>
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-dash-surface px-2 py-0.5 text-xs font-semibold leading-4 text-dash-ink-2">
                                <StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />
                                {statusLabel}
                              </span>
                            </span>
                            <span className="mt-1 block break-words text-[15px] font-bold leading-5 text-dash-ink">{product.name}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium tabular-nums text-dash-muted">
                              <ScanBarcode aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
                              <span className="min-w-0 break-all">{product.barcode || "—"}</span>
                              <span aria-hidden="true">·</span>
                              <span>{product.quantity == null ? "Количество не указано" : `${product.quantity} шт.`}</span>
                            </span>
                          </span>
                          <Circle
                            aria-hidden="true"
                            fill="currentColor"
                            strokeWidth={0}
                            className={cn("size-2.5 shrink-0", markerClass)}
                          />
                          <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-dash-muted", open && "rotate-180")} />
                        </button>
                      </div>
                      {open && (
                        <div id={`record-${product.id}`} className="record-actions grid grid-cols-4 gap-2 px-3 pb-3 pt-1">
                          {getProductActions(product.status).map((action) => {
                            const ActionIcon = ACTION_ICONS[action.key];
                            return (
                              <button
                                key={action.key}
                                type="button"
                                aria-label={action.selected ? `${action.label} — текущий статус` : action.label}
                                aria-pressed={action.selected}
                                disabled={action.selected}
                                onClick={() => runProductAction(product, action.key)}
                                className={cn(
                                  "record-action-button flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center text-xs font-semibold leading-tight transition duration-150 ease-out active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
                                  action.selected
                                    ? SELECTED_ACTION_STYLES[action.key]
                                    : "border-dash-control bg-white text-dash-ink-2 hover:bg-dash-surface active:bg-dash-line",
                                )}
                              >
                                <ActionIcon aria-hidden="true" className="size-5 shrink-0" />
                                <span className="whitespace-nowrap">{action.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
