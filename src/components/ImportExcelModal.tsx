import { useState, useCallback, useRef } from "react";
import { FileSpreadsheet, Upload, Loader2, CheckCircle2, AlertCircle, X, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setState("idle");
    setPreview(null);
    setFile(null);
    setImportedCount(0);
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
      if (result.errors.length) {
        setPreview(null);
        setState("error");
        setErrorMessage(result.errors.join("; "));
        return;
      }
      const products = result.products;
      const fileType = { inventory: "Инвентаризация", catalog: "Каталог товаров", simple: "Простая таблица" }[result.fileType];

      if (products.length === 0) {
        setState("error");
        setErrorMessage("Не найдено товаров в файле");
        return;
      }

      setPreview({ fileType, fileName: selectedFile.name, products });
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
        toast.success(`Импортировано ${data.imported} товаров`);
        onImportComplete();
      } else {
        setState("error");
        setErrorMessage(data.error || data.errors?.join(", ") || "Ошибка импорта");
      }
    } catch {
      setState("error");
      setErrorMessage("Ошибка сети");
    }
  }, [preview, onImportComplete]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Импорт из Excel
          </DialogTitle>
          <DialogDescription>
            Загрузите Excel-файл для импорта товаров. Поддерживаются инвентаризация, каталог и простая таблица: первая строка — заголовки; столбцы — штрих-код, название, дата, срок в месяцах. Если срок пустой, дата означает окончание годности; иначе — изготовление. Даты: ДД.ММ.ГГГГ или дата Excel.
          </DialogDescription>
        </DialogHeader>

        {/* Idle / File Drop Zone */}
        {(state === "idle" || state === "error") && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 mx-auto text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Перетащите файл сюда или нажмите для выбора
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Поддерживаются .xls и .xlsx
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
          </div>
        )}

        {/* Error message */}
        {state === "error" && errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
          </div>
        )}

        {/* Preview */}
        {state === "previewing" && preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {preview.fileName}
                </p>
                <p className="text-xs text-slate-500">
                  Тип: <span className="font-medium text-blue-600">{preview.fileType}</span>
                  {" · "}
                  Найдено товаров: <span className="font-medium">{preview.products.length}</span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Штрихкод</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Наименование</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500">Кол-во</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Годен до</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {preview.products.slice(0, 50).map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 group">
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-400">
                        {p.barcode}
                      </td>
                      <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                        {p.name}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">
                        {p.quantity ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">{p.expiryDate ? p.expiryDate.split("-").reverse().join(".") : "—"}</td>
                      <td className="px-1 py-1.5">
                        <button
                          onClick={() => removeProduct(i)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-opacity"
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.products.length > 50 && (
                <p className="text-xs text-center text-slate-500 py-2">
                  ... и ещё {preview.products.length - 50} товаров
                </p>
              )}
            </div>
          </div>
        )}

        {/* Uploading */}
        {state === "uploading" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Импортируем товары...</p>
          </div>
        )}

        {/* Success */}
        {state === "success" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="h-10 w-10 text-blue-600" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Успешно импортировано: {importedCount} товаров
            </p>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {state === "previewing" && preview && (
            <Button onClick={handleImport} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Upload className="h-4 w-4 mr-2" />
              Импортировать {preview.products.length} товаров
            </Button>
          )}
          {state === "success" && (
            <Button onClick={() => handleClose(false)} className="bg-blue-600 hover:bg-blue-700 text-white">
              Закрыть
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
