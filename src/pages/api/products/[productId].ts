import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { productDates } from "@/lib/product-dates";
import { accessibleProduct, updateInventory, InventoryError } from "@/lib/server/inventory";
import { apiFailure } from "@/lib/server/api";

/** DELETE: remove product | PUT: update status | PATCH: partial field update. */
export default async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { productId } = req.query;

  if (req.method === "DELETE") {
    try {
      const { product, membership } = await accessibleProduct(prisma, session.user.id, String(productId));
      if (membership) {
        if (membership.role !== "MANAGER") throw new InventoryError(403, "Удалять общие записи может руководитель.");
        await updateInventory(prisma, { userId: session.user.id, source: "WEB" }, product.id,
          Number(req.query.version), { deletedAt: new Date() }, "DELETE");
      } else {
        await prisma.product.delete({ where: { id: product.id, userId: session.user.id, storeId: null } });
      }
      res.status(204).end();
    } catch (error) {
      apiFailure(res, error);
    }
  } else if (req.method === "PUT") {
    try {
      const { status } = req.body;
      if (!["ACTIVE", "ARCHIVED", "DEFECT"].includes(status)) throw new InventoryError(400, "Некорректный статус.");
      const updatedProduct = await updateInventory(prisma, { userId: session.user.id, source: "WEB" },
        String(productId), req.body.version, { status, resolution: status === "DEFECT" ? "DEFECT" : null,
          ...(status === "ACTIVE" ? { missing: false } : {}) }, "STATUS");
      res.status(200).json(updatedProduct);
    } catch (error) {
      apiFailure(res, error);
    }
  } else if (req.method === "PATCH") {
    try {
      const { name, barcode, quantity } = req.body;
      if ((name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 300)) ||
        (barcode !== undefined && (typeof barcode !== "string" || !/^\d{8,14}$/.test(barcode))) ||
        (quantity != null && (!Number.isSafeInteger(quantity) || quantity <= 0))) throw new InventoryError(400, "Проверьте поля товара.");
      let dates;
      try { dates = productDates(req.body); }
      catch (error) { return res.status(400).json({ message: (error as Error).message }); }

      // Build partial update payload from provided fields
      const updateData = { ...dates, ...(name !== undefined ? { name } : {}), ...(barcode !== undefined ? { barcode } : {}), ...(quantity !== undefined ? { quantity } : {}) };

      const updatedProduct = await updateInventory(prisma, { userId: session.user.id, source: "WEB" },
        String(productId), req.body.version, updateData);
      res.status(200).json(updatedProduct);
    } catch (error) {
      apiFailure(res, error);
    }
  } else {
    res.setHeader("Allow", ["DELETE", "PUT", "PATCH"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
