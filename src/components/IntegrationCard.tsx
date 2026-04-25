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
  gradient: string;
  children: React.ReactNode;
}

export default function IntegrationCard({
  title,
  description,
  icon,
  enabled,
  onToggle,
  gradient,
  children,
}: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative rounded-2xl p-px overflow-hidden">
      <div className={cn("absolute inset-0 rounded-2xl bg-linear-to-br opacity-50", gradient)} />
      <div className="relative rounded-2xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center gap-4 p-4">
          <div className={cn("flex items-center justify-center w-11 h-11 rounded-xl bg-linear-to-br shrink-0", gradient)}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          </div>
          <IosToggle checked={enabled} onChange={onToggle} />
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={cn(
              "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200",
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

        {/* Expandable content */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100 dark:border-slate-800">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
