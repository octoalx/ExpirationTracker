import { useEffect, useRef, useState } from "react";
import { Loader2, Database } from "lucide-react";
import { MAX_DBF_BYTES, buildCatalogUploadBody } from "@/lib/catalog-upload-format";

const fileInput = "block w-full text-[13px] leading-5 text-dash-ink-2 file:mr-3 file:min-h-11 file:rounded-[10px] file:border file:border-dash-control file:bg-white file:px-3 file:text-[13px] file:font-semibold file:text-dash-ink hover:file:bg-dash-surface disabled:opacity-55";

interface UploadSuccess { imported: number; goodsRows: number; barcodeRows: number; deletedGoods: number; deletedBarcodes: number; duplicateBarcodes: number }

/**
 * Administrator update of the shared scanner catalog. The goods.dbf + barcode.dbf pair is sent
 * to the server in one request on save; the server parses and writes it. Every response is read
 * as text first, so an HTML error page from a proxy is reported with its status, not as a parse error.
 */
export default function CatalogImport() {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [goodsFile, setGoodsFile] = useState<File | null>(null);
  const [barcodeFile, setBarcodeFile] = useState<File | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const fail = (text: string) => { setMessage(text); setFailed(true); };

  const save = async () => {
    if (!goodsFile || !barcodeFile) return;
    setMessage(""); setFailed(false);
    if (goodsFile.name.toLowerCase() !== "goods.dbf" || barcodeFile.name.toLowerCase() !== "barcode.dbf") {
      return fail("Выберите goods.dbf и barcode.dbf из одной выгрузки");
    }
    if (goodsFile.size > MAX_DBF_BYTES || barcodeFile.size > MAX_DBF_BYTES) {
      return fail("Каждый DBF-файл должен быть не больше 256 МБ");
    }
    setBusy(true);
    setMessage("Загрузка и запись каталога… Не закрывайте вкладку.");
    try {
      const response = await fetch("/api/admin/catalog-upload", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buildCatalogUploadBody(goodsFile, barcodeFile),
      });
      const text = await response.text();
      const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
      if (!isJson) {
        const hint = response.status === 413 ? "Файлы слишком большие для сервера (лимит загрузки)." : "Сервер вернул ответ без данных.";
        throw new Error(`${hint} Код ответа ${response.status}. Число записей, сохранённых до сбоя, неизвестно. Повторите загрузку этой же пары файлов — дубликаты не появятся.`);
      }
      const body = JSON.parse(text) as Partial<UploadSuccess> & { error?: string; confirmed?: number };
      if (!response.ok) {
        throw new Error(`${body.error || "Ошибка импорта"}. Подтверждено записей: ${body.confirmed ?? 0}; они остаются в каталоге. Повторите загрузку этой же пары файлов — дубликаты не появятся.`);
      }
      if (!mounted.current) return;
      setMessage(`В каталог загружено товаров: ${body.imported}. Строк в goods.dbf: ${body.goodsRows}; в barcode.dbf: ${body.barcodeRows}. Удалённые строки пропущены: ${(body.deletedGoods ?? 0) + (body.deletedBarcodes ?? 0)}. Повторные одинаковые штрих-коды объединены: ${body.duplicateBarcodes}.`);
      setGoodsFile(null); setBarcodeFile(null);
    } catch (error) {
      if (mounted.current) fail(error instanceof Error ? error.message : "Ошибка сети. Повторите загрузку этой же пары файлов — дубликаты не появятся.");
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
        <input type="file" accept=".dbf" disabled={busy} className={fileInput} onChange={event => { setGoodsFile(event.target.files?.[0] ?? null); setMessage(""); setFailed(false); }} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">barcode.dbf — штрих-коды товаров</span>
        <input type="file" accept=".dbf" disabled={busy} className={fileInput} onChange={event => { setBarcodeFile(event.target.files?.[0] ?? null); setMessage(""); setFailed(false); }} />
      </label>
      <p className="text-[12px] leading-4 text-dash-muted">Файлы отправляются на сервер при сохранении и разбираются там. При ошибке разбора каталог не изменится. Каждый DBF — не больше 256 МБ, до 1 000 000 строк.</p>
      <button type="button" disabled={busy || !goodsFile || !barcodeFile} className="primary-action gap-2 text-[15px]" onClick={() => void save()}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {busy ? "Загрузка…" : "Сохранить каталог"}
      </button>
      <p role={failed ? "alert" : "status"} className={`text-[13px] leading-5 ${failed ? "text-dash-expired" : "text-dash-ink-2"}`}>{message}</p>
    </div>
  </section>;
}
