import { useState, useEffect } from "react";
import {
  FileText, AlertTriangle, AlertCircle, Info,
  ChevronLeft, ChevronRight, Loader2, Calendar, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import ConfirmAction from "@/components/admin/ConfirmAction";

interface SystemLog {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  meta: string | null;
}

const levelIcons = {
  ERROR: AlertCircle,
  WARN: AlertTriangle,
  INFO: Info,
};

/** Level badges keep the dashboard palette: red for errors, amber for warnings, accent for notes. */
const levelColors = {
  ERROR: "bg-dash-expired-soft text-dash-expired",
  WARN: "bg-expiry-soft text-dash-amber-ink",
  INFO: "bg-dash-soft text-dash-accent",
};

const ICON_ACTION =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] text-dash-ink-2 transition-colors hover:bg-dash-surface hover:text-dash-ink disabled:opacity-55";

/** Admin tab displaying paginated system logs with level filtering. */
export default function LogsTab() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const limit = 25;

  const fetchLogs = async () => {
    try {
      const query = new URLSearchParams();
      query.set("page", page.toString());
      query.set("limit", limit.toString());
      if (levelFilter) query.set("level", levelFilter);

      const res = await fetch(`/api/admin/logs?${query}`);
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch {
      toast.error("Ошибка загрузки логов");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/logs?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Запись журнала удалена");
        fetchLogs();
      } else {
        toast.error("Ошибка удаления");
      }
    } catch {
      toast.error("Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      const res = await fetch(`/api/admin/logs?clearAll=true`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Все логи очищены");
        setConfirmClear(false);
        setPage(1);
        fetchLogs();
      } else {
        toast.error("Ошибка очистки");
      }
    } catch {
      toast.error("Ошибка очистки");
    } finally {
      setClearingAll(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, levelFilter]);

  if (loading) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 rounded-xl border border-dash-line bg-dash-panel py-10 text-[13px] leading-5 text-dash-muted">
        <Loader2 className="size-4 animate-spin text-dash-accent" aria-hidden="true" />
        Загружаем журнал…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {["", "INFO", "WARN", "ERROR"].map((level) => (
            <button
              key={level || "all"}
              type="button"
              aria-pressed={levelFilter === level}
              onClick={() => {
                setLevelFilter(level);
                setPage(1);
              }}
              className={cn(
                "inline-flex min-h-11 items-center rounded-[10px] border px-3 text-[13px] font-semibold transition-colors",
                levelFilter === level
                  ? "border-dash-accent bg-dash-soft text-dash-accent"
                  : "border-dash-line bg-dash-panel text-dash-ink-2 hover:bg-dash-surface hover:text-dash-ink",
              )}
            >
              {({ INFO: "Инфо", WARN: "Предупреждения", ERROR: "Ошибки" } as Record<string, string>)[level] || "Все"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={clearingAll || logs.length === 0}
          className="dialog-action-danger gap-2 text-[13px]"
        >
          {clearingAll ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
          Очистить все
        </button>
      </div>

      {/* Logs list: one panel, rows split by a hairline */}
      {logs.length === 0 ? (
        <div className="rounded-xl border border-dash-line bg-dash-panel py-12 text-center text-dash-muted">
          <FileText className="mx-auto mb-3 size-10 opacity-40" aria-hidden="true" />
          <p className="text-sm leading-5">Логов не найдено</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dash-line bg-dash-panel">
          {logs.map((log) => {
            const Icon = levelIcons[log.level as keyof typeof levelIcons] || Info;
            const colors = levelColors[log.level as keyof typeof levelColors] || levelColors.INFO;
            return (
              <div key={log.id} className="flex items-start gap-3 border-b border-dash-line p-4 last:border-0">
                <div className={cn("rounded-[10px] p-2", colors)}>
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold leading-4", colors)}>
                      {log.level}
                    </span>
                    <span className="flex items-center gap-1 text-[12px] leading-4 text-dash-muted">
                      <Calendar className="size-3" aria-hidden="true" />
                      {new Date(log.timestamp).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <p className="break-words text-sm leading-5 text-dash-ink">{log.message}</p>
                  {log.meta && (
                    <details className="mt-2">
                      <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-dash-accent">Технические сведения</summary>
                      <pre className="max-w-full overflow-x-auto rounded-[10px] bg-dash-surface p-3 text-[12px] leading-4 text-dash-ink-2">
                        {log.meta}
                      </pre>
                    </details>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteLog(log.id)}
                  disabled={deletingId === log.id}
                  aria-label="Удалить запись журнала"
                  title="Удалить"
                  className={cn(ICON_ACTION, "text-dash-expired hover:bg-dash-expired-soft hover:text-dash-expired")}
                >
                  {deletingId === log.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Предыдущая страница"
            className={ICON_ACTION}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="px-3 text-[13px] leading-5 tabular-nums text-dash-ink-2">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Следующая страница"
            className={ICON_ACTION}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <ConfirmAction
        open={confirmClear}
        title="Очистить журнал?"
        description="Все записи журнала будут удалены. Действие необратимо."
        confirmLabel="Очистить все"
        busy={clearingAll}
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => void handleClearAll()}
      />
    </div>
  );
}
