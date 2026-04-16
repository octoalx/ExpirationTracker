import { NextApiResponse } from "next";

import { ZodError } from "zod";

export function apiErrorHandler(err: unknown, res: NextApiResponse) {
  console.error(err);

  if (err instanceof ZodError) {
    return res

      .status(400)

      .json({ error: "Validation failed", details: (err as any).errors });
  }

  if (err instanceof Error) {
    const statusCode = (err as any).statusCode ?? 500;

    return res

      .status(statusCode)

      .json({ error: err.message || "An unexpected error occurred" });
  }

  return res.status(500).json({ error: "An unexpected error occurred" });
}
