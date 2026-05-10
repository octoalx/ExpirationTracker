import { NextApiResponse } from "next";

import { ZodError } from "zod";
import { logger } from "./logger";

/**
 * Centralized API error handler.
 * Maps `ZodError` → 400, `Error` with `statusCode` → that code, otherwise → 500.
 * All errors are persisted to SystemLog via logger.
 */
export function apiErrorHandler(err: unknown, res: NextApiResponse) {
  if (err instanceof ZodError) {
    logger.warn("Validation error", { details: (err as ZodError).issues });
    return res
      .status(400)
      .json({ error: "Validation failed", details: (err as any).errors });
  }

  if (err instanceof Error) {
    const statusCode = (err as any).statusCode ?? 500;
    logger.error(err.message || "An unexpected error occurred", {
      stack: err.stack,
      statusCode,
    });
    return res
      .status(statusCode)
      .json({ error: err.message || "An unexpected error occurred" });
  }

  logger.error("An unexpected error occurred", { raw: String(err) });
  return res.status(500).json({ error: "An unexpected error occurred" });
}
