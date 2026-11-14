import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import {
  CHUNK_BYTES,
  MAX_UPLOAD_BYTES,
  parseCatalogUploadHeader,
} from "../catalog-upload-format";
import { CatalogUploadError, importCatalogFile, type CatalogUploadResult, type CatalogWriter } from "./catalog-upload";

/** An upload with no activity for this long is removed on the next init or finalize. */
export const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

const UPLOAD_DIR = path.join(os.tmpdir(), "expiry-catalog-uploads");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Half-open byte range [start, end) that has been received. */
export interface ByteRange {
  start: number;
  end: number;
}

interface UploadState {
  id: string;
  adminId: string;
  totalBytes: number;
  ranges: ByteRange[];
  updatedAt: number;
}

/** Thrown by finalize when some bytes are still missing; carries the gaps for the client. */
export class CatalogIncompleteError extends CatalogUploadError {
  constructor(public missing: ByteRange[]) {
    super(409, "Не все части загружены. Отправьте недостающие части и повторите сохранение.");
  }
}

const filesOf = (id: string) => ({
  bin: path.join(UPLOAD_DIR, `${id}.bin`),
  json: path.join(UPLOAD_DIR, `${id}.json`),
});

/** Serialises operations on one upload so chunks, status and finalize never interleave. */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  locks.set(id, next);
  return next.finally(() => {
    if (locks.get(id) === next) locks.delete(id);
  });
}

/** Adds [start, end) to a sorted list and merges touching or overlapping ranges. */
export function mergeRange(ranges: ByteRange[], start: number, end: number): ByteRange[] {
  const all = [...ranges, { start, end }].sort((a, b) => a.start - b.start);
  const merged: ByteRange[] = [];
  for (const range of all) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/** Byte ranges of [0, totalBytes) that are not yet covered by `ranges`. */
export function missingRanges(totalBytes: number, ranges: ByteRange[]): ByteRange[] {
  const gaps: ByteRange[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) gaps.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < totalBytes) gaps.push({ start: cursor, end: totalBytes });
  return gaps;
}

function validId(id: unknown): string {
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) throw new CatalogUploadError(400, "Некорректный идентификатор загрузки");
  return id;
}

async function readState(id: string): Promise<UploadState | null> {
  try {
    return JSON.parse(await fs.readFile(filesOf(id).json, "utf8")) as UploadState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Writes the state through a temporary file, so a crash never leaves half a JSON document. */
async function writeState(state: UploadState): Promise<void> {
  const { json } = filesOf(state.id);
  const temp = `${json}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state));
  await fs.rename(temp, json);
}

async function removeUpload(id: string): Promise<void> {
  const { bin, json } = filesOf(id);
  await fs.rm(bin, { force: true });
  await fs.rm(json, { force: true });
}

/** Removes uploads without activity for STALE_UPLOAD_MS. Idempotent; safe to call often. */
export async function cleanupStaleUploads(now = Date.now()): Promise<number> {
  let names: string[];
  try {
    names = await fs.readdir(UPLOAD_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  let removed = 0;
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    if (!UUID_PATTERN.test(id)) continue;
    const state = await withLock(id, () => readState(id));
    if (state && now - state.updatedAt >= STALE_UPLOAD_MS) {
      await withLock(id, () => removeUpload(id));
      removed++;
    }
  }
  return removed;
}

/**
 * Starts an upload. The 24-byte header is checked against the declared total before any file
 * is created. An administrator has one upload at a time: a new init replaces the previous one.
 */
export async function initUpload(adminId: string, totalBytes: number, header: Uint8Array): Promise<{ uploadId: string; chunkBytes: number }> {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0 || totalBytes > MAX_UPLOAD_BYTES) {
    throw new CatalogUploadError(413, "Файлы больше 256 МБ каждый или слишком большие для загрузки");
  }
  try {
    parseCatalogUploadHeader(header, totalBytes);
  } catch (error) {
    throw new CatalogUploadError(400, error instanceof Error ? error.message : "Загрузка повреждена");
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await cleanupStaleUploads();
  await removePreviousUploads(adminId);

  const id = randomUUID();
  await withLock(id, async () => {
    await fs.writeFile(filesOf(id).bin, Buffer.alloc(0), { flag: "wx" });
    await writeState({ id, adminId, totalBytes, ranges: [], updatedAt: Date.now() });
  });
  return { uploadId: id, chunkBytes: CHUNK_BYTES };
}

async function removePreviousUploads(adminId: string): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(UPLOAD_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    if (!UUID_PATTERN.test(id)) continue;
    await withLock(id, async () => {
      const state = await readState(id);
      if (state && state.adminId === adminId) await removeUpload(id);
    });
  }
}

async function requireOwnUpload(id: string, adminId: string): Promise<UploadState> {
  const state = await readState(id);
  if (!state || state.adminId !== adminId) throw new CatalogUploadError(404, "Загрузка не найдена или уже завершена");
  return state;
}

/**
 * Writes one chunk at its offset. The body is streamed straight to the file. The range is
 * recorded only after every declared byte arrived, so a broken chunk is simply sent again.
 */
export async function writeChunk(
  uploadId: unknown,
  adminId: string,
  offset: number,
  length: number,
  body: Readable,
): Promise<{ ranges: ByteRange[] }> {
  const id = validId(uploadId);
  return withLock(id, async () => {
    const state = await requireOwnUpload(id, adminId);
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length <= 0) {
      throw new CatalogUploadError(400, "Некорректные границы части");
    }
    if (length > CHUNK_BYTES) throw new CatalogUploadError(400, "Часть больше допустимого размера");
    if (offset + length > state.totalBytes) throw new CatalogUploadError(400, "Часть выходит за пределы загрузки");

    const handle = await fs.open(filesOf(id).bin, "r+");
    let received = 0;
    try {
      for await (const chunk of body as AsyncIterable<Buffer>) {
        received += chunk.length;
        if (received > length) throw new CatalogUploadError(400, "Часть длиннее объявленного размера");
        await handle.write(chunk, 0, chunk.length, offset + received - chunk.length);
      }
    } finally {
      await handle.close();
    }
    if (received !== length) throw new CatalogUploadError(400, "Загрузка части оборвана");

    state.ranges = mergeRange(state.ranges, offset, offset + length);
    state.updatedAt = Date.now();
    await writeState(state);
    return { ranges: state.ranges };
  });
}

/** Received ranges and the gaps still missing; used after a dropped connection to resume. */
export async function getUploadStatus(uploadId: unknown, adminId: string): Promise<{ totalBytes: number; ranges: ByteRange[]; missing: ByteRange[] }> {
  const id = validId(uploadId);
  return withLock(id, async () => {
    const state = await requireOwnUpload(id, adminId);
    return { totalBytes: state.totalBytes, ranges: state.ranges, missing: missingRanges(state.totalBytes, state.ranges) };
  });
}

/**
 * Imports the assembled file once every byte is present. The file stays on disk after a
 * failed import, so the same uploadId can be finalized again; it is removed after success.
 */
export async function finalizeUpload(uploadId: unknown, adminId: string, writer: CatalogWriter): Promise<CatalogUploadResult> {
  const id = validId(uploadId);
  return withLock(id, async () => {
    const state = await requireOwnUpload(id, adminId);
    const missing = missingRanges(state.totalBytes, state.ranges);
    if (missing.length > 0) throw new CatalogIncompleteError(missing);
    const result = await importCatalogFile(filesOf(id).bin, writer);
    await removeUpload(id);
    return result;
  });
}
