import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { CatalogUploadError } from "@/lib/server/catalog-upload";
import { initUpload } from "@/lib/server/catalog-upload-chunks";

/**
 * Starts a chunked DBF pair upload. Body: { totalBytes, header } where header is the 24-byte
 * catalog header as 48 hex characters. The administrator session is checked first.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Метод не поддерживается" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Не авторизован" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Нет доступа" });
  const { totalBytes, header } = (req.body ?? {}) as { totalBytes?: unknown; header?: unknown };
  if (typeof totalBytes !== "number" || typeof header !== "string" || !/^[0-9a-f]{48}$/i.test(header)) {
    return res.status(400).json({ error: "Некорректный запрос загрузки" });
  }
  try {
    const result = await initUpload(session.user.id, totalBytes, Buffer.from(header, "hex"));
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof CatalogUploadError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: "Не удалось начать загрузку" });
  }
}
