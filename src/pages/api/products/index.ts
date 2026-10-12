import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { apiErrorHandler } from "../../../lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { productDates } from "@/lib/product-dates";
import { inventoryScope, recordEvent } from "@/lib/server/inventory";
import { apiFailure } from "@/lib/server/api";

/** GET: list products (optionally filtered by status) | POST: create a new product. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ products: [] });
  }

  if (req.method === "GET") {
    try {
      const { status } = req.query;
      const { where } = await inventoryScope(prisma, session.user.id);
      if (status && typeof status === "string") {
        where.status = status;
      }

      const products = await prisma.product.findMany({
        where,
      });
      res.setHeader("Cache-Control", "private, no-store");
      const { membership } = await inventoryScope(prisma, session.user.id);
      res.status(200).json({ products, canDelete: !membership || membership.role === "MANAGER" });
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "POST") {
    try {
      const { name, barcode, quantity } = req.body;
      if (typeof name !== "string" || !name.trim() || name.length > 300 || typeof barcode !== "string" || !/^\d{8,14}$/.test(barcode) ||
        (quantity != null && (!Number.isSafeInteger(quantity) || quantity <= 0))) {
        return res.status(400).json({ message: "Проверьте название, штрих-код и количество." });
      }
      let dates;
      try { dates = productDates(req.body); }
      catch (error) { return res.status(400).json({ message: (error as Error).message }); }
      const product = await prisma.$transaction(async tx => {
        const { membership } = await inventoryScope(tx, session.user.id);
        const created = await tx.product.create({
          data: {
            name: name.trim(),
            barcode,
            ...dates,
            quantity: quantity ?? null,
            userId: session.user.id,
            storeId: membership?.storeId ?? null,
          },
        });
        await recordEvent(tx, { userId: session.user.id, source: "WEB" }, created, "CREATE", { product: created });
        return created;
      });
      res.status(201).json(product);
    } catch (error) {
      apiFailure(res, error);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
