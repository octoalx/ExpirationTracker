import { useEffect, useRef, useState } from "react";
import { Check, FileUp } from "lucide-react";
import { decodeProductText, parseCatalogCsv, validateCatalogEntries, type CatalogEntryInput } from "@/lib/catalog-parser";
import { importCatalogBatches } from "@/lib/catalog-import";
import { MAX_DBF_BYTES, type DbfCatalogResult } from "@/lib/catalog-dbf";

/** Import a catalog independently from tracked inventory batches. */
export default function CatalogImport() {
  const [entries, setEntries] = useState<CatalogEntryInput[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [goodsFile, setGoodsFile] = useState<File | null>(null);
  const [barcodeFile, setBarcodeFile] = useState<File | null>(null);
  const [dbfStats, setDbfStats] = useState<Omit<DbfCatalogResult, "entries"> | null>(null);
  const mounted = useRef(true);
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; workerRef.current?.terminate(); }; }, []);
  const clearPreview = () => { setEntries([]); setDbfStats(null); setMessage(""); setCompleted(0); };
  const checkDbf = async () => {
    if (!goodsFile || !barcodeFile) return;
    clearPreview(); setBusy(true); setMessage("Проверяем файлы базы…");
    try {
      if (goodsFile.name.toLowerCase() !== "goods.dbf" || barcodeFile.name.toLowerCase() !== "barcode.dbf") throw new Error("Выберите goods.dbf и barcode.dbf из одной выгрузки");
      if (goodsFile.size > MAX_DBF_BYTES || barcodeFile.size > MAX_DBF_BYTES) throw new Error("Каждый DBF-файл должен быть не больше 256 МБ");
      const [goods, barcodes] = await Promise.all([goodsFile.arrayBuffer(), barcodeFile.arrayBuffer()]);
      if (!mounted.current) return;
      const result = await new Promise<DbfCatalogResult>((resolve, reject) => {
        const worker = new Worker(new URL("../lib/catalog-dbf.worker.ts", import.meta.url));
        workerRef.current = worker;
        const stop = () => { worker.terminate(); workerRef.current = null; };
        worker.onmessage = (event: MessageEvent<{ result?: DbfCatalogResult; error?: string }>) => {
          stop();
          if (event.data.error) reject(new Error(event.data.error));
          else if (event.data.result) resolve(event.data.result);
          else reject(new Error("Не удалось проверить DBF"));
        };
        worker.onerror = () => { stop(); reject(new Error("Не удалось проверить DBF. Повторите проверку файлов.")); };
        worker.postMessage({ goods, barcodes }, [goods, barcodes]);
      });
      const { entries: checked, ...stats } = result;
      setEntries(checked); setDbfStats(stats); setMessage("Файлы проверены. Проверьте предпросмотр и сохраните каталог.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось прочитать DBF"); }
    finally { setBusy(false); }
  };
  return <section aria-label="Обновление каталога">
    <h2 className="text-base font-bold text-slate-900">Обновить каталог</h2>
    <p className="mt-2 text-sm text-slate-600">Два файла из одной выгрузки Copyright Base.</p>
    <div className="my-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { id: "catalog-goods", name: "goods.dbf", description: "Названия товаров", file: goodsFile, select: setGoodsFile },
          { id: "catalog-barcodes", name: "barcode.dbf", description: "Штрихкоды товаров", file: barcodeFile, select: setBarcodeFile },
        ] as const).map(({ id, name, description, file, select }) => <label key={id} htmlFor={id} className={`relative flex min-w-0 items-center gap-3 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-blue-500"} ${file ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-slate-50"}`}>
          <input id={id} type="file" accept=".dbf" disabled={busy} className="peer sr-only" aria-label={`Выбрать ${name}`} onChange={event => { clearPreview(); select(event.target.files?.[0] ?? null); }} />
          {file ? <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-700" /> : <FileUp aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-900">{name}</span>
            <span className="mt-1 block text-xs text-slate-600">{description}</span>
            <span className="mt-2 block text-sm font-semibold text-blue-700">{file ? "Заменить файл" : "Выбрать файл"}</span>
            {file && <span className="mt-1 block break-all text-xs text-slate-700">{file.name} · {(file.size / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ</span>}
          </span>
        </label>)}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <button type="button" disabled={busy || !goodsFile || !barcodeFile} onClick={() => void checkDbf()} className="min-h-11 rounded-lg bg-[#1554b5] px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600">{busy ? "Обработка…" : "Проверить файлы"}</button>
        <p role="status" className="text-xs text-slate-600">Выбрано файлов: {Number(!!goodsFile) + Number(!!barcodeFile)} из 2</p>
      </div>
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer py-2 font-medium">О проверке и лимитах</summary>
        <p className="mt-1 leading-relaxed">Файлы проверяются на вашем устройстве. При ошибке каталог не изменится. До 1 000 000 строк в каждом DBF, до 256 МБ на файл.</p>
      </details>
    </div>
    <details>
    <summary className="cursor-pointer py-2 text-sm">Другие форматы: Excel или CSV</summary>
    <label className="block text-sm">
      Excel: инвентаризация или каталог. CSV: штрих-код и наименование товара, до 500 000 строк.
      <input type="file" accept=".xls,.xlsx,.csv" disabled={busy} className="mt-2 block w-full text-sm" onChange={async e => {
        const file = e.target.files?.[0];
        clearPreview();
        if (!file) return;
        setBusy(true);
        try {
          const csv = file.name.toLowerCase().endsWith(".csv");
          const limit = csv ? 100 : 10;
          if (file.size > limit * 1024 * 1024) throw new Error(`Файл превышает ${limit} МБ`);
          const buffer = await file.arrayBuffer();
          if (csv) {
            setEntries(parseCatalogCsv(decodeProductText(buffer), 500000));
          } else {
            const { parseExcelFile } = await import("@/lib/excel-parser");
            const result = parseExcelFile(buffer);
            if (result.errors.length) throw new Error(result.errors.join("; "));
            setEntries(validateCatalogEntries(result.products));
          }
        } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось прочитать файл"); }
        finally { setBusy(false); }
      }} />
    </label>
    </details>
    {entries.length > 0 && <>
      {dbfStats && <details className="my-2 text-xs text-slate-600"><summary className="cursor-pointer py-2">Результаты проверки</summary><p>Строк в goods.dbf: {dbfStats.goodsRows}; в barcode.dbf: {dbfStats.barcodeRows}. Удалённые строки пропущены: {dbfStats.deletedGoods + dbfStats.deletedBarcodes}. Одинаковые повторные штрихкоды объединены: {dbfStats.duplicateBarcodes}.</p></details>}
      <p className="my-3 text-sm font-semibold">Найдено товаров: {entries.length.toLocaleString("ru-RU")}</p>
      <ul className="max-h-32 overflow-auto text-xs text-slate-600" aria-label="Предпросмотр каталога">
        {entries.slice(0, 100).map(entry => <li key={entry.barcode}>{entry.barcode} — {entry.name}</li>)}
      </ul>
      {entries.length > 100 && <p className="mt-2 text-xs">Показаны первые 100 записей. Загружены будут все {entries.length}.</p>}
      <p className="mt-3 text-xs leading-relaxed text-slate-600">Новые штрихкоды добавятся, совпадающие названия обновятся. Остальные записи и товары пользователей сохранятся. Повторная загрузка не создаёт дубликаты.</p>
      <p className="mt-2 text-xs text-slate-600">Не закрывайте вкладку до завершения загрузки.</p>
      <button type="button" disabled={busy} className="mt-3 rounded-lg bg-[#1554b5] px-3 py-2 text-sm text-white disabled:opacity-50" onClick={async () => {
        setBusy(true); setMessage(""); setCompleted(0);
        try {
          const imported = await importCatalogBatches(entries, async batch => {
            const response = await fetch("/api/admin/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: batch }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Ошибка импорта");
            return result.imported;
          }, setCompleted);
          setMessage(`В каталог загружено товаров: ${imported}`); setEntries([]);
        } catch (error) { setMessage(`${error instanceof Error ? error.message : "Ошибка сети"}. Сохранённые части остаются в каталоге. Повторите загрузку этого файла — дубликаты не появятся.`); }
        finally { setBusy(false); }
      }}>{busy ? "Загрузка…" : "Сохранить каталог"}</button>
      {completed > 0 && <p role="status" className="mt-2 text-sm">Подтверждено записей: {completed}</p>}
    </>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
