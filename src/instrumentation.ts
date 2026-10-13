/**
 * Next.js instrumentation hook — prepares the SQLite database and starts background
 * cron jobs in the Node.js runtime.
 *
 * The database guard runs BEFORE any job starts, and independently of
 * DISABLE_BACKGROUND_JOBS: an unusable leftover rollback journal wedges every query
 * (see src/lib/server/sqlite-health.ts for the incident this comes from), and that
 * failure would also break isolated builds and test runs. The guard also forces WAL
 * so the failure mode cannot recur.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { resolvePrismaDbPath } = await import("./lib/prisma");
  const { prepareDatabaseForStartup } = await import("./lib/server/sqlite-health");

  try {
    const result = prepareDatabaseForStartup(resolvePrismaDbPath());
    if (result.quarantinedTo) {
      // A quarantine means something killed a write transaction, and the operator
      // should know the database was recovered on startup. It is recorded in
      // SystemLog (not only stderr) so it survives log rotation and is visible in
      // the admin UI.
      const meta = { journal: result.journal.path, reason: result.journal.reason, quarantinedTo: result.quarantinedTo };
      console.warn("[Startup] Quarantined an invalid SQLite rollback journal: " + JSON.stringify(meta));
      try {
        const { logger } = await import("./lib/logger");
        logger.warn("Quarantined an invalid SQLite rollback journal", meta);
      } catch (err) {
        console.warn("[Startup] Could not record the quarantine in SystemLog:", String(err));
      }
    }
  } catch (err) {
    // Never block startup on the guard: if it cannot inspect the journal, SQLite
    // will surface the real error when the first query runs.
    console.warn("[Startup] SQLite journal check skipped:", String(err));
  }

  if (process.env.DISABLE_BACKGROUND_JOBS !== "true") {
    const { start } = await import("./lib/server/jobs");
    start();
  }
}
