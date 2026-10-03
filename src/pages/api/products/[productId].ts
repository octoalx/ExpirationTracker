import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { productDates } from "@/lib/product-dates";

/** DELETE: remove product | PUT: update status | PATCH: partial field update. */
export default async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { productId } = req.query;

  if (req.method === "DELETE") {
    try {
      await prisma.product.delete({
        where: { id: String(productId), userId: session.user.id },
      });
      res.status(204).end();
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "PUT") {
    try {
      const { status } = req.body;
      const updatedProduct = await prisma.product.update({
        where: { id: String(productId), userId: session.user.id },
        data: { status },
      });
      res.status(200).json(updatedProduct);
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "PATCH") {
    try {
      const { name, barcode, quantity } = req.body;
      let dates;
      try { dates = productDates(req.body); }
      catch (error) { return res.status(400).json({ message: (error as Error).message }); }

      // Build partial update payload from provided fields
      const updateData = { ...dates, ...(name !== undefined ? { name } : {}), ...(barcode !== undefined ? { barcode } : {}), ...(quantity !== undefined ? { quantity } : {}) };

      const updatedProduct = await prisma.product.update({
        where: { id: String(productId), userId: session.user.id },
        data: updateData,
      });
      res.status(200).json(updatedProduct);
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["DELETE", "PUT", "PATCH"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
