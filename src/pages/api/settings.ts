import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { apiErrorHandler } from "../../lib/apiErrorHandler";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    try {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 },
      });
      res.status(200).json(settings);
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "POST") {
    try {
      const settings = await prisma.settings.upsert({
        where: { id: 1 },
        update: req.body,
        create: { ...req.body, id: 1 },
      });
      res.status(200).json(settings);
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
