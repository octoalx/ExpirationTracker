import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { apiErrorHandler } from "../../../lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { productDates } from "@/lib/product-dates";

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
      const where: any = { userId: session.user.id };
      if (status && typeof status === "string") {
        where.status = status;
      }

      const products = await prisma.product.findMany({
        where,
      });
      res.status(200).json({ products });
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "POST") {
    try {
      const { name, barcode, quantity } = req.body;
      let dates;
      try { dates = productDates(req.body); }
      catch (error) { return res.status(400).json({ message: (error as Error).message }); }
      const product = await prisma.product.create({
        data: {
          name,
          barcode,
          ...dates,
          quantity: quantity || null,
          userId: session.user.id,
        },
      });
      res.status(201).json(product);
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
