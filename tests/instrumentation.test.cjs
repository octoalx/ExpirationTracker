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
function hook(env, healthResult = { quarantinedTo: null, journal: {}, journalMode: "wal" }) {
  const source = fs.readFileSync(path.join(__dirname, '../src/instrumentation.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  let imports = 0;
  let starts = 0;
  let healthRuns = 0;
  const exports = {};
  const fakes = {
    './lib/prisma': { resolvePrismaDbPath: () => '/tmp/fake.db' },
    './lib/server/sqlite-health': { prepareDatabaseForStartup: () => { healthRuns++; return healthResult; } },
    './lib/logger': { logger: { warn() {}, info() {}, error() {} } },
    './lib/server/jobs': { start() { starts++; } },
  };
  vm.runInNewContext(code, { exports, process: { env }, console: { warn() {} }, require(name) {
    assert.ok(name in fakes, `unexpected dependency: ${name}`);
    if (name === './lib/server/jobs') imports++;
    return fakes[name];
  } });
  return { register: exports.register, counts: () => ({ imports, starts, healthRuns }) };
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
