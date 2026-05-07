import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { apiErrorHandler } from "../../../lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";

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
      const { name, barcode, expiryDate, quantity } = req.body;
      const product = await prisma.product.create({
        data: {
          name,
          barcode,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
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
