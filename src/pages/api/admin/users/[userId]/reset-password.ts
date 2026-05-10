import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import bcrypt from "bcryptjs";

/** POST: reset a user's password (admin only). */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { userId } = req.query;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId as string } });
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: userId as string },
      data: { password: hashedPassword },
    });

    await prisma.systemLog.create({
      data: {
        level: "INFO",
        message: `Admin ${session.user.email} reset password for ${user?.email || userId}`,
        meta: JSON.stringify({ adminId: session.user.id, userId, userEmail: user?.email }),
      },
    });

    res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
