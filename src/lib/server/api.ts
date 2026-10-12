import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth";
import { InventoryError } from "./inventory";

export async function apiUser(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) throw new InventoryError(401, "Войдите в приложение.");
  return session.user;
}

export { apiFailure } from "./errors";
