import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { CatalogUploadError } from "@/lib/server/catalog-upload";
import { writeChunk } from "@/lib/server/catalog-upload-chunks";

/**
 * Receives one part of an upload. The body is streamed to disk here, so Next.js must not parse it.
 * Query: uploadId, offset. Header: Content-Length is the part length.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Метод не поддерживается" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Не авторизован" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Нет доступа" });
  const length = Number(req.headers["content-length"]);
  if (!req.headers["content-length"] || !Number.isSafeInteger(length)) {
    return res.status(411).json({ error: "Укажите размер части в Content-Length" });
  }
  try {
    const result = await writeChunk(req.query.uploadId, session.user.id, Number(req.query.offset), length, req);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof CatalogUploadError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: "Не удалось сохранить часть загрузки" });
  }
}

/** The part is streamed to disk by the handler, not parsed by Next.js. */
export const config = { api: { bodyParser: false } };
