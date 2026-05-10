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

interface ImportExcelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface PreviewData {
  fileType: string;
  fileName: string;
  products: Array<{ barcode: string; name: string; quantity: number | null }>;
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
      // Parse file on the client for preview
      const XLSX = await import("xlsx");
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const ws = workbook.Sheets[workbook.SheetNames[0]];

      if (!ws) {
        setState("error");
        setErrorMessage("Файл пустой");
        return;
      }

      // Detect file type by structure
      let fileType: string;
      let isInventory = false;
      let products: Array<{ barcode: string; name: string; quantity: number | null }> = [];

      // Check for "Inventory" marker in the first 5 rows
      for (let r = 0; r < 5; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
        if (cell && typeof cell.v === "string" && cell.v.includes("Инвентаризационная опись")) {
          isInventory = true;
          break;
        }
      }
      // Also check for header row with "Артикул" + "Наименование"
      if (!isInventory) {
        for (let r = 15; r < 22; r++) {
          const artCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
          const nameCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
          if (
            artCell && typeof artCell.v === "string" && artCell.v.includes("Артикул") &&
            nameCell && typeof nameCell.v === "string" && nameCell.v.includes("Наименование")
          ) {
            isInventory = true;
            break;
          }
        }
      }

      if (isInventory) {
        fileType = "Инвентаризация";
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
        // Locate header row containing "Артикул"
        let headerRow = 17;
        for (let r = 10; r < 25; r++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
          if (cell && typeof cell.v === "string" && cell.v.includes("Артикул")) {
            headerRow = r;
            break;
          }
        }
        for (let r = headerRow + 1; r <= range.e.r; r++) {
          const barcodeCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
          const nameCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
          const qtyCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
          const barcode = barcodeCell ? String(barcodeCell.v).trim() : "";
          const name = nameCell ? String(nameCell.v).trim() : "";
          if (!barcode || !name || name.toLowerCase().startsWith("всего")) continue;
          let quantity: number | null = null;
          if (qtyCell?.v !== undefined && qtyCell.v !== "") {
            const parsed = Number(qtyCell.v);
            if (!isNaN(parsed) && parsed > 0) quantity = Math.round(parsed);
          }
          products.push({ barcode, name, quantity });
        }
      } else {
        fileType = "Каталог товаров";
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
        // Map columns by header text
        let barcodeCol = 3, nameCol = 5, qtyCol = 8;
        for (let c = range.s.c; c <= Math.min(range.e.c, 40); c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
          if (cell && typeof cell.v === "string") {
            const val = cell.v.trim().toLowerCase();
            if (val.includes("штрих-код осн")) barcodeCol = c;
            else if (val === "наименование товара") nameCol = c;
            else if (val === "доступно") qtyCol = c;
          }
        }
        for (let r = 1; r <= range.e.r; r++) {
          const barcodeCell = ws[XLSX.utils.encode_cell({ r, c: barcodeCol })];
          const nameCell = ws[XLSX.utils.encode_cell({ r, c: nameCol })];
          const qtyCell = ws[XLSX.utils.encode_cell({ r, c: qtyCol })];
          const barcode = barcodeCell ? String(barcodeCell.v).trim() : "";
          const name = nameCell ? String(nameCell.v).trim() : "";
          if (!barcode || !name) continue;
          let quantity: number | null = null;
          if (qtyCell?.v !== undefined && qtyCell.v !== "") {
            const parsed = Number(qtyCell.v);
            if (!isNaN(parsed) && parsed > 0) quantity = Math.round(parsed);
          }
          products.push({ barcode, name, quantity });
        }
      }

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
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Импорт из Excel
          </DialogTitle>
          <DialogDescription>
            Загрузите Excel-файл для импорта товаров. Поддерживаются файлы инвентаризации и каталога товаров.
          </DialogDescription>
        </DialogHeader>

        {/* Idle / File Drop Zone */}
        {(state === "idle" || state === "error") && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all cursor-pointer"
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
                  Тип: <span className="font-medium text-emerald-600">{preview.fileType}</span>
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
            <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Импортируем товары...</p>
          </div>
        )}

        {/* Success */}
        {state === "success" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Успешно импортировано: {importedCount} товаров
            </p>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {state === "previewing" && preview && (
            <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Upload className="h-4 w-4 mr-2" />
              Импортировать {preview.products.length} товаров
            </Button>
          )}
          {state === "success" && (
            <Button onClick={() => handleClose(false)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Закрыть
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
