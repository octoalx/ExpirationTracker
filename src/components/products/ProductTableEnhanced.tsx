"use client";

import React, { useState, useMemo, useCallback } from "react";
import { getExpiryStatus, cn } from "@/lib/utils";
import type { Product } from "@prisma/client";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type RowSelectionState,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  CheckCircle2,
  Trash2,
  Pencil,
  Barcode,
  Calendar,
  AlertCircle,
  Clock,
  CalendarCheck,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Check,
  GripVertical,
  ScanBarcode,
  Package,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import MobileProductList from "./MobileProductList";
import { expiryDays, expiryLabel, expiryDisplay } from "@/lib/expiry-calendar";
import type { MobileSortOption } from "@/lib/days-left";
import { EditableCell } from "./EditableCell";

/* ── Column widths ── */
const COL_WIDTHS = {
  select:    32,   // checkbox
  name:      0,    // 0 = auto (fills remaining space)
  quantity:  30,   // qty
  barcode:   160,  // barcode (EAN-13 ~13 chars)
  expiryDate: 200, // expiry date + badge
  status:    110,  // status badge
  actions:   120,  // action buttons
};

interface ProductTableEnhancedProps {
  canDelete?: boolean;
  products: Product[];
  /**
   * Page slice for the phone list. The dashboard paginates the globally
   * mobile-sorted list here so sorting is not limited to the desktop page.
   * Falls back to `products` when omitted.
   */
  mobileProducts?: Product[];
  urgentThreshold?: number;
  warningThreshold?: number;
  referenceDate?: Date;
  onProductEdit?: (product: Product) => void;
  onProductDelete?: (product: Product) => void;
  /** Called after a deferred mobile delete has been committed to the server. */
  onProductRemoved?: (productId: string) => void;
  onProductConsume?: (product: Product) => void;
  onProductMoveToActive?: (product: Product) => void;
  onProductArchive?: (product: Product) => void;
  onProductDefect?: (product: Product) => void;
  onProductUpdated?: (product: Product) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  selectedIds?: string[];
  actionBar?: React.ReactNode;
  sortField?: string;
  sortDesc?: boolean;
  onSortChange?: (field: string) => void;
  /** Phone-list order; controlled by the dashboard when provided. */
  mobileSort?: MobileSortOption;
  onMobileSortChange?: (sort: MobileSortOption) => void;
  /** The parent renders the phone sort select in its own toolbar. */
  mobileSortInToolbar?: boolean;
}

type ExpiryStatus = "expired" | "urgent" | "warning" | "safe";

/** Returns icon, colors, and label for a given expiry status. */
const getStatusConfig = (status: ExpiryStatus, daysLeft: number) => {
  switch (status) {
    case "expired":
      return {
        icon: AlertCircle,
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        label: "Просрочен",
        stripe: "bg-red-500",
      };
    case "urgent":
      return {
        icon: Clock,
        color: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
        label: `Срочно · ${daysLeft} дн.`,
        stripe: "bg-red-500",
      };
    case "warning":
      return {
        icon: Clock,
        color: "text-expiry-ink",
        bg: "bg-expiry-soft",
        border: "border-expiry-border",
        label: `Внимание · ${daysLeft} дн.`,
        stripe: "bg-expiry-marker",
      };
    case "safe":
      return {
        icon: CalendarCheck,
        color: "text-slate-600",
        bg: "bg-slate-50",
        border: "border-slate-200",
        label: `Осталось ${daysLeft} дн.`,
        stripe: "bg-slate-400",
      };
  }
};

/** Enhanced product table with inline editing, sorting, and bulk selection. */
export function ProductTableEnhanced({
  canDelete = true,
  products,
  mobileProducts,
  urgentThreshold = 3,
  warningThreshold = 7,
  referenceDate,
  onProductEdit,
  onProductDelete,
  onProductRemoved,
  onProductConsume,
  onProductMoveToActive,
  onProductArchive,
  onProductDefect,
  onProductUpdated,
  onSelectionChange,
  selectedIds = [],
  actionBar,
  sortField,
  sortDesc,
  onSortChange,
  mobileSort,
  onMobileSortChange,
  mobileSortInToolbar,
}: ProductTableEnhancedProps) {
  // Convert selectedIds array to rowSelection object for TanStack Table
  const rowSelection = useMemo(() => {
    const selection: RowSelectionState = {};
    selectedIds.forEach((id) => {
      const index = products.findIndex((p) => p.id === id);
      if (index !== -1) {
        selection[index] = true;
      }
    });
    return selection;
  }, [selectedIds, products]);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [copyTooltip, setCopyTooltip] = useState<{ x: number; y: number } | null>(null);
  const tooltipTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyToClipboard = useCallback((text: string, e: React.MouseEvent) => {
    const x = e.clientX, y = e.clientY;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      navigator.clipboard.writeText(text).catch(() => {});
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      setCopyTooltip({ x, y });
      tooltipTimer.current = setTimeout(() => setCopyTooltip(null), 800);
    }, 300);
  }, []);

  const handleCellEdit = useCallback(
    async (product: Product, columnId: string, value: string | number | null) => {
      let updateData: Partial<Product> = {};

      switch (columnId) {
        case "name":
          updateData = { name: value as string };
          break;
        case "barcode":
          updateData = { barcode: value as string };
          break;
        case "expiryDate":
          updateData = { expiryDate: new Date(value as string) };
          break;
        case "quantity":
          updateData = { quantity: value as number | null };
          break;
        default:
          return;
      }

      try {
        const res = await fetch(`/api/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...updateData, version: product.version }),
        });

        if (res.ok) {
          const updated = await res.json();
          onProductUpdated?.(updated);
        } else {
          const error = await res.json();
          window.alert(error.message ?? "Не удалось сохранить. Обновите список.");
        }
      } catch (error) {
        console.error("Failed to update product:", error);
      }
      setEditingCell(null);
    },
    [onProductUpdated]
  );

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Выделить все"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Выделить строку"
          />
        ),
        size: 20,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <div
            className={cn(
              "flex items-center gap-1 cursor-pointer select-none",
              sortField === "name" && "text-blue-600 font-medium"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSortChange?.("name");
            }}
          >
            Название
            {sortField === "name"
              ? (sortDesc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />)
              : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
          </div>
        ),
        cell: ({ row, getValue }) => {
          const isEditing =
            editingCell?.rowId === row.id && editingCell?.columnId === "name";
          const value = getValue() as string;

          if (isEditing) {
            return (
              <EditableCell
                value={value}
                type="text"
                onSave={(val) => handleCellEdit(row.original, "name", val)}
                onCancel={() => setEditingCell(null)}
              />
            );
          }

          return (
            <div
              className="font-medium text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={(e) => copyToClipboard(value, e)}
              onDoubleClick={(e) => {
                if (clickTimer.current) clearTimeout(clickTimer.current);
                setEditingCell({ rowId: row.id, columnId: "name" });
              }}
              title="Клик — копировать, двойной клик — редактировать"
            >
              {value}
            </div>
          );
        },
        size: 180,
      },
      {
        accessorKey: "quantity",
        header: ({ column }) => (
          <div
            className={cn(
              "flex items-center gap-1 cursor-pointer select-none",
              sortField === "quantity" && "text-blue-600 font-medium"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSortChange?.("quantity");
            }}
          >
            Кол-во
            {sortField === "quantity"
              ? (sortDesc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />)
              : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
          </div>
        ),
        cell: ({ row, getValue }) => {
          const isEditing =
            editingCell?.rowId === row.id &&
            editingCell?.columnId === "quantity";
          const value = getValue() as number | null;
          const displayValue = value?.toString() ?? "";

          if (isEditing) {
            return (
              <EditableCell
                value={displayValue}
                type="number"
                onSave={(val) => {
                  const numVal = val === "" ? null : parseInt(val, 10);
                  handleCellEdit(row.original, "quantity", numVal);
                }}
                onCancel={() => setEditingCell(null)}
              />
            );
          }

          return (
            <div
              className="text-sm text-slate-700 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={(e) => copyToClipboard(String(value ?? ""), e)}
              onDoubleClick={(e) => {
                if (clickTimer.current) clearTimeout(clickTimer.current);
                setEditingCell({ rowId: row.id, columnId: "quantity" });
              }}
              title="Клик — копировать, двойной клик — редактировать"
            >
              {value ?? "—"}
            </div>
          );
        },
        size: 30,
      },
      {
        accessorKey: "barcode",
        header: ({ column }) => (
          <div
            className={cn(
              "flex items-center gap-1 cursor-pointer select-none",
              sortField === "barcode" && "text-blue-600 font-medium"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSortChange?.("barcode");
            }}
          >
            Штрих-код
            {sortField === "barcode"
              ? (sortDesc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />)
              : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
          </div>
        ),
        cell: ({ row, getValue }) => {
          const isEditing =
            editingCell?.rowId === row.id &&
            editingCell?.columnId === "barcode";
          const value = getValue() as string;

          if (isEditing) {
            return (
              <div style={{ width: COL_WIDTHS.barcode - 32 }}>
                <EditableCell
                  value={value}
                  type="text"
                  onSave={(val) => handleCellEdit(row.original, "barcode", val)}
                  onCancel={() => setEditingCell(null)}
                />
              </div>
            );
          }

          return (
            <div
              className="flex items-center gap-1.5 text-sm text-slate-500 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={(e) => copyToClipboard(value || "", e)}
              onDoubleClick={(e) => {
                if (clickTimer.current) clearTimeout(clickTimer.current);
                setEditingCell({ rowId: row.id, columnId: "barcode" });
              }}
              title="Клик — копировать, двойной клик — редактировать"
            >
              <ScanBarcode className="h-3.5 w-3.5" />
              <span className="font-mono">{value || "—"}</span>
            </div>
          );
        },
        size: 150,
      },
      {
        accessorKey: "expiryDate",
        header: ({ column }) => (
          <div
            className={cn(
              "flex items-start gap-1 cursor-pointer select-none",
              sortField === "expiryDate" && "text-blue-600 font-medium"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSortChange?.("expiryDate");
            }}
          >
            Срок годности
            {sortField === "expiryDate"
              ? (sortDesc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />)
              : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
          </div>
        ),
        cell: ({ row, getValue }) => {
          const isEditing =
            editingCell?.rowId === row.id &&
            editingCell?.columnId === "expiryDate";
          const rawDate = getValue() as string | Date | null;
          const date = rawDate ? new Date(rawDate) : null;
          const value = expiryLabel(date) ?? "";

          if (isEditing) {
            return (
              <EditableCell
                value={value}
                type="date"
                onSave={(val) =>
                  handleCellEdit(row.original, "expiryDate", val)
                }
                onCancel={() => setEditingCell(null)}
              />
            );
          }

          if (!date) {
            return <span title="Двойной клик для редактирования" className="text-slate-400 cursor-pointer"
              onDoubleClick={(e) => { e.stopPropagation(); setEditingCell({ rowId: row.id, columnId: "expiryDate" }); }}>
              Срок не указан
            </span>;
          }

          const daysLeft = expiryDays(date, referenceDate ?? new Date())!;
          const status = getExpiryStatus(date, urgentThreshold, warningThreshold, referenceDate);
          const config = getStatusConfig(status, daysLeft);
          const StatusIcon = config.icon;

          return (
            <div
              className="flex items-center justify-between gap-2 cursor-pointer group w-full min-w-0"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingCell({ rowId: row.id, columnId: "expiryDate" });
              }}
              title="Двойной клик для редактирования"
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors shrink-0",
                  config.bg,
                  config.border,
                  config.color
                )}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                <span>{config.label}</span>
              </div>
              <span className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                {expiryDisplay(date)}
              </span>
            </div>
          );
        },
        size: 200,
        maxSize: 200,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <div
            className={cn(
              "flex items-center gap-1 cursor-pointer select-none",
              sortField === "status" && "text-blue-600 font-medium"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSortChange?.("status");
            }}
          >
            Статус
            {sortField === "status"
              ? (sortDesc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />)
              : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
          </div>
        ),
        cell: ({ getValue }) => {
          const status = getValue() as string;

          const config = {
            ACTIVE: { label: "Активен", color: "bg-blue-50 text-blue-800" },
            ARCHIVED: { label: "Архив", color: "bg-slate-100 text-slate-600" },
            DEFECT: { label: "Брак", color: "bg-red-50 text-red-800" },
          }[status] || { label: status, color: "bg-slate-100 text-slate-600" };

          return (
            <span
              className={cn(
                "inline-flex px-2.5 py-1 rounded-full text-xs font-medium",
                config.color
              )}
            >
              {config.label}
            </span>
          );
        },
        size: 100,
      },
      {
        id: "actions",
        header: "Действия",
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="flex items-center gap-0.5">
              {/* Edit */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onProductEdit?.(product)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50/50"
                title="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </Button>

              {/* Move to Active */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onProductMoveToActive?.(product)}
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  product.status === "ACTIVE"
                    ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                    : "text-slate-400 hover:text-blue-600 hover:bg-blue-50/50"
                )}
                title="В Активные"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>

              {/* Move to Archive */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onProductArchive?.(product)}
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  product.status === "ARCHIVED"
                    ? "text-slate-700 bg-slate-100 hover:bg-slate-200"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                )}
                title="В Архив"
              >
                <Archive className="h-4 w-4" />
              </Button>

              {/* Move to Defect */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onProductDefect?.(product)}
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  product.status === "DEFECT"
                    ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                    : "text-slate-400 hover:text-amber-600 hover:bg-amber-50/50"
                )}
                title="В Брак"
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>

              {/* Delete */}
              {canDelete && <Button
                variant="ghost"
                size="sm"
                onClick={() => onProductDelete?.(product)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50/50"
                title="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>}
            </div>
          );
        },
        size: 60,
      },
    ],
    [
      editingCell,
      handleCellEdit,
      copyToClipboard,
      onProductDelete,
      canDelete,
      onProductConsume,
      onProductEdit,
      onProductMoveToActive,
      onProductArchive,
      onProductDefect,
      onProductUpdated,
      urgentThreshold,
      warningThreshold,
      referenceDate,
    ]
  );

  /** Syncs TanStack Table row selection back to parent via `onSelectionChange`. */
  const handleRowSelectionChange = useCallback(
    (updater: (old: RowSelectionState) => RowSelectionState) => {
      const newSelection = updater(rowSelection);

      // Map numeric indices back to product IDs
      const newSelectedIds = Object.keys(newSelection)
        .filter((key) => newSelection[key])
        .map((index) => products[parseInt(index)]?.id)
        .filter(Boolean);

      onSelectionChange?.(newSelectedIds);
    },
    [rowSelection, products, onSelectionChange]
  );

  const table = useReactTable({
    data: products,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      {copyTooltip && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-medium flex items-center gap-1.5 animate-fade-out"
          style={{ left: copyTooltip.x, top: copyTooltip.y - 36, transform: "translateX(-200%)" }}
        >
          <Check className="h-3.5 w-3.5" /> Скопировано
        </div>
      )}
      {actionBar}

      <div className="md:hidden"><MobileProductList canDelete={canDelete} products={mobileProducts ?? products} urgentThreshold={urgentThreshold} warningThreshold={warningThreshold} referenceDate={referenceDate} sortOption={mobileSort} onSortChange={onMobileSortChange} hideSortControl={mobileSortInToolbar} onProductEdit={onProductEdit} onProductDelete={onProductDelete} onProductRemoved={onProductRemoved} onProductArchive={onProductArchive} onProductDefect={onProductDefect} onProductMoveToActive={onProductMoveToActive} /></div>
      <div className="hidden md:block rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200 dark:border-slate-700">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider",
                      header.column.id === "select" ? "px-3" : "px-4",
                      ["quantity","barcode","expiryDate","status","actions"].includes(header.column.id) && "whitespace-nowrap",
                      header.column.getCanSort() &&
                        "cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                    style={COL_WIDTHS[header.column.id as keyof typeof COL_WIDTHS] ? { width: COL_WIDTHS[header.column.id as keyof typeof COL_WIDTHS] } : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                  row.getIsSelected() && "bg-blue-50/50 dark:bg-blue-900/20"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "py-3",
                      cell.column.id === "select" ? "px-3" : "px-4",
                      ["expiryDate","status","actions"].includes(cell.column.id) && "whitespace-nowrap"
                    )}
                    style={COL_WIDTHS[cell.column.id as keyof typeof COL_WIDTHS] ? { width: COL_WIDTHS[cell.column.id as keyof typeof COL_WIDTHS] } : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {table.getRowModel().rows.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            <p>Товары не найдены</p>
            <p className="text-xs mt-1">Измените фильтры или добавьте товары</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Выделено {table.getSelectedRowModel().rows.length} из{" "}
          {table.getFilteredRowModel().rows.length}
        </span>
        <span>Всего: {products.length} товаров</span>
      </div>
    </div>
  );
}
