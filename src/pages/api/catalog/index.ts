import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Authenticated scanner lookup uses only the admin-managed shared reference. */
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
    const entry = await prisma.sharedCatalogEntry.findUnique({
      where: { barcode }, select: { barcode: true, name: true },
    });
    if (!entry) return res.status(404).json({ error: "Товар не найден в каталоге" });
    return res.status(200).json(entry);
  } catch {
    return res.status(500).json({ error: "Не удалось прочитать каталог" });
  }
}
