import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  const { userId } = req.query;
  const session = await getSession({ req });

  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    await prisma.user.delete({
      where: { id: userId as string },
    });
    res.status(204).end();
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
