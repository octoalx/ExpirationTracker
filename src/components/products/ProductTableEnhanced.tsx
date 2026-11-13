"use client";

import React from "react";
import type { Product } from "@prisma/client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MobileProductList from "./MobileProductList";
import { cn, getExpiryStatus } from "@/lib/utils";
import { expiryDays, expiryDisplay } from "@/lib/expiry-calendar";
import type { ExpiryGroup } from "@/lib/days-left";

export type ProductStatus = "ACTIVE" | "ARCHIVED" | "DEFECT";
type ExpiryStatus = "expired" | "urgent" | "warning" | "safe";

export interface ProductTableEnhancedProps {
  canDelete?: boolean;
  /**
   * Desktop groups for the current page, in table order. `count` keeps the
   * size of the whole group so a group split across pages still reads truly.
   */
  groups?: ExpiryGroup<Product>[];
  /** Flat list; used when `groups` is omitted. */
  products: Product[];
  /** Phone groups for the current page. */
  mobileGroups?: ExpiryGroup<Product>[];
  urgentThreshold?: number;
  warningThreshold?: number;
  referenceDate?: Date;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onProductEdit?: (product: Product) => void;
  onProductDelete?: (product: Product) => void;
  /** Called after a deferred delete has been committed to the server. */
  onProductRemoved?: (productId: string) => void;
  onProductStatusChange?: (product: Product, status: ProductStatus) => void;
  actionBar?: React.ReactNode;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Активен", className: "bg-dash-soft text-dash-accent" },
  ARCHIVED: { label: "Архив", className: "bg-dash-surface text-dash-ink-2" },
  DEFECT: { label: "Брак", className: "bg-dash-expired-soft text-dash-expired" },
};

const STATUS_ACTIONS: ReadonlyArray<{ status: ProductStatus; label: string }> = [
  { status: "ACTIVE", label: "В Активные" },
  { status: "ARCHIVED", label: "В Архив" },
  { status: "DEFECT", label: "В Брак" },
];

/** Badge copy for the record's own expiry state. */
export function expiryBadge(status: ExpiryStatus, daysLeft: number) {
  switch (status) {
    case "expired":
      return { label: "Просрочен", className: "bg-dash-expired text-white" };
    case "urgent":
      return {
        label: daysLeft === 0 ? "Срочно · сегодня" : `Срочно · ${daysLeft} дн.`,
        className: "bg-dash-expired-soft text-dash-expired",
      };
    case "warning":
      return { label: `Внимание · ${daysLeft} дн.`, className: "bg-expiry-soft text-expiry-ink" };
    case "safe":
      return { label: `Осталось ${daysLeft} дн.`, className: "bg-dash-surface text-dash-ink-2" };
  }
}

/** Left edge marker that shows urgency without painting the whole row. */
function rowMarkerClass(status: ExpiryStatus | null): string {
  if (status === "expired" || status === "urgent") return "border-l-dash-expired";
  if (status === "warning") return "border-l-dash-amber-bar";
  return "border-l-transparent";
}

function StatusPill({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-dash-surface text-dash-ink-2" };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  );
}

/** Enhanced product table: FEFO groups, explicit actions, bulk selection. */
export function ProductTableEnhanced({
  canDelete = true,
  groups,
  products,
  mobileGroups,
  urgentThreshold = 3,
  warningThreshold = 7,
  referenceDate,
  selectedIds = [],
  onSelectionChange,
  onProductEdit,
  onProductDelete,
  onProductRemoved,
  onProductStatusChange,
  actionBar,
}: ProductTableEnhancedProps) {
  const renderGroups: ExpiryGroup<Product>[] = groups?.length
    ? groups
    : [{ key: "all", label: "", hint: "", count: products.length, items: products }];
  const visibleRows = renderGroups.flatMap((group) => group.items);
  const selectedVisible = visibleRows.filter((product) => selectedIds.includes(product.id)).length;
  const allSelected = visibleRows.length > 0 && selectedVisible === visibleRows.length;

  const toggleAll = (checked: boolean) => {
    const ids = visibleRows.map((product) => product.id);
    if (checked) {
      onSelectionChange?.([...new Set([...selectedIds, ...ids])]);
    } else {
      onSelectionChange?.(selectedIds.filter((id) => !ids.includes(id)));
    }
  };

  const toggleRow = (product: Product, checked: boolean) => {
    if (checked) {
      onSelectionChange?.([...new Set([...selectedIds, product.id])]);
    } else {
      onSelectionChange?.(selectedIds.filter((id) => id !== product.id));
    }
  };

  return (
    <div className="space-y-3">
      {actionBar}

      <div className="md:hidden">
        <MobileProductList
          canDelete={canDelete}
          groups={mobileGroups}
          products={products}
          urgentThreshold={urgentThreshold}
          warningThreshold={warningThreshold}
          referenceDate={referenceDate}
          onProductEdit={onProductEdit}
          onProductDelete={onProductDelete}
          onProductRemoved={onProductRemoved}
          onProductStatusChange={onProductStatusChange}
        />
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-dash-line bg-dash-panel md:block">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-[52px]" />
            <col className="w-[236px]" />
            <col />
            <col className="w-[84px]" />
            <col className="w-[152px]" />
            <col className="w-[100px]" />
            <col className="w-[156px]" />
          </colgroup>
          <thead>
            <tr>
              <th className="h-9 border-b border-dash-line bg-dash-surface pl-4 text-left">
                <Checkbox
                  checked={allSelected ? true : selectedVisible > 0 ? "indeterminate" : false}
                  onCheckedChange={(value) => toggleAll(value === true)}
                  aria-label="Выбрать всё на странице"
                  className="size-[18px] border-[1.5px] border-dash-control"
                />
              </th>
              <th className="h-9 border-b border-dash-line bg-dash-surface px-2 text-left text-xs font-bold text-dash-muted">
                Срок годности
              </th>
              <th className="h-9 border-b border-dash-line bg-dash-surface px-2 text-left text-xs font-bold text-dash-muted">
                Название
              </th>
              <th className="h-9 border-b border-dash-line bg-dash-surface px-2 pr-6 text-right text-xs font-bold text-dash-muted">
                Кол-во
              </th>
              <th className="h-9 border-b border-dash-line bg-dash-surface px-2 text-left text-xs font-bold text-dash-muted">
                Штрих-код
              </th>
              <th className="h-9 border-b border-dash-line bg-dash-surface px-2 text-left text-xs font-bold text-dash-muted">
                Статус
              </th>
              <th className="h-9 border-b border-dash-line bg-dash-surface px-4 text-right text-xs font-bold text-dash-muted">
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {renderGroups.map((group) => (
              <React.Fragment key={group.key}>
                {group.label && (
                  <tr>
                    <td colSpan={7} className="h-11 border-y border-dash-line bg-dash-surface px-4">
                      <span className="flex items-baseline gap-3">
                        <b className="text-base font-extrabold text-dash-ink">{group.label}</b>
                        <span className="text-[13px] font-semibold text-dash-muted">{group.hint}</span>
                      </span>
                    </td>
                  </tr>
                )}
                {group.items.map((product) => {
                  const days = expiryDays(product.expiryDate, referenceDate ?? new Date());
                  const urgency = product.expiryDate
                    ? getExpiryStatus(product.expiryDate, urgentThreshold, warningThreshold, referenceDate)
                    : null;
                  const badge = urgency !== null && days !== null ? expiryBadge(urgency, days) : null;
                  const selected = selectedIds.includes(product.id);
                  return (
                    <tr key={product.id} className={selected ? "bg-dash-soft" : "bg-dash-panel hover:bg-dash-surface"}>
                      <td
                        className={cn(
                          "border-b border-l-[3px] border-dash-line pl-[13px]",
                          selected ? "border-l-dash-accent" : rowMarkerClass(urgency),
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(value) => toggleRow(product, value === true)}
                          aria-label={product.name}
                          className="size-[18px] border-[1.5px] border-dash-control"
                        />
                      </td>
                      <td className="h-12 border-b border-dash-line px-2">
                        <span className="flex items-center gap-3">
                          <span className="w-[84px] shrink-0 text-sm font-extrabold tabular-nums text-dash-ink">
                            {expiryDisplay(product.expiryDate)}
                          </span>
                          {badge && (
                            <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-bold", badge.className)}>
                              {badge.label}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="h-12 truncate border-b border-dash-line px-2 font-semibold text-dash-ink" title={product.name}>
                        {product.name}
                      </td>
                      <td className="h-12 border-b border-dash-line px-2 pr-6 text-right tabular-nums text-dash-ink">
                        {product.quantity ?? "—"}
                      </td>
                      <td className="h-12 truncate border-b border-dash-line px-2 text-[13px] tabular-nums text-dash-muted">
                        {product.barcode || "—"}
                      </td>
                      <td className="h-12 border-b border-dash-line px-2">
                        <StatusPill status={product.status} />
                      </td>
                      <td className="h-12 border-b border-dash-line px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onProductEdit?.(product)}
                            className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-semibold text-dash-accent hover:bg-dash-soft"
                          >
                            Изменить
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`Ещё: ${product.name}`}
                              className="inline-flex size-8 items-center justify-center rounded-lg text-dash-ink-2 hover:bg-dash-surface"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="5" cy="12" r="1.4" fill="currentColor" />
                                <circle cx="12" cy="12" r="1.4" fill="currentColor" />
                                <circle cx="19" cy="12" r="1.4" fill="currentColor" />
                              </svg>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-44">
                              {STATUS_ACTIONS.map((action) => (
                                <DropdownMenuItem
                                  key={action.status}
                                  disabled={product.status === action.status}
                                  onSelect={() => onProductStatusChange?.(product, action.status)}
                                >
                                  {action.label}
                                </DropdownMenuItem>
                              ))}
                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-dash-expired focus:bg-dash-expired-soft"
                                    onSelect={() => onProductDelete?.(product)}
                                  >
                                    Удалить
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {visibleRows.length === 0 && (
          <div className="py-12 text-center text-dash-muted">
            <p>Товары не найдены</p>
            <p className="mt-1 text-xs">Измените фильтры или добавьте товары</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductTableEnhanced;
