/** Shared wire format for the administrator DBF pair upload. Safe to import in the browser. */

export const MAX_DBF_BYTES = 256 * 1024 * 1024;

/** Magic (8 ASCII bytes), then goods length and barcode length as uint64 little-endian. */
export const CATALOG_UPLOAD_MAGIC = "ECATDBF1";
export const CATALOG_UPLOAD_HEADER_BYTES = 24;

/** Largest accepted body: the header plus two DBF files at the per-file limit. */
export const MAX_UPLOAD_BYTES = CATALOG_UPLOAD_HEADER_BYTES + 2 * MAX_DBF_BYTES;

/**
 * Size of one chunk on the wire. Below the 100 MB per-request body limit of Cloudflare
 * Free and Pro plans, so the upload works without a plan change.
 */
export const CHUNK_BYTES = 90 * 1024 * 1024;

export interface ChunkRange {
  offset: number;
  length: number;
}

/** Builds the request body without reading either file into memory. */
export function buildCatalogUploadBody(goods: Blob, barcodes: Blob): Blob {
  const header = new ArrayBuffer(CATALOG_UPLOAD_HEADER_BYTES);
  const bytes = new Uint8Array(header);
  for (let i = 0; i < CATALOG_UPLOAD_MAGIC.length; i++) bytes[i] = CATALOG_UPLOAD_MAGIC.charCodeAt(i);
  const view = new DataView(header);
  view.setBigUint64(8, BigInt(goods.size), true);
  view.setBigUint64(16, BigInt(barcodes.size), true);
  return new Blob([header, goods, barcodes], { type: "application/octet-stream" });
}

/** Splits a body of `totalBytes` into consecutive ranges of at most `chunkBytes`. */
export function planChunks(totalBytes: number, chunkBytes: number = CHUNK_BYTES): ChunkRange[] {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0) throw new Error("Размер загрузки должен быть положительным");
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) throw new Error("Размер части должен быть положительным");
  const chunks: ChunkRange[] = [];
  for (let offset = 0; offset < totalBytes; offset += chunkBytes) {
    chunks.push({ offset, length: Math.min(chunkBytes, totalBytes - offset) });
  }
  return chunks;
}

/**
 * Checks the 24-byte header against the declared total size and returns the two lengths.
 * Throws a Russian message on any mismatch; the caller decides the HTTP status.
 */
export function parseCatalogUploadHeader(header: Uint8Array, totalBytes: number): { goodsLength: number; barcodeLength: number } {
  if (totalBytes < CATALOG_UPLOAD_HEADER_BYTES) throw new Error("Загрузка повреждена: нет заголовка");
  if (header.byteLength !== CATALOG_UPLOAD_HEADER_BYTES) throw new Error("Загрузка повреждена: нет заголовка");
  const magic = String.fromCharCode(...header.subarray(0, 8));
  if (magic !== CATALOG_UPLOAD_MAGIC) throw new Error("Загрузка повреждена: неизвестный формат");
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const goodsLength = view.getBigUint64(8, true);
  const barcodeLength = view.getBigUint64(16, true);
  const limit = BigInt(MAX_DBF_BYTES);
  if (goodsLength === 0n || barcodeLength === 0n || goodsLength > limit || barcodeLength > limit) {
    throw new Error("goods.dbf и barcode.dbf должны быть непустыми и не больше 256 МБ каждый");
  }
  if (BigInt(CATALOG_UPLOAD_HEADER_BYTES) + goodsLength + barcodeLength !== BigInt(totalBytes)) {
    throw new Error("Размер загрузки не совпадает с заголовком");
  }
  return { goodsLength: Number(goodsLength), barcodeLength: Number(barcodeLength) };
}
