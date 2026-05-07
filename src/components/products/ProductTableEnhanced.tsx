"use client";

import React, { useState, useMemo, useCallback } from "react";
import { getExpiryStatus, cn } from "@/lib/utils";
import { Product } from "@prisma/client";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type RowSelectionState,
  type ColumnDef,
} from "@tanstack/react-table";
import { format, differenceInDays, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
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
import { EditableCell } from "./EditableCell";

// ─── Ширина колонок ───────────────────────────────────────────────────────────
const COL_WIDTHS = {
  select:    32,   // чекбокс
  name:      0,    // 0 = авто (занимает всё свободное место)
  quantity:  30,   // кол-во
  barcode:   160,  // штрих-код (EAN-13 ~13 символов)
  expiryDate: 200, // срок годности + дата
  status:    110,  // статус
  actions:   120,  // кнопки действий
};
// ─────────────────────────────────────────────────────────────────────────────

interface ProductTableEnhancedProps {
  products: Product[];
  urgentThreshold?: number;
  warningThreshold?: number;
  onProductEdit?: (product: Product) => void;
  onProductDelete?: (product: Product) => void;
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
}

type ExpiryStatus = "expired" | "urgent" | "warning" | "safe";

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
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
        label: `Осталось ${daysLeft} дн.`,
        stripe: "bg-orange-500",
      };
    case "warning":
      return {
        icon: Clock,
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        label: `Осталось ${daysLeft} дн.`,
        stripe: "bg-yellow-500",
      };
    case "safe":
      return {
        icon: CalendarCheck,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        label: `Осталось ${daysLeft} дн.`,
        stripe: "bg-emerald-500",
      };
  }
};

export function ProductTableEnhanced({
  products,
  urgentThreshold = 3,
  warningThreshold = 7,
  onProductEdit,
  onProductDelete,
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
}: ProductTableEnhancedProps) {
  // Sorting is handled by parent component (dashboard)

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
          body: JSON.stringify(updateData),
        });

        if (res.ok) {
          const updated = await res.json();
          onProductUpdated?.(updated);
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
              sortField === "name" && "text-emerald-600 font-medium"
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
              className="font-medium text-slate-900 cursor-pointer hover:text-emerald-600 transition-colors"
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
              sortField === "quantity" && "text-emerald-600 font-medium"
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
              className="text-sm text-slate-700 cursor-pointer hover:text-emerald-600 transition-colors"
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
              sortField === "barcode" && "text-emerald-600 font-medium"
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
              className="flex items-center gap-1.5 text-sm text-slate-500 cursor-pointer hover:text-emerald-600 transition-colors"
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
              sortField === "expiryDate" && "text-emerald-600 font-medium"
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
          const date = new Date(getValue() as string);
          const value = format(date, "yyyy-MM-dd");

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

          const daysLeft = differenceInDays(startOfDay(date), startOfDay(new Date()));
          const status = getExpiryStatus(date, urgentThreshold, warningThreshold);
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
                {format(date, "dd.MM.yyyy", { locale: ru })}
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
              sortField === "status" && "text-emerald-600 font-medium"
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
            ACTIVE: { label: "Активен", color: "bg-emerald-100 text-emerald-700" },
            ARCHIVED: { label: "Архив", color: "bg-slate-100 text-slate-600" },
            DEFECT: { label: "Брак", color: "bg-amber-100 text-amber-700" },
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
              {/* Edit - always visible */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onProductEdit?.(product)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50"
                title="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </Button>

              {/* To Active - highlighted when product is ACTIVE */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onProductMoveToActive?.(product)}
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  product.status === "ACTIVE"
                    ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                    : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50"
                )}
                title="В Активные"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>

              {/* To Archive - highlighted when product is ARCHIVED */}
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

              {/* To Defect - highlighted when product is DEFECT */}
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

              {/* Delete - always visible */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onProductDelete?.(product)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50/50"
                title="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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
      onProductConsume,
      onProductEdit,
      onProductMoveToActive,
      onProductArchive,
      onProductDefect,
      onProductUpdated,
      urgentThreshold,
      warningThreshold,
    ]
  );

  // Handle row selection changes from TanStack Table
  const handleRowSelectionChange = useCallback(
    (updater: (old: RowSelectionState) => RowSelectionState) => {
      // Get the new selection state
      const newSelection = updater(rowSelection);

      // Convert to selectedIds array
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
          className="fixed z-50 pointer-events-none px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-1.5 shadow-lg animate-fade-out"
          style={{ left: copyTooltip.x, top: copyTooltip.y - 36, transform: "translateX(-200%)" }}
        >
          <Check className="h-3.5 w-3.5" /> Скопировано
        </div>
      )}
      {actionBar}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
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
                  row.getIsSelected() && "bg-emerald-50/50 dark:bg-emerald-900/20"
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
