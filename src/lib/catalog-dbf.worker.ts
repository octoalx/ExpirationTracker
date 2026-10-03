import { parseDbfCatalog } from "./catalog-dbf";

/** Raw database buffers remain on the administrator's device. */
const scope = self as unknown as {
  onmessage: (event: MessageEvent<{ goods: ArrayBuffer; barcodes: ArrayBuffer }>) => void;
  postMessage: (message: unknown) => void;
};
scope.onmessage = event => {
  try { scope.postMessage({ result: parseDbfCatalog(event.data.goods, event.data.barcodes) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : "Не удалось прочитать DBF" }); }
};
