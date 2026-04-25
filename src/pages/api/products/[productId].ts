import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

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
      const { name, barcode, expiryDate } = req.body;
      const updatedProduct = await prisma.product.update({
        where: { id: String(productId), userId: session.user.id },
        data: { name, barcode, expiryDate: new Date(expiryDate) },
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
