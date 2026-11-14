import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Barcode lookup against the shared scanner catalog. The catalog is extended only by the
 * administrator DBF update (POST /api/admin/catalog); there is no personal catalog.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Метод не поддерживается" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Не авторизован" });
  const barcode = typeof req.query.barcode === "string" ? req.query.barcode.trim() : "";
  if (!/^\d{8,14}$/.test(barcode)) return res.status(400).json({ error: "Некорректный штрих-код" });
  try {
    const entry = await prisma.sharedCatalogEntry.findUnique({ where: { barcode }, select: { barcode: true, name: true } });
    if (entry) return res.status(200).json(entry);
    return res.status(404).json({ error: "Товар не найден в каталоге" });
  } catch {
    return res.status(500).json({ error: "Не удалось прочитать каталог" });
  }
}
