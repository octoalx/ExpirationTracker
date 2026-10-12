import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateCatalogEntries } from "@/lib/catalog-parser";

/** Catalog access is always scoped to the verified session owner. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Метод не поддерживается" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Не авторизован" });
  const userId = session.user.id;
  if (req.method === "GET") {
    const barcode = typeof req.query.barcode === "string" ? req.query.barcode.trim() : "";
    if (!/^\d{8,14}$/.test(barcode)) return res.status(400).json({ error: "Некорректный штрих-код" });
    try {
      const entry = await prisma.catalogEntry.findUnique({
        where: { userId_barcode: { userId, barcode } }, select: { barcode: true, name: true },
      });
      if (!entry) return res.status(404).json({ error: "Товар не найден в вашем каталоге" });
      return res.status(200).json(entry);
    } catch {
      return res.status(500).json({ error: "Не удалось прочитать каталог" });
    }
  }
  let entries;
  try { entries = validateCatalogEntries(req.body?.entries); }
  catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Некорректный каталог" });
  }
  try {
    await prisma.$transaction(entries.map(({ barcode, name }) => prisma.catalogEntry.upsert({
      where: { userId_barcode: { userId, barcode } },
      create: { userId, barcode, name }, update: { name },
    })));
    return res.status(200).json({ imported: entries.length });
  } catch {
    return res.status(500).json({ error: "Не удалось сохранить каталог" });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };
