import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CatalogUploadError, importCatalogUpload } from "@/lib/server/catalog-upload";

/**
 * Administrator upload of the goods.dbf + barcode.dbf pair. Authorisation is checked before
 * the body is read; every response is JSON so the browser can show the status and message.
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
    const result = await importCatalogUpload(req, prisma);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof CatalogUploadError) {
      return res.status(error.status).json({ error: error.message, confirmed: error.confirmed });
    }
    return res.status(500).json({ error: "Не удалось сохранить общий каталог", confirmed: 0 });
  }
}

/** The body is streamed to disk by the handler, not parsed by Next.js. */
export const config = { api: { bodyParser: false } };
