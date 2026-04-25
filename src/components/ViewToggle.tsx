import { LayoutGrid, Table } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "table";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const options: { mode: ViewMode; icon: React.ElementType; label: string }[] = [
  { mode: "grid", icon: LayoutGrid, label: "Сетка" },
  { mode: "table", icon: Table, label: "Таблица" },
];

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="relative inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-0.5">
      {options.map((opt) => {
        const active = value === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => onChange(opt.mode)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
              "transition-colors duration-200",
              active
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            {active && (
              <motion.span
                layoutId="view-toggle-pill"
                className="absolute inset-0 rounded-lg bg-white dark:bg-slate-700 shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <opt.icon className="h-3.5 w-3.5" />
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
