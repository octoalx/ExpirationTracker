import toast, { useToaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  success: { icon: CheckCircle2, color: "text-blue-700" },
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

/** Brief confirmations stay above phone navigation and respect reduced motion. */
export default function Toaster() {
  const { toasts, handlers } = useToaster();
  const { startPause, endPause } = handlers;

  return (
    <div
      className="work-toasts fixed right-4 z-9990 flex flex-col-reverse gap-2 max-w-sm pointer-events-none"
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
                role={type === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={cn(
                  "pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3",
                  "bg-white",
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
                  aria-label="Закрыть уведомление"
                  className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
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
