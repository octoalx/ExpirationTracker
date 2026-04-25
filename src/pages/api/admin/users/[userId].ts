import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  const { userId } = req.query;
  const session = await getSession({ req });

  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (req.method === "DELETE") {
    try {
      await prisma.user.delete({
        where: { id: userId as string },
      });
      res.status(204).end();
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "PUT") {
    const { role } = req.body;
    if (!["USER", "ADMIN"].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId as string },
        data: { role },
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["DELETE", "PUT"]);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}
