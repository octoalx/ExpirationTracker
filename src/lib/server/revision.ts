import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Revision this build was made from.
 *
 * The CD workflow passes the deployed commit as a build argument, the Dockerfile
 * bakes it into the image as `.release-version`, and this function reads that copy.
 * It deliberately reads the file inside the image, not the host's marker: the host
 * marker is rewritten by the next checkout, so it describes the intention of a
 * deploy rather than the build a container is actually running.
 *
 * An unreadable or empty marker answers "unknown" instead of throwing: the health
 * check has to report the mismatch, not crash on it.
 */
export function readRunningRevision(cwd: string = process.cwd()): string {
  try {
    const revision = readFileSync(path.join(cwd, ".release-version"), "utf8").trim();
    return revision || "unknown";
  } catch {
    return "unknown";
  }
}
