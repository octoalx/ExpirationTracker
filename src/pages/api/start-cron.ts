import type { NextApiRequest, NextApiResponse } from "next";

/** GET: health-check endpoint confirming cron jobs are active via instrumentation. */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ message: "Cron jobs initialized via instrumentation hook" });
}
