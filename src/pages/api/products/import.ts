import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

import { validateInventoryProducts } from "../../../lib/inventory-import";
import { inventoryScope, recordEvent } from "@/lib/server/inventory";
import { expiredOn } from "@/lib/expiry-calendar";

interface ImportResponse {
  imported: number;
  errors: string[];
}

/** POST: bulk-import products from a parsed Excel file. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImportResponse | { error: string }>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  try {
    let products;
    try {
      products = validateInventoryProducts(req.body?.products);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Некорректные товары" });
    }

    const userId = session.user.id;
    const created = await prisma.$transaction(async tx => {
      const { membership } = await inventoryScope(tx, userId);
      const rows = [];
      for (const p of products) {
        const expiryDate = p.expiryDate ? new Date(`${p.expiryDate}T00:00:00.000Z`) : null;
        const product = await tx.product.create({
          data: {
            name: p.name,
            barcode: p.barcode,
            quantity: p.quantity,
            expiryDate,
            isExpired: expiredOn(expiryDate),
            storeId: membership?.storeId ?? null,
            userId,
          },
        });
        await recordEvent(tx, { userId, source: "WEB" }, product, "IMPORT", { product });
        rows.push(product);
      }
      return rows;
    });

    return res.status(200).json({
      imported: created.length,
      errors: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка при импорте";
    return res.status(500).json({ error: message });
  }
}
