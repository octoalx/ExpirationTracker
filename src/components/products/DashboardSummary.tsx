"use client";

import { cn } from "@/lib/utils";
import { ArrowDownWideNarrow } from "lucide-react";

export type SummaryFilter = "ALL" | "SOON" | "EXPIRED";

interface DashboardSummaryProps {
  /** Records that are past their expiry date and still active. */
  expired: number;
  /** Records inside the warning window or closer, active only. */
  expiring: number;
  total: number;
  /** Largest overdue run in whole days; shown under the expired cell. */
  maxOverdueDays: number;
  urgent: number;
  warning: number;
  active: number;
  archived: number;
  defect: number;
  /** Which cell is currently applied as a filter. */
  filter: string;
  onFilterChange: (filter: SummaryFilter) => void;
}

interface CellProps {
  label: string;
  value: number;
  hint: string;
  active: boolean;
  dotClass: string;
  valueClass: string;
  onClick: () => void;
}

function Cell({ label, value, hint, active, dotClass, valueClass, onClick }: CellProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[76px] flex-col justify-between gap-1 border-dash-line px-4 py-3 text-left transition-colors md:min-h-[126px] md:border-r md:px-6 md:py-4 last:border-r-0",
        "border-t md:border-t-0",
        active ? "bg-dash-soft" : "bg-dash-panel hover:bg-dash-surface",
      )}
    >
      <span className="flex items-start gap-2 text-[12px] font-bold leading-4 text-dash-ink-2 md:text-sm md:leading-5">
        <i className={cn("mt-1 size-2 shrink-0 rounded-full", dotClass)} aria-hidden="true" />
        {label}
      </span>
      <span className={cn("text-[28px] font-extrabold leading-9 tabular-nums md:text-[40px] md:leading-[48px]", valueClass)}>
        {value}
      </span>
      <span className="hidden text-[13px] font-semibold leading-5 text-dash-muted md:block">{hint}</span>
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 hidden h-[3px] bg-dash-accent md:block"
        />
      )}
    </button>
  );
}

/**
 * Three dashboard counters that double as filters. The chosen cell stays
 * highlighted, so the table below never hides why it shows fewer rows.
 */
export function DashboardSummary({
  expired,
  expiring,
  total,
  maxOverdueDays,
  urgent,
  warning,
  active,
  archived,
  defect,
  filter,
  onFilterChange,
}: DashboardSummaryProps) {
  return (
    <div
      role="group"
      aria-label="Сводка"
      className="grid grid-cols-3 overflow-hidden rounded-xl border border-dash-line bg-dash-panel md:gap-0"
    >
      <Cell
        label="Просрочено"
        value={expired}
        hint={expired > 0 ? `Просрочено на ${maxOverdueDays} дн.` : "Нет просроченных записей"}
        active={filter === "EXPIRED"}
        dotClass="bg-dash-expired"
        valueClass="text-dash-expired"
        onClick={() => onFilterChange("EXPIRED")}
      />
      <Cell
        label="Скоро истекает"
        value={expiring}
        hint={`Срочно: ${urgent} · Внимание: ${warning}`}
        active={filter === "SOON"}
        dotClass="bg-dash-amber-bar"
        valueClass="text-dash-amber-ink"
        onClick={() => onFilterChange("SOON")}
      />
      <Cell
        label="Всего"
        value={total}
        hint={`Активные: ${active} · Архив: ${archived} · Брак: ${defect}`}
        active={filter === "ALL"}
        dotClass="bg-dash-control"
        valueClass="text-dash-ink"
        onClick={() => onFilterChange("ALL")}
      />
    </div>
  );
}

export default DashboardSummary;
