/** Shared wire format for the administrator DBF pair upload. Safe to import in the browser. */

export const MAX_DBF_BYTES = 256 * 1024 * 1024;

/** Magic (8 ASCII bytes), then goods length and barcode length as uint64 little-endian. */
export const CATALOG_UPLOAD_MAGIC = "ECATDBF1";
export const CATALOG_UPLOAD_HEADER_BYTES = 24;

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
