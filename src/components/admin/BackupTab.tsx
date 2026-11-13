import { useState, useCallback, useEffect } from "react";
import {
  Download, Upload, Database, AlertTriangle,
  FileJson, CheckCircle, Loader2, History, Clock,
  RotateCcw, Save, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { IntegrationSwitch } from "@/components/IntegrationCard";
import ConfirmAction from "@/components/admin/ConfirmAction";

interface AutoBackup {
  name: string;
  size: number;
  createdAt: string;
  path: string;
}

/** The dashboard field look: control border, a 44 px target, the same focus ring. */
const FIELD =
  "w-full min-w-0 min-h-11 rounded-[10px] border border-dash-control bg-white px-3 py-2 text-[15px] leading-5 text-dash-ink tabular-nums transition-colors placeholder:text-dash-muted focus-visible:border-dash-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/35 disabled:cursor-not-allowed disabled:border-dash-line disabled:bg-dash-surface disabled:text-dash-ink-2";

const ICON_ACTION =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] text-dash-ink-2 transition-colors hover:bg-dash-surface hover:text-dash-ink disabled:opacity-55";

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

/** Section heading: an accent icon, a bold title and a one-line note. */
function SectionTitle({ icon: Icon, title, note }: { icon: React.ElementType; title: string; note: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-dash-soft text-dash-accent" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-extrabold leading-5 text-dash-ink">{title}</h3>
        <p className="mt-1 text-[13px] leading-5 text-dash-muted">{note}</p>
      </div>
    </div>
  );
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
      products: { created: number; updated: number; skipped: number; missingDepartment: number };
      settings: { created: number; updated: number; skipped: number };
    };
  } | null>(null);

  // Auto-backup list state
  const [autoBackups, setAutoBackups] = useState<AutoBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingBackup, setDeletingBackup] = useState<string | null>(null);

  // Restoring and deleting a copy ask in the app dialog, not in a browser window.
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
    setRestoring(filename);
    try {
      const res = await fetch(`/api/admin/auto-backups/${encodeURIComponent(filename)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "replace" }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const skipped = Number(data?.skippedProducts ?? 0);
        setRestoreTarget(null);
        toast.success(skipped > 0
          ? `База восстановлена. ${skipped} товаров пропущено: нет отдела. Перезагрузка...`
          : "База восстановлена. Перезагрузка...");
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
    setDeletingBackup(filename);
    try {
      const res = await fetch(`/api/admin/auto-backups/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
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
    <div className="space-y-4">
      {/* Auto Backups */}
      <section className="space-y-4 rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            icon={History}
            title="Автоматические бэкапы"
            note={backupEnabled ? `Ежедневно в ${backupTime}, хранится 30 копий` : "Автобэкапы отключены"}
          />
          <div className="flex items-center gap-1">
            <IntegrationSwitch label="Автоматические бэкапы" checked={backupEnabled} onChange={setBackupEnabled} />
            <button type="button" onClick={handleCreateBackup} disabled={creating} className="dialog-action-secondary gap-2">
              {creating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
              Создать сейчас
            </button>
          </div>
        </div>

        {/* Time settings */}
        <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-dash-line bg-dash-surface p-3">
          <label className="min-w-40">
            <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">Время бэкапа</span>
            <input
              type="time"
              value={backupTime}
              onChange={(e) => setBackupTime(e.target.value)}
              disabled={!backupEnabled}
              aria-label="Время бэкапа"
              className={cn(FIELD, "w-auto")}
            />
          </label>
          <button type="button" onClick={saveBackupSettings} disabled={savingSettings} className="primary-action gap-2 text-[15px]">
            {savingSettings && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Сохранить
          </button>
        </div>

        {loadingBackups ? (
          <p role="status" className="flex items-center justify-center gap-2 py-6 text-[13px] leading-5 text-dash-muted">
            <Loader2 className="size-4 animate-spin text-dash-accent" aria-hidden="true" />
            Загружаем копии…
          </p>
        ) : autoBackups.length === 0 ? (
          <div className="py-6 text-center text-dash-muted">
            <Clock className="mx-auto mb-2 size-8 opacity-40" aria-hidden="true" />
            <p className="text-sm leading-5 text-dash-ink-2">Автобэкапов пока нет</p>
            <p className="mt-1 text-[13px] leading-5">Проверьте расписание автоматического резервного копирования.</p>
          </div>
        ) : (
          <ul className="max-h-64 divide-y divide-dash-line overflow-y-auto rounded-[10px] border border-dash-line">
            {autoBackups.map((backup) => (
              <li key={backup.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Database className="size-4 shrink-0 text-dash-muted" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-5 tabular-nums text-dash-ink">{formatDate(backup.createdAt)}</p>
                    <p className="text-[12px] leading-4 tabular-nums text-dash-muted">{formatSize(backup.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => handleDownloadBackup(backup.name)} className={ICON_ACTION} title="Скачать" aria-label="Скачать копию">
                    <Download className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoreTarget(backup.name)}
                    disabled={restoring === backup.name}
                    className={cn(ICON_ACTION, "text-dash-accent hover:bg-dash-soft hover:text-dash-accent")}
                    title="Восстановить" aria-label="Восстановить из копии"
                  >
                    {restoring === backup.name ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(backup.name)}
                    disabled={deletingBackup === backup.name}
                    className={cn(ICON_ACTION, "text-dash-expired hover:bg-dash-expired-soft hover:text-dash-expired")}
                    title="Удалить" aria-label="Удалить копию"
                  >
                    {deletingBackup === backup.name ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-center gap-2 text-[13px] leading-5 tabular-nums text-dash-muted">
          <Clock className="size-3" aria-hidden="true" />
          Всего: {autoBackups.length} / 30 бэкапов
        </p>
      </section>

      {/* Export */}
      <section className="space-y-4 rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
        <SectionTitle icon={Download} title="Экспорт данных" note="Скачать полный бэкап базы данных" />
        <button type="button" onClick={handleExport} disabled={exporting} className="primary-action gap-2 text-[15px]">
          {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
          {exporting ? "Экспорт..." : "Скачать JSON"}
        </button>
      </section>

      {/* Import */}
      <section className="space-y-4 rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
        <SectionTitle icon={Upload} title="Импорт данных" note="Восстановление из JSON бэкапа" />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Режим импорта">
          {["merge", "replace"].map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={importMode === mode}
              onClick={() => setImportMode(mode as "merge" | "replace")}
              className={cn(
                "inline-flex min-h-11 items-center rounded-[10px] border px-3 text-[13px] font-semibold transition-colors",
                importMode === mode
                  ? "border-dash-accent bg-dash-soft text-dash-accent"
                  : "border-dash-line bg-dash-panel text-dash-ink-2 hover:bg-dash-surface hover:text-dash-ink",
              )}
            >
              {mode === "merge" ? "Объединить" : "Заменить всё"}
            </button>
          ))}
        </div>

        {importMode === "replace" && (
          <div className="import-warning">
            <p className="import-warning-title">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              Режим &quot;Заменить&quot; удалит все текущие данные перед импортом
            </p>
          </div>
        )}

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn("import-drop relative", dragActive && "border-dash-accent bg-dash-soft")}
        >
          <input
            type="file"
            accept=".json"
            aria-label="Файл JSON для импорта"
            onChange={handleFileInput}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <FileJson className="size-8 text-dash-muted" aria-hidden="true" />
          <p className="import-drop-title">Перетащите JSON файл или нажмите для выбора</p>
          <p className="import-drop-hint">Поддерживаются файлы от 0.1 до 50 MB</p>
        </div>

        {importing && (
          <p role="status" className="flex items-center justify-center gap-2 py-2 text-[13px] leading-5 text-dash-muted">
            <Loader2 className="size-4 animate-spin text-dash-accent" aria-hidden="true" />
            Импорт данных...
          </p>
        )}

        {importResult && (
          <div className="space-y-3 rounded-[10px] border border-dash-line bg-dash-surface p-3">
            <p className="flex items-center gap-2 text-[15px] font-extrabold leading-5 text-dash-ink">
              <CheckCircle className="size-5 text-dash-accent" aria-hidden="true" />
              Импорт завершен
            </p>
            {importResult.results && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-[10px] border border-dash-line bg-dash-panel px-3 py-2">
                  <p className="text-[12px] leading-4 text-dash-muted">Пользователи</p>
                  <p className="text-sm font-semibold tabular-nums text-dash-ink">
                    +{importResult.results.users.created} / ~{importResult.results.users.updated}
                  </p>
                </div>
                <div className="rounded-[10px] border border-dash-line bg-dash-panel px-3 py-2">
                  <p className="text-[12px] leading-4 text-dash-muted">Товары</p>
                  <p className="text-sm font-semibold tabular-nums text-dash-ink">
                    +{importResult.results.products.created} / ~{importResult.results.products.updated}
                  </p>
                </div>
                <div className="rounded-[10px] border border-dash-line bg-dash-panel px-3 py-2">
                  <p className="text-[12px] leading-4 text-dash-muted">Настройки</p>
                  <p className="text-sm font-semibold tabular-nums text-dash-ink">
                    +{importResult.results.settings.created} / ~{importResult.results.settings.updated}
                  </p>
                </div>
              </div>
            )}
            {importResult.results?.products.missingDepartment > 0 && (
              <p className="text-[13px] leading-5 text-dash-amber-ink">
                {importResult.results.products.missingDepartment} товаров пропущено: нет отдела.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Info */}
      <section className="rounded-xl border border-dash-line bg-dash-surface p-4 md:p-5">
        <div className="flex items-start gap-2">
          <Database className="mt-0.5 size-4 shrink-0 text-dash-muted" aria-hidden="true" />
          <div className="min-w-0">
            <p className="mb-1 text-[13px] font-extrabold leading-5 text-dash-ink">О бэкапах</p>
            <ul className="space-y-1 text-[13px] leading-5 text-dash-ink-2">
              <li>• Бэкап включает: пользователей, товары, настройки, логи</li>
              <li>• Режим &quot;Объединить&quot; — обновляет существующие, добавляет новые</li>
              <li>• Режим &quot;Заменить&quot; — полная очистка перед импортом</li>
              <li>• JSON не содержит паролей. При объединении пароли существующих пользователей сохраняются; после замены потребуется восстановить доступ.</li>
            </ul>
          </div>
        </div>
      </section>

      <ConfirmAction
        open={!!restoreTarget}
        title={`Восстановить базу из бэкапа "${restoreTarget ?? ""}"?`}
        description="Текущие данные будут заменены. После восстановления страница перезагрузится."
        confirmLabel="Восстановить"
        danger
        onCancel={() => setRestoreTarget(null)}
        onConfirm={() => { if (restoreTarget) void handleRestoreBackup(restoreTarget); }}
      />

      <ConfirmAction
        open={!!deleteTarget}
        title={`Удалить бэкап "${deleteTarget ?? ""}"?`}
        description="Копия будет удалена из хранилища. Действие необратимо."
        confirmLabel="Удалить копию"
        busy={deletingBackup !== null}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) void handleDeleteBackup(deleteTarget); }}
      />
    </div>
  );
}
