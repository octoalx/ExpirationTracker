/**
 * Next.js instrumentation hook — prepares the SQLite database and starts background
 * cron jobs in the Node.js runtime.
 *
 * The database guard runs BEFORE any job starts, and independently of
 * DISABLE_BACKGROUND_JOBS: an unusable leftover rollback journal wedges every query
 * (see src/lib/server/sqlite-health.ts for the incident this comes from), and that
 * failure would also break isolated builds and test runs. The guard also forces WAL
 * so the failure mode cannot recur.
 *
 * Why the requires below are indirect (`runtimeRequire`): Next.js compiles this file
 * for EVERY runtime, including edge, and resolves the import graph statically. A
 * plain `await import("./lib/server/sqlite-health")` pulls in better-sqlite3, whose
 * chain requires Node's `fs` and `path` — neither of which exists in an edge bundle,
 * so the production build failed with "Module not found: Can't resolve 'fs'"
 * (2026-10-14). Reaching for the module through a function whose argument webpack
 * cannot evaluate keeps the native dependency out of the bundler's graph, while the
 * NEXT_RUNTIME guard below still ensures it only ever executes on the server.
 */
type NodeRequire = (id: string) => unknown;

/** Loads a module at runtime without letting the bundler trace the dependency. */
function runtimeRequire(id: string): unknown {
  const runtime = eval("require") as NodeRequire;
  return runtime(id);
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { resolvePrismaDbPath } = runtimeRequire("./lib/prisma") as {
    resolvePrismaDbPath: () => string;
  };
  const { prepareDatabaseForStartup } = runtimeRequire("./lib/server/sqlite-health") as {
    prepareDatabaseForStartup: (dbPath: string) => {
      quarantinedTo: string | null;
      journal: { path: string; reason: string };
    };
  };

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
        const { logger } = runtimeRequire("./lib/logger") as {
          logger: { warn: (message: string, meta: unknown) => void };
        };
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
    const { start } = runtimeRequire("./lib/server/jobs") as { start: () => void };
    start();
  }
}
