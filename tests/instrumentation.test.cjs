const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real hook with fake job and database-health modules: no database or
// transports load. The hook now runs a database guard (WAL + journal quarantine)
// before importing jobs, so the fakes must cover './lib/prisma' and
// './lib/server/sqlite-health' as well as './lib/server/jobs'.
//
// `module` is supplied because the development branch builds its own loader from it;
// the production and edge runs never touch it, which is itself asserted below.
function hook(env, healthResult = { quarantinedTo: null, journal: {}, journalMode: "wal" }) {
  // Injected into the sandbox: its own `require` would resolve against the bundle's
  // directory, and the point of these tests is that the hook does not depend on that.
  const typescript = require('typescript');
  const source = fs.readFileSync(path.join(__dirname, '../src/instrumentation.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  let imports = 0;
  let starts = 0;
  let healthRuns = 0;
  // Counted separately: the hook's own loading (what production does) and the dev
  // builder's compilation step (what only development does).
  let hookLoads = 0;
  let devBuilds = 0;
  const exports = {};
  const fakes = {
    './lib/prisma': { resolvePrismaDbPath: () => '/tmp/fake.db' },
    './lib/server/sqlite-health': { prepareDatabaseForStartup: () => { healthRuns++; return healthResult; } },
    './lib/logger': { logger: { warn() {}, info() {}, error() {} } },
    './lib/server/jobs': { start() { starts++; } },
  };
  // The dev loader compiles TypeScript and writes into `.next/server/dev-lib`; here it
  // runs against stand-ins, so only its control flow is exercised — the real
  // compilation is covered by running `next dev`.
  const fakeRequire = (name) => {
    // Everything the hook loads, in either branch, is counted here.
    hookLoads++;
    if (name in fakes) {
      if (name === './lib/server/jobs') imports++;
      return fakes[name];
    }
    if (name === 'typescript') {
      const real = require('typescript');
      return {
        ModuleKind: real.ModuleKind,
        ScriptTarget: real.ScriptTarget,
        transpileModule: () => { devBuilds++; return { outputText: '' }; },
      };
    }
    // The dev builder asks this loader for the files it compiled *and* for `typescript`
    // itself; both map onto the fakes, so both branches end up with the same modules.
    if (name === 'node:module') {
      return {
        createRequire: () => (file) =>
          fakeRequire(file.includes('typescript') ? 'typescript'
            : file.includes('sqlite-health') ? './lib/server/sqlite-health'
              : './lib/prisma'),
      };
    }
    if (name === 'node:path') {
      return { resolve: (...parts) => parts.join('/'), join: (...parts) => parts.join('/') };
    }
    if (name === 'node:fs') {
      return { readFileSync: () => '', writeFileSync() {}, mkdirSync() {} };
    }
    // Everything else is the hook loading one of its runtime modules.
    assert.ok(name in fakes, `unexpected dependency: ${name}`);
    return fakes[name];
  };
  // Real `typescript` inside the sandbox for the ModuleKind constants; everything else
  // goes through the fake.
  const sandboxRequire = (name) => (name === 'typescript' ? typescript : fakeRequire(name));
  vm.runInNewContext(code, {
    exports,
    process: { env, cwd: () => '/repo' },
    console: { warn() {} },
    module: { require: fakeRequire },
    // The hook reaches Node through eval("require"); in this sandbox that is the same
    // fake that knows the guard modules, so nothing real is loaded.
    require: sandboxRequire,
    __hookRequire: sandboxRequire,
  });
  return {
    register: exports.register,
    counts: () => ({ imports, starts, healthRuns }),
    hookLoads: () => hookLoads,
    devBuilds: () => devBuilds,
  };
}

test('disabled Node startup never imports or starts background jobs', async () => {
  const app = hook({ NEXT_RUNTIME: 'nodejs', DISABLE_BACKGROUND_JOBS: 'true' });
  await app.register();
  assert.deepEqual(app.counts(), { imports: 0, starts: 0, healthRuns: 1 });
});

test('normal Node startup preserves background job initialization', async () => {
  for (const setting of [undefined, 'false']) {
    const app = hook({ NEXT_RUNTIME: 'nodejs', DISABLE_BACKGROUND_JOBS: setting });
    await app.register();
    assert.deepEqual(app.counts(), { imports: 1, starts: 1, healthRuns: 1 });
  }
});

test('Edge runtime never loads Node background services', async () => {
  const app = hook({ NEXT_RUNTIME: 'edge' });
  await app.register();
  assert.deepEqual(app.counts(), { imports: 0, starts: 0, healthRuns: 0 });
});

test('production startup loads the modules through the runtime require, not the dev builder', async () => {
  const app = hook({ NEXT_RUNTIME: 'nodejs', NODE_ENV: 'production', DISABLE_BACKGROUND_JOBS: 'true' });
  await app.register();
  assert.deepEqual(app.counts(), { imports: 0, starts: 0, healthRuns: 1 }, 'AC3: the guard still runs');
  assert.equal(app.hookLoads(), 2, 'AC3: production loads its two modules itself');
  assert.equal(app.devBuilds(), 0, 'AC3: production never compiles modules for development');
});

test('development startup builds its own modules instead of relying on the bundle', async () => {
  const app = hook({ NEXT_RUNTIME: 'nodejs', NODE_ENV: 'development', DISABLE_BACKGROUND_JOBS: 'true' });
  await app.register();
  assert.deepEqual(app.counts(), { imports: 0, starts: 0, healthRuns: 1 }, 'AC2: the guard runs before jobs in development too');
  assert.equal(app.devBuilds(), 2, 'AC1: the dev branch built both guard modules itself');
  assert.ok(app.hookLoads() >= 2, 'AC1: and loaded both of them back through the same ids');
});
