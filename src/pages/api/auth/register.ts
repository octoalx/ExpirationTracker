import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiFailure } from "@/lib/server/api";
import { registerDepartment } from "@/lib/server/departments";

/**
 * POST: register the founder of a department.
 * The account, its department and the manager membership are created together;
 * a registration can no longer produce an account without a department.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { name, email, password, department } = req.body ?? {};
    if (!name || !email || !password || !department) {
      return res
        .status(400)
        .json({ message: "Имя, email, пароль и название отдела обязательны для заполнения" });
    }
    const { user, store } = await registerDepartment(prisma, { name, email, password, department });
    return res.status(201).json({ message: "User created successfully",
      user: { id: user.id, name: user.name, email: user.email }, department: store.name });
  } catch (error) {
    return apiFailure(res, error);
  }
}
