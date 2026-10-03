import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateCatalogEntries } from "@/lib/catalog-parser";

/** Only administrators may update the shared barcode reference. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Метод не поддерживается" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Не авторизован" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Нет доступа" });
  let entries;
  try { entries = validateCatalogEntries(req.body?.entries); }
  catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Некорректный каталог" });
  }
  try {
    await prisma.$transaction(entries.map(({ barcode, name }) => prisma.sharedCatalogEntry.upsert({
      where: { barcode }, create: { barcode, name }, update: { name },
    })));
    return res.status(200).json({ imported: entries.length });
  } catch {
    return res.status(500).json({ error: "Не удалось сохранить общий каталог" });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };
