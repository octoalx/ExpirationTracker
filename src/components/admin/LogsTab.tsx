import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText, AlertTriangle, AlertCircle, Info,
  ChevronLeft, ChevronRight, Loader2, Filter, Calendar, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

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

const levelColors = {
  ERROR: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
  WARN: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
  INFO: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
};

export default function LogsTab() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
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
        toast.success("Лог удален");
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
    if (!confirm("Удалить все логи?")) return;
    setClearingAll(true);
    try {
      const res = await fetch(`/api/admin/logs?clearAll=true`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Все логи очищены");
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          {["", "INFO", "WARN", "ERROR"].map((level) => (
            <button
              key={level || "all"}
              onClick={() => {
                setLevelFilter(level);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                levelFilter === level
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              )}
            >
              {level || "Все"}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClearAll}
          disabled={clearingAll || logs.length === 0}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          {clearingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
          Очистить все
        </Button>
      </div>

      {/* Logs list */}
      <div className="space-y-2">
        {logs.map((log) => {
          const Icon = levelIcons[log.level as keyof typeof levelIcons] || Info;
          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-4"
            >
              <div className="flex items-start gap-3">
                <div className={cn("rounded-lg p-2", levelColors[log.level as keyof typeof levelColors] || levelColors.INFO)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      levelColors[log.level as keyof typeof levelColors] || levelColors.INFO
                    )}>
                      {log.level}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(log.timestamp).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{log.message}</p>
                  {log.meta && (
                    <pre className="mt-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg overflow-x-auto">
                      {log.meta}
                    </pre>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteLog(log.id)}
                  disabled={deletingId === log.id}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Удалить"
                >
                  {deletingId === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {logs.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Логов не найдено</p>
        </div>
      )}
    </div>
  );
}
