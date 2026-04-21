import type { NextApiRequest, NextApiResponse } from "next";
import { start } from "@/lib/server/jobs";

// Ensure this is only run once
start();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ message: "Cron jobs initialized" });
}
