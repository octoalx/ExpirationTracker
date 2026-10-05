import { useEffect, useRef, useState } from "react";
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
  return <details open className="rounded-xl border border-slate-200 p-3">
    <summary className="cursor-pointer text-sm font-medium">Обновить общий каталог штрихкодов</summary>
    <p className="my-2 text-sm text-slate-500">Каталог подставляет название по штрих-коду. Партии со сроками добавляются отдельно.</p>
    <div className="my-4 space-y-3">
      <p className="text-sm">Из папки Copyright Base нужны только <strong>goods.dbf</strong> и <strong>barcode.dbf</strong>. Выберите оба файла из одной свежей выгрузки. Остальные 15 файлов загружать не нужно.</p>
      <label className="block text-sm">goods.dbf — названия товаров
        <input type="file" accept=".dbf" disabled={busy} className="mt-2 block w-full text-sm" onChange={event => { clearPreview(); setGoodsFile(event.target.files?.[0] ?? null); }} />
      </label>
      <label className="block text-sm">barcode.dbf — штрихкоды товаров
        <input type="file" accept=".dbf" disabled={busy} className="mt-2 block w-full text-sm" onChange={event => { clearPreview(); setBarcodeFile(event.target.files?.[0] ?? null); }} />
      </label>
      <button type="button" disabled={busy || !goodsFile || !barcodeFile} onClick={() => void checkDbf()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">{busy ? "Обработка…" : "Проверить файлы базы"}</button>
      <p className="text-xs text-slate-500">До сохранения файлы проверяются на вашем устройстве. При ошибке каталог не изменится. До 1 000 000 строк в каждом DBF, до 256 МБ на файл.</p>
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
      {dbfStats && <p className="my-2 text-sm">Строк в goods.dbf: {dbfStats.goodsRows}; в barcode.dbf: {dbfStats.barcodeRows}. Удалённые строки пропущены: {dbfStats.deletedGoods + dbfStats.deletedBarcodes}. Одинаковые повторные штрихкоды объединены: {dbfStats.duplicateBarcodes}.</p>}
      <p className="my-2 text-sm">Найдено товаров: {entries.length}. Совпадающие штрих-коды обновят названия в общем каталоге для всех пользователей.</p>
      <ul className="max-h-32 overflow-auto text-xs text-slate-600" aria-label="Предпросмотр каталога">
        {entries.slice(0, 100).map(entry => <li key={entry.barcode}>{entry.barcode} — {entry.name}</li>)}
      </ul>
      {entries.length > 100 && <p className="mt-2 text-xs">Показаны первые 100 записей. Загружены будут все {entries.length}.</p>}
      <p className="mt-2 text-sm">Существующие названия с совпадающим штрих-кодом будут заменены. Повторная загрузка не создаёт дубликаты.</p>
      <p className="mt-2 text-sm">Товары, которых нет в новой выгрузке, останутся в справочнике. Главные таблицы пользователей не изменятся. Дождитесь завершения загрузки, не закрывая вкладку.</p>
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
    <p role="status" className="mt-2 text-sm">{message}</p>
  </details>;
}
