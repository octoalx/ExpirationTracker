import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { Prisma } from "@prisma/client";
import { parseDbfCatalog, type DbfCatalogResult } from "../catalog-dbf";
import type { CatalogEntryInput } from "../catalog-parser";
import {
  CATALOG_UPLOAD_HEADER_BYTES,
  MAX_UPLOAD_BYTES,
  parseCatalogUploadHeader,
} from "../catalog-upload-format";

/** Batch size of one INSERT ... ON CONFLICT statement; one statement is one atomic unit. */
export const CATALOG_BATCH_SIZE = 500;

export interface CatalogUploadResult extends Omit<DbfCatalogResult, "entries"> {
  imported: number;
}

/** Error with the HTTP status and the number of records already confirmed in the catalog. */
export class CatalogUploadError extends Error {
  constructor(public status: number, message: string, public confirmed = 0) {
    super(message);
  }
}

/** Minimal Prisma surface used here, so the module can be tested with a real client. */
export interface CatalogWriter {
  $executeRaw(query: Prisma.Sql): Promise<number>;
}

/** Streams the request body to a temporary file, refusing anything above the allowed total. */
export async function receiveToFile(body: Readable, target: string, maxBytes: number): Promise<void> {
  const handle = await fs.open(target, "wx");
  let total = 0;
  try {
    for await (const chunk of body as AsyncIterable<Buffer>) {
      total += chunk.length;
      if (total > maxBytes) throw new CatalogUploadError(413, "Файлы больше 256 МБ каждый или слишком большие для загрузки");
      await handle.write(chunk);
    }
  } finally {
    await handle.close();
  }
}

/** Reads an exact byte range into a fresh ArrayBuffer that the DBF parser can own. */
async function readRange(handle: fs.FileHandle, position: number, length: number): Promise<ArrayBuffer> {
  const buffer = new ArrayBuffer(length);
  const view = new Uint8Array(buffer);
  let filled = 0;
  while (filled < length) {
    const { bytesRead } = await handle.read(view, filled, length - filled, position + filled);
    if (bytesRead === 0) throw new CatalogUploadError(400, "Загрузка оборвана: файл короче заголовка");
    filled += bytesRead;
  }
  return buffer;
}

/** Reads and checks the framed body: magic, two lengths, exact total size. */
async function readFrame(handle: fs.FileHandle, totalBytes: number) {
  if (totalBytes < CATALOG_UPLOAD_HEADER_BYTES) throw new CatalogUploadError(400, "Загрузка повреждена: нет заголовка");
  const header = new Uint8Array(CATALOG_UPLOAD_HEADER_BYTES);
  await handle.read(header, 0, CATALOG_UPLOAD_HEADER_BYTES, 0);
  try {
    return parseCatalogUploadHeader(header, totalBytes);
  } catch (error) {
    throw new CatalogUploadError(400, error instanceof Error ? error.message : "Загрузка повреждена");
  }
}

/** Writes one batch as a single statement: either every row of it is stored, or none. */
export async function upsertSharedCatalogBatch(writer: CatalogWriter, batch: CatalogEntryInput[], now: number): Promise<number> {
  const rows = batch.map(entry => Prisma.sql`(${randomUUID()}, ${entry.barcode}, ${entry.name}, ${now}, ${now})`);
  await writer.$executeRaw(Prisma.sql`
    INSERT INTO "SharedCatalogEntry" ("id", "barcode", "name", "createdAt", "updatedAt")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT("barcode") DO UPDATE SET "name" = excluded."name", "updatedAt" = excluded."updatedAt"`);
  return batch.length;
}

/**
 * Parses an assembled upload file completely, then writes it in 500-row batches. Parsing
 * finishes before the first write, so a bad pair changes nothing. The file is not removed here.
 */
export async function importCatalogFile(target: string, writer: CatalogWriter): Promise<CatalogUploadResult> {
  const stat = await fs.stat(target);
  if (stat.size > MAX_UPLOAD_BYTES) throw new CatalogUploadError(413, "Файлы больше 256 МБ каждый или слишком большие для загрузки");
  const handle = await fs.open(target, "r");
  let parsed: DbfCatalogResult;
  try {
    const { goodsLength, barcodeLength } = await readFrame(handle, stat.size);
    const goods = await readRange(handle, CATALOG_UPLOAD_HEADER_BYTES, goodsLength);
    const barcodes = await readRange(handle, CATALOG_UPLOAD_HEADER_BYTES + goodsLength, barcodeLength);
    try {
      parsed = parseDbfCatalog(goods, barcodes);
    } catch (error) {
      throw new CatalogUploadError(400, error instanceof Error ? error.message : "Не удалось прочитать DBF");
    }
  } finally {
    await handle.close();
  }

  const { entries, ...counts } = parsed;
  const now = Date.now();
  let confirmed = 0;
  try {
    for (let offset = 0; offset < entries.length; offset += CATALOG_BATCH_SIZE) {
      confirmed += await upsertSharedCatalogBatch(writer, entries.slice(offset, offset + CATALOG_BATCH_SIZE), now);
    }
  } catch {
    throw new CatalogUploadError(500, "Не удалось сохранить общий каталог", confirmed);
  }
  return { ...counts, imported: confirmed };
}

/**
 * Receives a whole body in one stream (used by tests and by callers that already hold the
 * complete body), then imports it. The temporary file is always removed.
 */
export async function importCatalogUpload(
  body: Readable,
  writer: CatalogWriter,
  options: { maxBytes?: number } = {},
): Promise<CatalogUploadResult> {
  const target = path.join(os.tmpdir(), `catalog-upload-${randomUUID()}.bin`);
  const maxBytes = options.maxBytes ?? MAX_UPLOAD_BYTES;
  try {
    await receiveToFile(body, target, maxBytes);
    return await importCatalogFile(target, writer);
  } finally {
    await fs.rm(target, { force: true });
  }
}
