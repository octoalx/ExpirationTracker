import { useEffect, useRef, useState } from "react";
import { Loader2, Database } from "lucide-react";
import { type CatalogEntryInput } from "@/lib/catalog-parser";
import { importCatalogBatches } from "@/lib/catalog-import";
import { MAX_DBF_BYTES, type DbfCatalogResult } from "@/lib/catalog-dbf";

type DbfStats = Omit<DbfCatalogResult, "entries">;

const fileInput = "block w-full text-[13px] leading-5 text-dash-ink-2 file:mr-3 file:min-h-11 file:rounded-[10px] file:border file:border-dash-control file:bg-white file:px-3 file:text-[13px] file:font-semibold file:text-dash-ink hover:file:bg-dash-surface disabled:opacity-55";

/**
 * Administrator update of the shared scanner catalog. The goods.dbf + barcode.dbf pair is the
 * only way to extend it: parsing stays in a browser worker, saving is batched and retry-safe.
 */
export default function CatalogImport() {
  const [entries, setEntries] = useState<CatalogEntryInput[]>([]);
  const [stats, setStats] = useState<DbfStats | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [goodsFile, setGoodsFile] = useState<File | null>(null);
  const [barcodeFile, setBarcodeFile] = useState<File | null>(null);
  const mounted = useRef(true);
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; workerRef.current?.terminate(); }; }, []);

  const clearPreview = () => { setEntries([]); setStats(null); setMessage(""); setFailed(false); setCompleted(0); };
  const fail = (text: string) => { setMessage(text); setFailed(true); };

  const checkFiles = async () => {
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
      if (!mounted.current) return;
      const { entries: checked, ...counts } = result;
      setEntries(checked); setStats(counts); setMessage("Файлы проверены. Просмотрите примеры и сохраните каталог.");
    } catch (error) { if (mounted.current) fail(error instanceof Error ? error.message : "Не удалось прочитать DBF"); }
    finally { if (mounted.current) setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setMessage(""); setFailed(false); setCompleted(0);
    let confirmed = 0;
    try {
      const imported = await importCatalogBatches(entries, async batch => {
        const response = await fetch("/api/admin/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: batch }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Ошибка импорта");
        return result.imported;
      }, count => { confirmed = count; if (mounted.current) setCompleted(count); });
      if (mounted.current) { setMessage(`В каталог загружено товаров: ${imported}`); setEntries([]); setStats(null); }
    } catch (error) {
      if (mounted.current) fail(`${error instanceof Error ? error.message : "Ошибка сети"}. Подтверждено записей: ${confirmed} из ${entries.length}; они остаются в каталоге. Повторите загрузку этой же пары файлов — дубликаты не появятся.`);
    } finally { if (mounted.current) setBusy(false); }
  };

  return <section className="rounded-xl border border-dash-line bg-dash-panel">
    <div className="space-y-3 p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold leading-5 text-dash-ink">
        <Database className="size-4 shrink-0 text-dash-accent" aria-hidden="true" />
        Обновить общий каталог штрих-кодов
      </h2>
      <p className="text-[13px] leading-5 text-dash-muted">Каталог подставляет название по штрих-коду. Это единственный способ пополнить его: нужны только <strong>goods.dbf</strong> и <strong>barcode.dbf</strong> из одной свежей выгрузки. Остальные файлы загружать не нужно.</p>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">goods.dbf — названия товаров</span>
        <input type="file" accept=".dbf" disabled={busy} className={fileInput} onChange={event => { clearPreview(); setGoodsFile(event.target.files?.[0] ?? null); }} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">barcode.dbf — штрих-коды товаров</span>
        <input type="file" accept=".dbf" disabled={busy} className={fileInput} onChange={event => { clearPreview(); setBarcodeFile(event.target.files?.[0] ?? null); }} />
      </label>
      <button type="button" disabled={busy || !goodsFile || !barcodeFile} onClick={() => void checkFiles()}
        className="min-h-11 rounded-[10px] border border-dash-control bg-white px-4 text-[14px] font-semibold text-dash-ink hover:bg-dash-surface disabled:opacity-55">
        Проверить файлы базы
      </button>
      <p className="text-[12px] leading-4 text-dash-muted">До сохранения файлы проверяются на вашем устройстве и на сервер не отправляются. При ошибке каталог не изменится. До 1 000 000 строк в каждом DBF, до 256 МБ на файл.</p>
      {entries.length > 0 && <>
        {stats && <p className="text-[13px] leading-5 text-dash-ink">Строк в goods.dbf: <span className="tabular-nums font-semibold">{stats.goodsRows}</span>; в barcode.dbf: <span className="tabular-nums font-semibold">{stats.barcodeRows}</span>. Удалённые строки пропущены: <span className="tabular-nums">{stats.deletedGoods + stats.deletedBarcodes}</span>. Повторные одинаковые штрих-коды объединены: <span className="tabular-nums">{stats.duplicateBarcodes}</span>.</p>}
        <p className="text-[13px] leading-5 text-dash-ink">К сохранению: <span className="tabular-nums font-semibold">{entries.length}</span> товаров. Совпадающие штрих-коды обновят названия для всех пользователей; коды, которых нет в выгрузке, останутся. Товары и сроки пользователей не изменятся.</p>
        <ul className="max-h-32 overflow-auto rounded-[10px] border border-dash-line bg-dash-surface px-3 py-2 text-[12px] leading-4 tabular-nums text-dash-ink-2" aria-label="Предпросмотр каталога">
          {entries.slice(0, 100).map(entry => <li key={entry.barcode}>{entry.barcode} — {entry.name}</li>)}
        </ul>
        {entries.length > 100 && <p className="text-[12px] leading-4 text-dash-muted">Показаны первые 100 записей. Будут сохранены все {entries.length}. Дождитесь завершения, не закрывая вкладку.</p>}
        <button type="button" disabled={busy} className="primary-action gap-2 text-[15px]" onClick={() => void save()}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {busy ? "Загрузка…" : "Сохранить каталог"}
        </button>
        {completed > 0 && <progress className="block h-2 w-full" max={entries.length} value={completed} aria-label="Ход сохранения" />}
        {completed > 0 && <p className="text-[13px] leading-5 text-dash-ink-2 tabular-nums">Подтверждено записей: {completed} из {entries.length}</p>}
      </>}
      <p role={failed ? "alert" : "status"} className={`text-[13px] leading-5 ${failed ? "text-dash-expired" : "text-dash-ink-2"}`}>{message}</p>
    </div>
  </section>;
}
