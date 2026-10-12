import type { NextApiResponse } from "next";
import { InventoryError } from "./inventory";
export function apiFailure(res: NextApiResponse, error: unknown) {
  if (error instanceof InventoryError) return res.status(error.status).json({ message: error.message });
  return res.status(500).json({ message: "Не удалось выполнить действие. Повторите позже." });
}
