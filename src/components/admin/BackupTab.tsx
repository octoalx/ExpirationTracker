import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Download, Upload, Database, AlertTriangle, 
  FileJson, CheckCircle, Loader2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function BackupTab() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importResult, setImportResult] = useState<{
    success: boolean;
    results?: {
      users: { created: number; updated: number; skipped: number };
      products: { created: number; updated: number; skipped: number };
      settings: { created: number; updated: number; skipped: number };
    };
  } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expitrack-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Бэкап скачан");
    } catch {
      toast.error("Ошибка экспорта");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      toast.error("Только JSON файлы");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, mode: importMode }),
      });

      const result = await res.json();
      if (res.ok) {
        setImportResult(result);
        toast.success("Импорт завершен");
      } else {
        toast.error(result.message || "Ошибка импорта");
      }
    } catch {
      toast.error("Неверный формат файла");
    } finally {
      setImporting(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImport(e.dataTransfer.files[0]);
    }
  }, [importMode]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImport(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/50 p-3">
            <Download className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Экспорт данных</h3>
            <p className="text-sm text-slate-500">Скачать полный бэкап базы данных</p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {exporting ? "Экспорт..." : "Скачать JSON"}
        </Button>
      </div>

      {/* Import */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-blue-100 dark:bg-blue-900/50 p-3">
            <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Импорт данных</h3>
            <p className="text-sm text-slate-500">Восстановление из JSON бэкапа</p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          {["merge", "replace"].map((mode) => (
            <button
              key={mode}
              onClick={() => setImportMode(mode as "merge" | "replace")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                importMode === mode
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              )}
            >
              {mode === "merge" ? "Объединить" : "Заменить всё"}
            </button>
          ))}
        </div>

        {importMode === "replace" && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Режим "Заменить" удалит все текущие данные перед импортом</span>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "relative rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragActive
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
              : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
          )}
        >
          <input
            type="file"
            accept=".json"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <FileJson className="h-10 w-10 mx-auto mb-3 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Перетащите JSON файл или нажмите для выбора
          </p>
          <p className="text-xs text-slate-500 mt-1">Поддерживаются файлы от 0.1 до 50 MB</p>
        </div>

        {importing && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="ml-2 text-sm text-slate-600">Импорт данных...</span>
          </div>
        )}

        {/* Import results */}
        {importResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30"
          >
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <span className="font-medium text-emerald-900 dark:text-emerald-400">Импорт завершен</span>
            </div>
            {importResult.results && (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                  <p className="text-slate-500 text-xs">Пользователи</p>
                  <p className="font-medium">
                    +{importResult.results.users.created} / ~{importResult.results.users.updated}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                  <p className="text-slate-500 text-xs">Товары</p>
                  <p className="font-medium">
                    +{importResult.results.products.created} / ~{importResult.results.products.updated}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                  <p className="text-slate-500 text-xs">Настройки</p>
                  <p className="font-medium">
                    +{importResult.results.settings.created} / ~{importResult.results.settings.updated}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex items-start gap-2">
          <Database className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-medium mb-1">О бэкапах</p>
            <ul className="space-y-1 text-xs">
              <li>• Бэкап включает: пользователей, товары, настройки, логи</li>
              <li>• Режим "Объединить" — обновляет существующие, добавляет новые</li>
              <li>• Режим "Заменить" — полная очистка перед импортом</li>
              <li>• Email и пароли пользователей сохраняются</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
