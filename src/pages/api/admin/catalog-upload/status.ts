import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { CatalogUploadError } from "@/lib/server/catalog-upload";
import { getUploadStatus } from "@/lib/server/catalog-upload-chunks";

/** Received and missing byte ranges of an upload, so a client can resume after a dropped connection. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Метод не поддерживается" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Не авторизован" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Нет доступа" });
  try {
    return res.status(200).json(await getUploadStatus(req.query.uploadId, session.user.id));
  } catch (error) {
    if (error instanceof CatalogUploadError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: "Не удалось получить состояние загрузки" });
  }
}
