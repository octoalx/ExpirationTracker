import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

import { mergedQuantity, partitionInventoryProducts } from "../../../lib/inventory-import";
import { inventoryScope, recordEvent } from "@/lib/server/inventory";
import { apiFailure } from "@/lib/server/api";
import { expiredOn } from "@/lib/expiry-calendar";

interface ImportResponse {
  imported: number;
  /** Rows left untouched because the department already has the same barcode and expiry date. */
  skipped: number;
  /** Rows refused for a broken value; each one is named in `errors`. */
  rejected: number;
  errors: string[];
  message?: string;
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
    // A broken row is skipped with its reason; only a broken payload as a whole
    // (not a list, empty, too large) is a 400. One mistyped date must not cost
    // the manager the whole delivery note.
    let products;
    let rejectedRows;
    try {
      ({ products, rejected: rejectedRows } = partitionInventoryProducts(req.body?.products));
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Некорректные товары" });
    }

    const userId = session.user.id;
    const imported = await prisma.$transaction(async tx => {
      const { membership } = await inventoryScope(tx, userId);
      const rows = [];
      let skipped = 0;
      for (const p of products) {
        const expiryDate = p.expiryDate ? new Date(`${p.expiryDate}T00:00:00.000Z`) : null;
        // A repeated upload must not duplicate the table: the same barcode with the
        // same expiry date inside this department is the same batch. Another date
        // stays a separate row, because that is another delivery.
        const existing = await tx.product.findFirst({
          where: { storeId: membership.storeId, barcode: p.barcode, expiryDate, status: "ACTIVE", deletedAt: null },
          select: { id: true, storeId: true, quantity: true },
        });
        if (existing) {
          const quantity = mergedQuantity(existing.quantity, p.quantity);
          if (quantity !== existing.quantity) {
            await tx.product.update({ where: { id: existing.id }, data: { quantity } });
          }
          await recordEvent(tx, { userId, source: "WEB" }, existing, "IMPORT_MERGE", { barcode: p.barcode, quantity });
          skipped += 1;
          continue;
        }
        const product = await tx.product.create({
          data: {
            name: p.name,
            barcode: p.barcode,
            quantity: p.quantity,
            expiryDate,
            isExpired: expiredOn(expiryDate),
            storeId: membership.storeId,
            userId,
          },
        });
        await recordEvent(tx, { userId, source: "WEB" }, product, "IMPORT", { product });
        rows.push(product);
      }
      return { rows, skipped };
    });

    // An import where nothing survives is still a successful answer: the rows are
    // named below, and the owner can fix the file and upload it again.
    return res.status(200).json({
      imported: imported.rows.length,
      skipped: imported.skipped,
      rejected: rejectedRows.length,
      errors: rejectedRows.map(row => row.message),
    });
  } catch (error) {
    return apiFailure(res, error);
  }
}
