import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

interface ProductInput {
  barcode: string;
  name: string;
  quantity: number | null;
}

interface ImportResponse {
  imported: number;
  errors: string[];
}

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
    const { products } = req.body as { products: ProductInput[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Нет товаров для импорта" });
    }

    const userId = session.user.id;
    const created = await prisma.$transaction(
      products.map((p) =>
        prisma.product.create({
          data: {
            name: p.name,
            barcode: p.barcode,
            quantity: p.quantity,
            expiryDate: new Date(),
            user: { connect: { id: userId } },
          },
        }),
      ),
    );

    return res.status(200).json({
      imported: created.length,
      errors: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка при импорте";
    return res.status(500).json({ error: message });
  }
}
