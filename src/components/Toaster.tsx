import toast, { useToaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  success: { icon: CheckCircle2, color: "text-emerald-500" },
  error: { icon: XCircle, color: "text-red-500" },
  info: { icon: Info, color: "text-blue-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500" },
} as const;

type ToastType = keyof typeof iconMap;

function getToastType(t: { type: string }): ToastType {
  if (t.type === "success") return "success";
  if (t.type === "error") return "error";
  return "info";
}

/** Custom animated toast renderer with glassmorphism styling. */
export default function Toaster() {
  const { toasts, handlers } = useToaster();
  const { startPause, endPause } = handlers;

  return (
    <div
      className="fixed bottom-4 right-4 z-9990 flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none"
      onMouseEnter={startPause}
      onMouseLeave={endPause}
    >
      <AnimatePresence>
        {toasts
          .filter((t) => t.visible)
          .slice(0, 5)
          .map((t) => {
            const type = getToastType(t);
            const { icon: Icon, color } = iconMap[type];

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={cn(
                  "pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3",
                  "bg-white/90 dark:bg-slate-900/90",
                  "backdrop-blur-xl",
                  "border border-slate-200/60 dark:border-slate-700/40",
                  "shadow-lg shadow-black/5 dark:shadow-black/20",
                )}
              >
                <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", color)} />
                <div className="flex-1 min-w-0 text-sm font-medium text-foreground">
                  {typeof t.message === "function"
                    ? t.message(t)
                    : t.message}
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="shrink-0 rounded-lg p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
      </AnimatePresence>
    </div>
  );
}

/** Typed toast helpers for success, error, info, and warning notifications. */
export const notify = {
  success: (message: string) => toast.success(message, { duration: 3000 }),
  error: (message: string) => toast.error(message, { duration: 4000 }),
  info: (message: string) => toast(message, { duration: 3000 }),
  warning: (message: string) =>
    toast(message, {
      duration: 3500,
      icon: "⚠️",
    }),
};
