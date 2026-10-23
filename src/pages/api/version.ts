import type { NextApiRequest, NextApiResponse } from "next";

import { readRunningRevision } from "@/lib/server/revision";

interface VersionResponse {
  revision: string;
}

/**
 * GET/HEAD: the revision this running image was built from.
 *
 * Public on purpose: the deploy health check has no session, and it must judge what
 * the container reports rather than a marker file the workflow wrote itself. The
 * revision is already printed in every deploy summary, so this leaks nothing; it
 * returns no build paths, no environment values and no store data.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse<VersionResponse | { error: string }>) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Never cached: a stale answer would defeat the whole point of the check.
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ revision: readRunningRevision() });
}
