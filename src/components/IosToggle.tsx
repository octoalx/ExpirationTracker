import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface IosToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function IosToggle({ checked, onChange, disabled = false }: IosToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full",
        "transition-colors duration-300 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        checked
          ? "bg-emerald-500"
          : "bg-slate-300 dark:bg-slate-600",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "pointer-events-none block h-5.5 w-5.5 rounded-full bg-white shadow-md",
          "ring-0",
        )}
        style={{ marginLeft: checked ? "calc(100% - 1.625rem)" : "0.125rem" }}
      />
    </button>
  );
}
