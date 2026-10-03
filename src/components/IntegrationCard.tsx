import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import IosToggle from "@/components/IosToggle";

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
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
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-white">
        {/* Card header */}
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-700 text-white shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <IosToggle label={`Уведомления ${title}`} checked={enabled} onChange={onToggle} />
          <button
            type="button"
            aria-label={`${expanded ? "Свернуть" : "Настроить"} ${title}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
            className={cn(
              "flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors duration-200",
            )}
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="block"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </button>
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
              <div className="px-4 py-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
