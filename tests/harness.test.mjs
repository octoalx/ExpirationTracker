import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkContext } from '../scripts/check-context.mjs';
import { runVerification } from '../scripts/verify.mjs';
import { checkReleaseSource } from '../scripts/release-source.mjs';
import { spawnSync } from 'node:child_process';

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
  const release = runVerification(root, 'release', runner);
  assert.equal(release[0].name, 'published source');                          // release starts from GitHub main
  assert.deepEqual(release.map((c) => c.status), ['PASS', 'PASS', 'PASS', 'FAIL', 'FAIL']);
  assert.equal(calls, 5);
});

test('failed and timed-out checks never become passes', (t) => {
  const root = fixture(t);
  const failures = runVerification(root, 'developer', () => ({ status: 1 }));
  assert.equal(failures[0].status, 'FAIL');
  const timeouts = runVerification(root, 'developer', () => ({ status: null, error: new Error('timeout') }));
  assert.equal(timeouts[0].status, 'FAIL');
  assert.throws(() => runVerification(root, 'unknown'), /Unknown verification profile/);
});

function gitRepos(t) {
  const root = mkdtempSync(join(tmpdir(), 'expitrack-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const origin = join(root, 'origin.git'), work = join(root, 'work');
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(root, 'clone', '-q', origin, work);
  writeFileSync(join(work, 'a.txt'), 'one\n');
  git(work, 'add', '-A'); git(work, 'commit', '-qm', 'base'); git(work, 'push', '-q', 'origin', 'HEAD:main');
  return { work, git };
}

test('release source must be committed and already on GitHub main', (t) => {
  const { work, git } = gitRepos(t);
  assert.deepEqual(checkReleaseSource(work), []);
  writeFileSync(join(work, 'a.txt'), 'edited\n');
  assert.match(checkReleaseSource(work).join(), /Uncommitted changes/);
  git(work, 'commit', '-qam', 'local only');
  assert.match(checkReleaseSource(work).join(), /HEAD is not in origin\/main/);
  git(work, 'push', '-q', 'origin', 'HEAD:main');
  assert.deepEqual(checkReleaseSource(work), []);
  git(work, 'remote', 'set-url', 'origin', join(work, 'missing.git'));
  assert.match(checkReleaseSource(work).join(), /Cannot fetch/);
});
