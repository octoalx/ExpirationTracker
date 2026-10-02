const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real hook with a fake job module: no database or transports load.
function hook(env) {
  const source = fs.readFileSync(path.join(__dirname, '../src/instrumentation.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  let imports = 0;
  let starts = 0;
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env }, require(name) {
    assert.equal(name, './lib/server/jobs');
    imports++;
    return { start() { starts++; } };
  } });
  return { register: exports.register, counts: () => ({ imports, starts }) };
}

test('disabled Node startup never imports or starts background jobs', async () => {
  const app = hook({ NEXT_RUNTIME: 'nodejs', DISABLE_BACKGROUND_JOBS: 'true' });
  await app.register();
  assert.deepEqual(app.counts(), { imports: 0, starts: 0 });
});

test('normal Node startup preserves background job initialization', async () => {
  for (const setting of [undefined, 'false']) {
    const app = hook({ NEXT_RUNTIME: 'nodejs', DISABLE_BACKGROUND_JOBS: setting });
    await app.register();
    assert.deepEqual(app.counts(), { imports: 1, starts: 1 });
  }
});

test('Edge runtime never loads Node background services', async () => {
  const app = hook({ NEXT_RUNTIME: 'edge' });
  await app.register();
  assert.deepEqual(app.counts(), { imports: 0, starts: 0 });
});
