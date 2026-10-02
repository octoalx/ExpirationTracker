import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkContext } from '../scripts/check-context.mjs';
import { runVerification } from '../scripts/verify.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'expitrack-harness-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'AGENTS.md'), '# Contract\n');
  writeFileSync(join(root, 'package.json'), '{"scripts":{}}');
  return root;
}

test('context check catches missing contract, oversized context and broken links', (t) => {
  const root = fixture(t);
  assert.deepEqual(checkContext(root), []);
  writeFileSync(join(root, 'AGENTS.md'), 'x'.repeat(7001) + '\n[missing](missing.md)');
  assert.equal(checkContext(root).length, 2);
  rmSync(join(root, 'AGENTS.md'));
  assert.deepEqual(checkContext(root), ['Missing AGENTS.md']);
});

test('developer skips absent app tools; release fails closed without running them', (t) => {
  const root = fixture(t);
  let calls = 0;
  const runner = () => { calls++; return { status: 0 }; };
  assert.deepEqual(runVerification(root, 'developer', runner).map((c) => c.status), ['PASS', 'PASS', 'SKIP', 'SKIP']);
  assert.deepEqual(runVerification(root, 'release', runner).map((c) => c.status), ['PASS', 'PASS', 'FAIL', 'FAIL']);
  assert.equal(calls, 4);
});

test('failed and timed-out checks never become passes', (t) => {
  const root = fixture(t);
  const failures = runVerification(root, 'developer', () => ({ status: 1 }));
  assert.equal(failures[0].status, 'FAIL');
  const timeouts = runVerification(root, 'developer', () => ({ status: null, error: new Error('timeout') }));
  assert.equal(timeouts[0].status, 'FAIL');
  assert.throws(() => runVerification(root, 'unknown'), /Unknown verification profile/);
});
