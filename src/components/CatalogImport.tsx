import { useState } from "react";
import { Loader2, FileUp } from "lucide-react";
import { decodeProductText, parseCatalogCsv, type CatalogEntryInput } from "@/lib/catalog-parser";

/** Import a catalog independently from tracked inventory batches. */
export default function CatalogImport() {
  const [entries, setEntries] = useState<CatalogEntryInput[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="rounded-xl border border-dash-line bg-dash-panel">
    <details>
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 py-3 text-[15px] font-extrabold leading-5 text-dash-ink">
        <FileUp className="size-4 shrink-0 text-dash-accent" aria-hidden="true" />
        Загрузить каталог товаров из CSV
      </summary>
      <div className="space-y-3 border-t border-dash-line p-4 md:p-5">
        <p className="text-[13px] leading-5 text-dash-muted">Каталог подставляет название по штрих-коду. Партии со сроками добавляются отдельно.</p>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold leading-5 text-dash-ink-2">CSV: штрих-код и наименование товара</span>
          <input type="file" accept=".csv" disabled={busy} className="block w-full text-[13px] leading-5 text-dash-ink-2 file:mr-3 file:min-h-11 file:rounded-[10px] file:border file:border-dash-control file:bg-white file:px-3 file:text-[13px] file:font-semibold file:text-dash-ink hover:file:bg-dash-surface disabled:opacity-55" onChange={async e => {
            const file = e.target.files?.[0];
            setEntries([]); setMessage("");
            if (!file) return;
            setBusy(true);
            try {
              if (file.size > 2 * 1024 * 1024) throw new Error("Файл превышает 2 МБ");
              setEntries(parseCatalogCsv(decodeProductText(await file.arrayBuffer())));
            } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось прочитать CSV"); }
            finally { setBusy(false); }
          }} />
        </label>
        {entries.length > 0 && <>
          <p className="text-[13px] leading-5 text-dash-ink">Найдено товаров: <span className="tabular-nums font-semibold">{entries.length}</span>. Совпадающие штрих-коды обновят названия в вашем каталоге.</p>
          <ul className="max-h-32 overflow-auto rounded-[10px] border border-dash-line bg-dash-surface px-3 py-2 text-[12px] leading-4 tabular-nums text-dash-ink-2" aria-label="Предпросмотр каталога">
            {entries.map(entry => <li key={entry.barcode}>{entry.barcode} — {entry.name}</li>)}
          </ul>
          <button type="button" disabled={busy} className="primary-action gap-2 text-[15px]" onClick={async () => {
            setBusy(true); setMessage("");
            try {
              const response = await fetch("/api/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries }) });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || "Ошибка импорта");
              setMessage(`В каталог загружено товаров: ${result.imported}`); setEntries([]);
            } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка сети"); }
            finally { setBusy(false); }
          }}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? "Загрузка…" : "Сохранить каталог"}
          </button>
        </>}
        <p role="status" className="text-[13px] leading-5 text-dash-ink-2">{message}</p>
      </div>
    </details>
  </section>;
}
