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
 *
 * Why development needs `createDevLoader` (2026-10-23, PR #34): there is no build
 * step in dev, the hook is executed straight from `.next/server/instrumentation.js`,
 * and every id below is resolved against that directory. Node looks for `./lib/prisma`
 * next to the bundle, finds nothing, and `npm run dev` died with "Cannot find module
 * './lib/prisma'". The ids stay exactly as they are here — the dev loader builds the
 * two guard modules itself and answers the same ids. Production takes the original
 * branch, unchanged.
 */
type NodeRequire = (id: string) => unknown;

/** Loads a module at runtime without letting the bundler trace the dependency. */
function runtimeRequire(id: string): unknown {
  const runtime = eval("require") as NodeRequire;
  return runtime(id);
}

/** A module the hook loads at startup, by the id the production path uses. */
const DEV_GUARD_MODULES = ["./lib/prisma", "./lib/server/sqlite-health"] as const;

/**
 * Development-only loader: compiles the guard modules and hands them back by id.
 *
 * The dev server never compiles these modules, because the hook loads them at runtime
 * on purpose (the header explains why), and Node cannot load a TypeScript source that
 * imports a sibling by a path without an extension. So the hook makes the CommonJS
 * build itself — once — with the `typescript` package that is already installed, into
 * `.next/server/dev-lib`, rewriting relative imports to `.ts` paths. Nothing is
 * written outside `.next`, which every dev run throws away anyway.
 *
 * Only development reaches this code; the production and edge branches keep the
 * original `runtimeRequire` and its ids.
 */
function createDevLoader(): NodeRequire {
  // The bundler must not trace these: webpack would try to bundle `node:fs` itself.
  const runtime = eval("require") as NodeRequire;
  const nodePath = runtime("node:path") as { resolve: (...parts: string[]) => string; join: (...parts: string[]) => string };
  // The two guard modules are replaced by fakes in tests/instrumentation.test.cjs;
  // everything else below is the real Node API.
  const nodeFs = runtime("node:fs") as {
    readFileSync: (path: string, encoding: string) => string;
    writeFileSync: (path: string, data: string) => void;
    mkdirSync: (path: string, options: { recursive: boolean }) => void;
  };
  const nodeModule = runtime("node:module") as { createRequire: (from: string) => NodeRequire };
  const repoRoot = nodePath.resolve(process.cwd());
  const load = nodeModule.createRequire(nodePath.resolve(repoRoot, "package.json"));
  const ts = load("typescript") as {
    ModuleKind: { CommonJS: number };
    ScriptTarget: { ES2022: number };
    transpileModule: (source: string, options: { fileName: string; compilerOptions: unknown }) => { outputText: string };
  };

  const outDir = nodePath.join(repoRoot, ".next/server/dev-lib");
  nodeFs.mkdirSync(outDir, { recursive: true });
  for (const id of DEV_GUARD_MODULES) {
    const sourceFile = nodePath.join(repoRoot, "src", `${id.replace(/^\.\//, "")}.ts`);
    const compiled = ts.transpileModule(nodeFs.readFileSync(sourceFile, "utf8"), {
      fileName: sourceFile,
      // Without the module target the emit keeps ESM syntax, which Node then loads as
      // ESM — where an extensionless relative import and a default import both break.
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    // Node resolves a CommonJS `require("./x")` by extension; the sources use `./x`.
    const withExtensions = compiled.replace(
      /require\("(\.[^"]*)"\)/g,
      (match: string, target: string) => (target.endsWith(".ts") ? match : `require("${target}.ts")`),
    );
    const target = nodePath.join(outDir, `${id.replace(/^\.\//, "")}.ts`);
    nodeFs.mkdirSync(nodePath.join(target, ".."), { recursive: true });
    nodeFs.writeFileSync(target, withExtensions);
  }

  return (id: string) => load(nodePath.join(outDir, `${id.replace(/^\.\//, "")}.ts`));
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const load: NodeRequire = process.env.NODE_ENV === "development" ? createDevLoader() : runtimeRequire;

  const { resolvePrismaDbPath } = load("./lib/prisma") as {
    resolvePrismaDbPath: () => string;
  };
  const { prepareDatabaseForStartup } = load("./lib/server/sqlite-health") as {
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
