import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
}

/**
 * The application switch on the dashboard tokens: a 44 px target around a 24 px
 * track, so the phone keeps the touch size while the visible control stays small.
 */
export function IntegrationSwitch({ label, checked, onChange, disabled = false }:
  { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[10px] p-2 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <motion.span
        aria-hidden="true"
        animate={{ backgroundColor: checked ? "#1554b5" : "#76828f" }}
        transition={{ duration: 0.2 }}
        className="relative flex h-6 w-11 items-center rounded-full"
      >
        <motion.span
          animate={{ x: checked ? 22 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="block size-5 rounded-full bg-white shadow-sm"
        />
      </motion.span>
    </button>
  );
}

/** Expandable card with toggle for enabling/disabling an integration. */
export default function IntegrationCard({
  title,
  description,
  icon,
  enabled,
  onToggle,
  children,
}: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-[10px] border border-dash-line">
      <div className="bg-dash-panel">
        {/* Card header: on a phone the controls drop to a second row, so the title keeps its width. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-dash-soft text-dash-accent">
            {icon}
          </div>
          <div className="min-w-0 flex-1 basis-40">
            <h3 className="text-[15px] font-extrabold leading-5 text-dash-ink">{title}</h3>
            <p className="mt-1 text-[13px] leading-5 text-dash-muted">{description}</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <IntegrationSwitch label={`Уведомления ${title}`} checked={enabled} onChange={onToggle} />
            <button
              type="button"
              aria-label={`${expanded ? "Свернуть" : "Настроить"} ${title}`}
              aria-expanded={expanded}
              onClick={() => setExpanded((prev) => !prev)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-dash-muted transition-colors hover:bg-dash-surface hover:text-dash-ink"
            >
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="block"
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </motion.span>
            </button>
          </div>
        </div>

        {/* Collapsible details */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-3 border-t border-dash-line px-4 py-4">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
