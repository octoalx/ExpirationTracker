/** Resolve exact inventory matches, never partial barcode matches. */
export function findScannedProducts<T extends { barcode: string | null }>(products: T[], barcode: string): T[] {
  const code = barcode.trim();
  return products.filter(product => product.barcode === code);
}
