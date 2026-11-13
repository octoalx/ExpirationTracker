import React, { useState, useCallback, useRef } from "react";
import { FileSpreadsheet, Upload, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import type { ParsedProduct } from "@/lib/excel-parser";

interface ImportExcelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface PreviewData {
  fileType: string;
  fileName: string;
  products: ParsedProduct[];
  /** Rows the file lost while parsing, with their Excel row numbers and reasons. */
  rowErrors: string[];
}

type ImportState = "idle" | "previewing" | "uploading" | "success" | "error";

/** Modal dialog for importing products from an Excel file (inventory or catalog format). */
export default function ImportExcelModal({
  open,
  onOpenChange,
  onImportComplete,
}: ImportExcelModalProps) {
  const [state, setState] = useState<ImportState>("idle");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  /** Reasons for every refused row: those the parser dropped and those the server refused. */
  const [rejectedReasons, setRejectedReasons] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setState("idle");
    setPreview(null);
    setFile(null);
    setImportedCount(0);
    setSkippedCount(0);
    setRejectedCount(0);
    setRejectedReasons([]);
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) reset();
      onOpenChange(open);
    },
    [onOpenChange, reset],
  );

  const removeProduct = useCallback((index: number) => {
    if (!preview) return;
    const updated = preview.products.filter((_, i) => i !== index);
    if (updated.length === 0) {
      reset();
    } else {
      setPreview({ ...preview, products: updated });
    }
  }, [preview, reset]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setState("previewing");
    setErrorMessage("");

    try {
      const { parseExcelFile } = await import("@/lib/excel-parser");
      const result = parseExcelFile(await selectedFile.arrayBuffer());
      const products = result.products;
      const fileType = { inventory: "Инвентаризация", catalog: "Каталог товаров", simple: "Простая таблица" }[result.fileType];

      // A broken row costs only that row: the rest of the file is still importable,
      // and the dialog names the rows it had to leave out.
      if (products.length === 0) {
        setState("error");
        setErrorMessage(result.errors.length
          ? `В файле нет строк для импорта. ${result.errors.join("; ")}`
          : "Не найдено товаров в файле");
        return;
      }

      setPreview({ fileType, fileName: selectedFile.name, products, rowErrors: result.errors });
    } catch {
      setState("error");
      setErrorMessage("Не удалось прочитать файл. Убедитесь что это Excel-файл (.xls или .xlsx)");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect],
  );

  const handleImport = useCallback(async () => {
    if (!preview || preview.products.length === 0) return;
    setState("uploading");

    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: preview.products }),
      });

      const data = await res.json();

      if (res.ok) {
        setState("success");
        setImportedCount(data.imported);
        setSkippedCount(data.skipped ?? 0);
        // A row refused earlier could not even be sent: the parser dropped it
        // before the request. Report it here, or the owner would see a clean
        // "imported 0, already 2" and believe the whole file landed.
        const parserErrors = preview.rowErrors;
        const rejectedTotal = (data.rejected ?? 0) + parserErrors.length;
        setRejectedCount(rejectedTotal);
        setRejectedReasons([...parserErrors, ...(Array.isArray(data.errors) ? data.errors : [])]);
        const parts = [`Импортировано ${data.imported}`];
        if (data.skipped) parts.push(`уже было ${data.skipped}`);
        if (rejectedTotal) parts.push(`не принято ${rejectedTotal}`);
        const summary = parts.join(", ");
        if (rejectedTotal) toast(summary, { icon: "⚠️" });
        else toast.success(summary);
        onImportComplete();
      } else {
        setState("error");
        setErrorMessage(data.message || data.error || data.errors?.join(", ") || "Ошибка импорта");
      }
    } catch {
      setState("error");
      setErrorMessage("Ошибка сети");
    }
  }, [preview, onImportComplete]);

  const foundCount = preview?.products.length ?? 0;
  const errorCount = preview?.rowErrors.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="work-panel product-dialog sm:max-w-lg max-h-[90dvh] overflow-y-auto"
        aria-describedby="import-description"
      >
        <DialogHeader>
          <DialogTitle>Импорт из Excel</DialogTitle>
          <DialogDescription id="import-description" className="text-[13px] leading-5 text-dash-ink-2">
            Поддерживаются инвентаризация, каталог и простая таблица: первая строка — заголовки;
            столбцы — штрих-код, название, дата, срок в месяцах. Если срок пустой, дата означает
            окончание годности; иначе — изготовление. Даты: ДД.ММ.ГГГГ или дата Excel.
            Строки с ошибкой пропускаются, остальные загружаются.
          </DialogDescription>
        </DialogHeader>

        {/* File picker: one zone, one click, no nested disclosures. */}
        {(state === "idle" || state === "error") && (
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="import-drop"
            >
              <Upload aria-hidden="true" className="size-8" />
              <span className="import-drop-title">Перетащите файл сюда или нажмите для выбора</span>
              <span className="import-drop-hint">Поддерживаются .xls и .xlsx</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFileSelect(selected);
              }}
            />
          </div>
        )}

        {state === "error" && errorMessage && (
          <p role="alert" className="form-error"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{errorMessage}</p>
        )}

        {state === "previewing" && preview && (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="import-summary">
              <div className="min-w-0">
                <p className="import-file-name">{preview.fileName}</p>
                <p className="import-file-meta">Тип: <strong>{preview.fileType}</strong></p>
              </div>
              <div className="import-counts">
                <span>Найдено строк: <strong>{foundCount}</strong></span>
                <span className={errorCount > 0 ? "import-count-error" : undefined}>Строк с ошибкой: <strong>{errorCount}</strong></span>
              </div>
            </div>

            {errorCount > 0 && (
              <div className="import-warning">
                <p className="import-warning-title">
                  <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
                  Строк с ошибкой: {errorCount} — они не загрузятся
                </p>
                <ul className="import-warning-list">
                  {preview.rowErrors.map((error, i) => <li key={i}>{error}</li>)}
                </ul>
              </div>
            )}

            <div className="import-table-wrap">
              <table className="import-table">
                <caption className="sr-only">Предпросмотр строк файла</caption>
                <thead>
                  <tr>
                    <th scope="col">Штрихкод</th>
                    <th scope="col">Наименование</th>
                    <th scope="col" className="text-right">Кол-во</th>
                    <th scope="col">Годен до</th>
                    <th scope="col"><span className="sr-only">Действие</span></th>
                  </tr>
                </thead>
                <tbody>
                  {preview.products.slice(0, 50).map((p, i) => (
                    <tr key={i}>
                      <td className="import-cell-code">{p.barcode}</td>
                      <td className="import-cell-name">{p.name}</td>
                      <td className="text-right tabular-nums">{p.quantity ?? "—"}</td>
                      <td className="tabular-nums">{p.expiryDate ? p.expiryDate.split("-").reverse().join(".") : "—"}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => removeProduct(i)}
                          aria-label={`Убрать строку ${i + 1}`}
                          className="import-row-remove"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {foundCount > 50 && (
                <p className="import-more">… и ещё {foundCount - 50} строк</p>
              )}
            </div>
          </div>
        )}

        {state === "uploading" && (
          <p role="status" className="flex items-center justify-center gap-3 py-8 text-dash-ink-2">
            <Loader2 aria-hidden="true" className="size-6 animate-spin text-dash-accent" />
            Импортируем товары…
          </p>
        )}

        {state === "success" && (
          <div className="flex flex-col gap-2 py-2">
            <p className="flex items-center gap-2 text-[15px] font-bold text-dash-ink">
              <CheckCircle2 aria-hidden="true" className={`size-6 ${rejectedCount > 0 ? "text-dash-amber-ink" : "text-dash-accent"}`} />
              Успешно импортировано: {importedCount} товаров
            </p>
            {skippedCount > 0 && <p className="text-[13px] text-dash-ink-2">Уже были в таблице: {skippedCount}</p>}
            {rejectedCount > 0 && <p className="text-[13px] font-semibold text-dash-amber-ink">Не загружено из-за ошибок: {rejectedCount}</p>}
            {rejectedReasons.length > 0 && (
              <div className="import-warning">
                <p className="import-warning-title">Не приняты строки:</p>
                <ul className="import-warning-list">
                  {rejectedReasons.map((error, i) => <li key={i}>{error}</li>)}
                </ul>
                <p className="import-warning-foot">
                  Эти строки не попали в таблицу. Исправьте их в файле и загрузите его снова — уже загруженное не удвоится.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="product-dialog-actions">
          {state === "previewing" && preview && (
            <button type="button" className="dialog-action-secondary" onClick={reset}>Другой файл</button>
          )}
          {state === "previewing" && preview && (
            <button type="button" className="primary-action dialog-action-primary" onClick={handleImport}>
              <Upload aria-hidden="true" className="size-4" />
              Импортировать {foundCount} товаров
            </button>
          )}
          {state === "success" && (
            <button type="button" className="primary-action dialog-action-primary" onClick={() => handleClose(false)}>Закрыть</button>
          )}
          {(state === "idle" || state === "error") && (
            <button type="button" className="dialog-action-secondary" onClick={() => handleClose(false)}>Отмена</button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
