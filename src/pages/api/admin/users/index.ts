import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import bcrypt from "bcryptjs";

const publicUserFields = { id: true, name: true, email: true, role: true } as const;

/** List or create users; both operations require a verified admin session. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (session?.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    if (req.method === "POST") {
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({ message: "Некорректные данные учётной записи" });
      }
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = body.password;
      const role = body.role === undefined ? "USER" : body.role;
      if (!name || name.length > 120 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Укажите имя (до 120 символов) и корректный email" });
      }
      if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
        return res.status(400).json({ message: "Пароль должен содержать минимум 8 символов и не более 72 байт UTF-8" });
      }
      if (role !== "USER" && role !== "ADMIN") {
        return res.status(400).json({ message: "Некорректная роль пользователя" });
      }
      const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existingUser) {
        return res.status(409).json({ message: "Пользователь с таким email уже существует" });
      }
      const user = await prisma.user.create({
        data: { name, email, password: await bcrypt.hash(password, 10), role },
        select: publicUserFields,
      });
      return res.status(201).json(user);
    }
    const users = await prisma.user.findMany({
      select: publicUserFields,
    });
    res.status(200).json(users);
  } catch (error) {
    if (req.method === "POST") {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return res.status(409).json({ message: "Пользователь с таким email уже существует" });
      }
      // Do not pass credential-bearing Prisma errors to the shared logger.
      return res.status(500).json({ message: "Не удалось создать учётную запись" });
    }
    apiErrorHandler(error, res);
  }
}
