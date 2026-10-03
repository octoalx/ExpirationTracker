import { useState } from "react";
import { decodeProductText, parseCatalogCsv, type CatalogEntryInput } from "@/lib/catalog-parser";

/** Import a catalog independently from tracked inventory batches. */
export default function CatalogImport() {
  const [entries, setEntries] = useState<CatalogEntryInput[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <details className="rounded-xl border border-slate-200 p-3">
    <summary className="cursor-pointer text-sm font-medium">Загрузить каталог товаров из CSV</summary>
    <p className="my-2 text-sm text-slate-500">Каталог подставляет название по штрих-коду. Партии со сроками добавляются отдельно.</p>
    <label className="block text-sm">
      CSV: штрих-код и наименование товара
      <input type="file" accept=".csv" disabled={busy} className="mt-2 block w-full text-sm" onChange={async e => {
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
      <p className="my-2 text-sm">Найдено товаров: {entries.length}. Совпадающие штрих-коды обновят названия в вашем каталоге.</p>
      <ul className="max-h-32 overflow-auto text-xs text-slate-600" aria-label="Предпросмотр каталога">
        {entries.map(entry => <li key={entry.barcode}>{entry.barcode} — {entry.name}</li>)}
      </ul>
      <button type="button" disabled={busy} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={async () => {
        setBusy(true); setMessage("");
        try {
          const response = await fetch("/api/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Ошибка импорта");
          setMessage(`В каталог загружено товаров: ${result.imported}`); setEntries([]);
        } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка сети"); }
        finally { setBusy(false); }
      }}>{busy ? "Загрузка…" : "Сохранить каталог"}</button>
    </>}
    <p role="status" className="mt-2 text-sm">{message}</p>
  </details>;
}
