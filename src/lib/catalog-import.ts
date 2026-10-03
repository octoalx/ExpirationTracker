import type { CatalogEntryInput } from "./catalog-parser";

/** Sequential, retry-safe requests bound transaction size and server load. */
export async function importCatalogBatches(
  entries: CatalogEntryInput[],
  save: (batch: CatalogEntryInput[]) => Promise<number>,
  progress: (completed: number) => void,
) {
  let completed = 0;
  for (let offset = 0; offset < entries.length; offset += 500) {
    const batch = entries.slice(offset, offset + 500);
    const imported = await save(batch);
    if (imported !== batch.length) throw new Error("Сервер подтвердил не все записи части");
    completed += imported;
    progress(completed);
  }
  return completed;
}
