import React, { useState } from "react";
import type { Product } from "@prisma/client";
import { format, differenceInDays, startOfDay } from "date-fns";
import { ChevronDown, Pencil, Archive, AlertTriangle, CheckCircle2, Trash2, ScanBarcode, Circle } from "lucide-react";
import { cn, getExpiryStatus } from "@/lib/utils";

interface Props {
  products: Product[];
  urgentThreshold?: number;
  warningThreshold?: number;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onProductEdit?: (product: Product) => void;
  onProductDelete?: (product: Product) => void;
  onProductArchive?: (product: Product) => void;
  onProductDefect?: (product: Product) => void;
  onProductMoveToActive?: (product: Product) => void;
}

/** Phone inventory: readable dates and progressive disclosure of record actions. */
export default function MobileProductList(props: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  return <div className="inventory-list">
    <div className="flex items-center justify-between pb-2 text-sm text-slate-600"><span>Товар</span>{props.onSelectionChange && <button className="min-h-11 px-2 text-blue-700" onClick={() => { setSelecting(!selecting); if (selecting) props.onSelectionChange?.([]); }}>{selecting ? "Отмена выбора" : "Выбрать"}</button>}<span className="pr-8">Годен до</span></div>
    {props.products.map(product => {
      const urgency = getExpiryStatus(product.expiryDate, props.urgentThreshold, props.warningThreshold);
      const days = product.expiryDate ? differenceInDays(startOfDay(new Date(product.expiryDate)), startOfDay(new Date())) : null;
      const label = days === null ? "Срок не указан" : urgency === "expired" ? "Просрочен" : days === 0 ? "Истекает сегодня" : days === 1 ? "Остался 1 день" : urgency === "safe" ? "В норме" : `Осталось дней: ${days}`;
      const open = expanded === product.id;
      const selected = props.selectedIds?.includes(product.id) ?? false;
      const StatusIcon = product.status === "ARCHIVED" ? Archive : product.status === "DEFECT" ? AlertTriangle : CheckCircle2;
      return <div key={product.id} className="border-t border-slate-200">
        <div className={cn("inventory-record my-2 rounded-xl", (open || selected) && "inventory-record-highlighted")}>
        <div className="flex items-center gap-1">
          {props.onSelectionChange && selecting && <label className="flex h-12 w-9 shrink-0 items-center justify-center">
            <input type="checkbox" className="size-4 accent-blue-700" aria-label={`Выбрать ${product.name}`} checked={props.selectedIds?.includes(product.id) ?? false}
              onChange={event => props.onSelectionChange?.(event.target.checked ? [...(props.selectedIds ?? []), product.id] : (props.selectedIds ?? []).filter(id => id !== product.id))} />
          </label>}
          <button type="button" aria-expanded={open} aria-controls={`record-${product.id}`} onClick={() => { setExpanded(open ? null : product.id); setDeleteCandidate(null); }} className="inventory-row flex min-w-0 flex-1 items-center gap-2 px-3 py-4 text-left">
            <span className="min-w-0 flex-1"><span className="block text-base font-bold leading-snug text-slate-950 break-words">{product.name}</span>
              <span className="mt-1.5 flex items-start gap-2 text-sm tabular-nums text-slate-600"><ScanBarcode aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-all">{product.barcode}</span></span>
              <span className="mt-1 block text-sm text-slate-600">{product.quantity == null ? "Количество не указано" : `${product.quantity} шт.`}</span>
              <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold leading-4", product.status === "ACTIVE" ? "border-blue-200 bg-blue-50 text-blue-800" : product.status === "DEFECT" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-300 bg-slate-100 text-slate-700")}><StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />{product.status === "ACTIVE" ? "Активен" : product.status === "ARCHIVED" ? "Архив" : "Брак"}</span>
            </span>
            <span className="w-[112px] shrink-0 self-start text-right"><span className="block text-base tabular-nums text-slate-950">{product.expiryDate ? format(new Date(product.expiryDate), "dd.MM.yyyy") : "—"}</span>
              <span className={cn("mt-1.5 inline-flex max-w-full items-start justify-end gap-2 text-sm leading-5", urgency === "expired" ? "text-red-700" : urgency === "urgent" || urgency === "warning" ? "text-expiry-ink" : "text-slate-600")}><Circle aria-hidden="true" fill="currentColor" strokeWidth={0} className={cn("mt-[5px] size-2.5 shrink-0", days === null ? "text-slate-400" : urgency === "safe" ? "text-blue-700" : urgency === "expired" ? "text-red-600" : "text-expiry-marker")} /><span>{label}</span></span>
            </span>
            <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")} />
          </button>
        </div>
        {open && <div id={`record-${product.id}`} className="record-actions flex flex-wrap gap-2 px-3 pb-4 pt-1">
          <button onClick={() => props.onProductEdit?.(product)}><Pencil />Изменить</button>
          {product.status !== "ARCHIVED" && <button onClick={() => props.onProductArchive?.(product)}><Archive />В архив</button>}
          {product.status !== "DEFECT" && <button onClick={() => props.onProductDefect?.(product)}><AlertTriangle />В брак</button>}
          {product.status !== "ACTIVE" && <button onClick={() => props.onProductMoveToActive?.(product)}><CheckCircle2 />В активные</button>}
          <button className="text-red-700" onClick={() => {
            if (deleteCandidate === product.id) props.onProductDelete?.(product);
            else setDeleteCandidate(product.id);
          }}><Trash2 />{deleteCandidate === product.id ? "Подтвердить удаление" : "Удалить"}</button>
        </div>}
        </div>
      </div>;
    })}
  </div>;
}
