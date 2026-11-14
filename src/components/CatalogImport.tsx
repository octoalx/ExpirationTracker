import { useEffect, useRef, useState } from "react";
import { Loader2, Database } from "lucide-react";
import { CATALOG_UPLOAD_HEADER_BYTES, MAX_DBF_BYTES, buildCatalogUploadBody, planChunks } from "@/lib/catalog-upload-format";

const fileInput = "block w-full text-[13px] leading-5 text-dash-ink-2 file:mr-3 file:min-h-11 file:rounded-[10px] file:border file:border-dash-control file:bg-white file:px-3 file:text-[13px] file:font-semibold file:text-dash-ink hover:file:bg-dash-surface disabled:opacity-55";
const CHUNK_ATTEMPTS = 3;
const MIB = 1024 * 1024;

interface UploadSuccess { imported: number; goodsRows: number; barcodeRows: number; deletedGoods: number; deletedBarcodes: number; duplicateBarcodes: number }
interface ByteRange { start: number; end: number }
/** A started upload for one exact pair of files; kept after a failure so the next save resumes it. */
interface PendingUpload { key: string; uploadId: string; totalBytes: number; chunkBytes: number }

const pairKey = (goods: File, barcodes: File) => [goods.name, goods.size, goods.lastModified, barcodes.name, barcodes.size, barcodes.lastModified].join("|");
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const retryHint = "Повторите загрузку этой же пары файлов — дубликаты не появятся.";

/**
 * Reads a response as text first and parses JSON only when the server says it is JSON.
 * An HTML page from a proxy becomes an error with its status code, never a parse error.
 */
async function readJson<T>(response: Response): Promise<T & { error?: string; confirmed?: number }> {
  const text = await response.text();
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  if (!isJson) {
    const hint = response.status === 413 ? "Часть файла отклонена сервером (лимит загрузки)." : "Сервер вернул ответ без данных.";
    throw new Error(`${hint} Код ответа ${response.status}. Число записей, сохранённых до сбоя, неизвестно. ${retryHint}`);
  }
  return JSON.parse(text) as T & { error?: string; confirmed?: number };
}

/** A rejection that retrying cannot fix: the server refused the part itself. */
class FinalUploadError extends Error {}

/** Sends one part. Refusals (4xx) are final; network errors and 5xx answers are retried. */
async function sendChunk(uploadId: string, offset: number, part: Blob): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`/api/admin/catalog-upload/chunk?uploadId=${encodeURIComponent(uploadId)}&offset=${offset}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: part,
      });
      if (response.status === 413) {
        throw new FinalUploadError(`Часть файла отклонена сервером (лимит загрузки). Код ответа 413. ${retryHint}`);
      }
      const body = await readJson<{ error?: string }>(response);
      if (!response.ok) {
        const text = `${body.error || "Ошибка загрузки части"}. ${retryHint}`;
        throw response.status < 500 ? new FinalUploadError(text) : new Error(text);
      }
      return;
    } catch (error) {
      if (error instanceof FinalUploadError || attempt >= CHUNK_ATTEMPTS) throw error;
      await sleep(1000 * attempt);
    }
  }
}

/** Parts that overlap any missing range still have to be sent. */
function isMissing(offset: number, length: number, missing: ByteRange[]) {
  return missing.some(range => range.start < offset + length && offset < range.end);
}

/**
 * Administrator update of the shared scanner catalog. The pair is split into parts of at most
 * 90 MB and sent one by one; a dropped connection resumes from the first missing part. The server
 * assembles the file and parses it before any write. Every response is checked for JSON first.
 */
export default function CatalogImport() {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [goodsFile, setGoodsFile] = useState<File | null>(null);
  const [barcodeFile, setBarcodeFile] = useState<File | null>(null);
  const pending = useRef<PendingUpload | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const fail = (text: string) => { setMessage(text); setFailed(true); };
  const progress = (text: string) => { if (mounted.current) setMessage(text); };

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
    progress("Загрузка каталога… Не закрывайте вкладку.");
    try {
      const body = buildCatalogUploadBody(goodsFile, barcodeFile);
      const key = pairKey(goodsFile, barcodeFile);
      let upload = pending.current;
      if (!upload || upload.key !== key) {
        const headerBytes = new Uint8Array(await body.slice(0, CATALOG_UPLOAD_HEADER_BYTES).arrayBuffer());
        const header = Array.from(headerBytes, byte => byte.toString(16).padStart(2, "0")).join("");
        const response = await fetch("/api/admin/catalog-upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalBytes: body.size, header }),
        });
        const started = await readJson<{ uploadId: string; chunkBytes: number }>(response);
        if (!response.ok) throw new Error(`${started.error || "Не удалось начать загрузку"}. ${retryHint}`);
        upload = { key, uploadId: started.uploadId, totalBytes: body.size, chunkBytes: started.chunkBytes };
        pending.current = upload;
      }

      const statusResponse = await fetch(`/api/admin/catalog-upload/status?uploadId=${encodeURIComponent(upload.uploadId)}`);
      const status = await readJson<{ missing: ByteRange[] }>(statusResponse);
      if (!statusResponse.ok) throw new Error(`${status.error || "Не удалось проверить загрузку"}. ${retryHint}`);

      const parts = planChunks(upload.totalBytes, upload.chunkBytes);
      const toSend = parts.filter(part => isMissing(part.offset, part.length, status.missing));
      const sentBefore = parts.length - toSend.length;
      let sent = parts.slice(0, sentBefore).reduce((sum, part) => sum + part.length, 0);
      for (const part of toSend) {
        progress(`Отправлено ${Math.round(sent / MIB)} из ${Math.round(upload.totalBytes / MIB)} МБ…`);
        await sendChunk(upload.uploadId, part.offset, body.slice(part.offset, part.offset + part.length));
        sent += part.length;
      }

      progress("Разбор и запись каталога на сервере…");
      const response = await fetch(`/api/admin/catalog-upload/finalize?uploadId=${encodeURIComponent(upload.uploadId)}`, { method: "POST" });
      const result = await readJson<Partial<UploadSuccess>>(response);
      if (!response.ok) {
        throw new Error(`${result.error || "Ошибка импорта"}. Подтверждено записей: ${result.confirmed ?? 0}; они остаются в каталоге. ${retryHint}`);
      }
      pending.current = null;
      if (!mounted.current) return;
      setMessage(`В каталог загружено товаров: ${result.imported}. Строк в goods.dbf: ${result.goodsRows}; в barcode.dbf: ${result.barcodeRows}. Удалённые строки пропущены: ${(result.deletedGoods ?? 0) + (result.deletedBarcodes ?? 0)}. Повторные одинаковые штрих-коды объединены: ${result.duplicateBarcodes}.`);
      setGoodsFile(null); setBarcodeFile(null);
    } catch (error) {
      if (mounted.current) fail(error instanceof Error ? `${error.message} Повторное сохранение продолжит загрузку с места обрыва.` : `Ошибка сети. ${retryHint}`);
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
      <p className="text-[12px] leading-4 text-dash-muted">Файлы отправляются на сервер частями по 90 МБ при сохранении и разбираются там. При ошибке разбора каталог не изменится. Каждый DBF — не больше 256 МБ, до 1 000 000 строк.</p>
      <button type="button" disabled={busy || !goodsFile || !barcodeFile} className="primary-action gap-2 text-[15px]" onClick={() => void save()}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {busy ? "Загрузка…" : "Сохранить каталог"}
      </button>
      <p role={failed ? "alert" : "status"} className={`text-[13px] leading-5 ${failed ? "text-dash-expired" : "text-dash-ink-2"}`}>{message}</p>
    </div>
  </section>;
}
