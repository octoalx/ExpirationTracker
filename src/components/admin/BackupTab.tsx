import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Download, Upload, Database, AlertTriangle,
  FileJson, CheckCircle, Loader2, History, Clock,
  RotateCcw, Save, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface AutoBackup {
  name: string;
  size: number;
  createdAt: string;
  path: string;
}

/** Formats byte count into a human-readable size string. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formats an ISO timestamp using the ru-RU locale. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Admin tab for database export/import and automatic backup management. */
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

  // Auto-backup list state
  const [autoBackups, setAutoBackups] = useState<AutoBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingBackup, setDeletingBackup] = useState<string | null>(null);

  // Backup schedule settings
  const [backupTime, setBackupTime] = useState("03:00");
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchAutoBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/admin/auto-backups");
      if (res.ok) {
        const data = await res.json();
        setAutoBackups(data.backups || []);
      }
    } catch {
      toast.error("Ошибка загрузки бэкапов");
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchAutoBackups();
    fetchBackupSettings();
  }, []);

  const fetchBackupSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setBackupTime(data.settings?.backupTime ?? "03:00");
        setBackupEnabled(data.settings?.backupEnabled ?? true);
      }
    } catch {
      // ignore
    }
  };

  const saveBackupSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: {},
          settings: { backupTime, backupEnabled },
        }),
      });
      if (res.ok) {
        toast.success("Настройки сохранены");
      } else {
        toast.error("Ошибка сохранения");
      }
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/auto-backups", { method: "POST" });
      if (res.ok) {
        toast.success("Бэкап создан");
        fetchAutoBackups();
      } else {
        toast.error("Ошибка создания бэкапа");
      }
    } catch {
      toast.error("Ошибка создания бэкапа");
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadBackup = (filename: string) => {
    window.open(`/api/admin/auto-backups/${encodeURIComponent(filename)}`, "_blank");
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`Восстановить базу из бэкапа "${filename}"?\n\nТекущие данные будут заменены.`)) {
      return;
    }
    setRestoring(filename);
    try {
      const res = await fetch(`/api/admin/auto-backups/${encodeURIComponent(filename)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "replace" }),
      });
      if (res.ok) {
        toast.success("База восстановлена. Перезагрузка...");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const err = await res.json();
        toast.error(err.message || "Ошибка восстановления");
      }
    } catch {
      toast.error("Ошибка восстановления");
    } finally {
      setRestoring(null);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Удалить бэкап "${filename}"?`)) {
      return;
    }
    setDeletingBackup(filename);
    try {
      const res = await fetch(`/api/admin/auto-backups/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Бэкап удален");
        fetchAutoBackups();
      } else {
        toast.error("Ошибка удаления");
      }
    } catch {
      toast.error("Ошибка удаления");
    } finally {
      setDeletingBackup(null);
    }
  };

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
      {/* Auto Backups Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 dark:bg-blue-900/50 p-3">
              <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Автоматические бэкапы</h3>
              <p className="text-sm text-slate-500">
                {backupEnabled ? `Ежедневно в ${backupTime}, хранится 30 копий` : "Автобэкапы отключены"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Enable toggle */}
            <button
              onClick={() => setBackupEnabled(!backupEnabled)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                backupEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
              )}
              title={backupEnabled ? "Отключить" : "Включить"}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  backupEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <Button
              onClick={handleCreateBackup}
              disabled={creating}
              variant="outline"
              className="border-blue-200 hover:bg-blue-50"
            >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Создать сейчас
            </Button>
          </div>
        </div>

        {/* Time settings */}
        <div className="mb-4 flex flex-wrap items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Время бэкапа:</span>
            <input
              type="time"
              value={backupTime}
              onChange={(e) => setBackupTime(e.target.value)}
              disabled={!backupEnabled}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm bg-white dark:bg-slate-800 disabled:opacity-50"
            />
          </div>
          <Button
            size="sm"
            onClick={saveBackupSettings}
            disabled={savingSettings}
            className="bg-[#1554b5] hover:bg-[#12479a] text-white"
          >
            {savingSettings ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            Сохранить
          </Button>
        </div>

        {loadingBackups ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : autoBackups.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Clock className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Автобэкапов пока нет</p>
            <p className="text-xs mt-1">Проверьте расписание автоматического резервного копирования.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {autoBackups.map((backup) => (
              <div
                key={backup.name}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">{formatDate(backup.createdAt)}</p>
                    <p className="text-xs text-slate-500">{formatSize(backup.size)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownloadBackup(backup.name)}
                    className="size-11 p-0"
                    title="Скачать"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRestoreBackup(backup.name)}
                    disabled={restoring === backup.name}
                    className="size-11 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    title="Восстановить"
                  >
                    {restoring === backup.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBackup(backup.name)}
                    disabled={deletingBackup === backup.name}
                    className="size-11 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Удалить"
                  >
                    {deletingBackup === backup.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          <span>Всего: {autoBackups.length} / 30 бэкапов</span>
        </div>
      </div>

      {/* Export */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-blue-100 dark:bg-blue-900/50 p-3">
            <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Экспорт данных</h3>
            <p className="text-sm text-slate-500">Скачать полный бэкап базы данных</p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting}
          className="bg-[#1554b5] hover:bg-[#12479a] text-white"
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
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-4 sm:p-6">
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
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
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
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-slate-600">Импорт данных...</span>
          </div>
        )}

        {/* Import results */}
        {importResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30"
          >
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900 dark:text-blue-400">Импорт завершен</span>
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
              <li>• JSON не содержит паролей. При объединении пароли существующих пользователей сохраняются; после замены потребуется восстановить доступ.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
