import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CatalogUploadError } from "@/lib/server/catalog-upload";
import { CatalogIncompleteError, finalizeUpload } from "@/lib/server/catalog-upload-chunks";

/**
 * Imports a fully received upload. Parsing completes before the first write, so a failed parse
 * changes nothing. Batch failures return `confirmed`; repeating finalize is safe.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Метод не поддерживается", confirmed: 0 });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Не авторизован", confirmed: 0 });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Нет доступа", confirmed: 0 });
  try {
    const result = await finalizeUpload(req.query.uploadId, session.user.id, prisma);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof CatalogIncompleteError) return res.status(409).json({ error: error.message, missing: error.missing, confirmed: 0 });
    if (error instanceof CatalogUploadError) return res.status(error.status).json({ error: error.message, confirmed: error.confirmed });
    return res.status(500).json({ error: "Не удалось сохранить общий каталог", confirmed: 0 });
  }
}
