import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkContext } from '../scripts/check-context.mjs';
import { checkSpec, gatedFiles } from '../scripts/check-spec.mjs';
import { runVerification } from '../scripts/verify.mjs';
import { checkReleaseSource } from '../scripts/release-source.mjs';
import { checkDeployWorkflow, WORKFLOW_PATH } from '../scripts/deploy-workflow.mjs';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function deployFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'expitrack-cd-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.github/workflows'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  for (const script of ['release-backup.sh', 'release-healthcheck.sh']) {
    writeFileSync(join(root, 'scripts', script), '#!/usr/bin/env bash\n');
  }
  const source = readFileSync(join(REPO_ROOT, WORKFLOW_PATH), 'utf8');
  writeFileSync(join(root, WORKFLOW_PATH), source);
  return { root, source, write: (text) => writeFileSync(join(root, WORKFLOW_PATH), text) };
}

test('CD workflow keeps manual delivery, the environment gate and ordered safety steps', (t) => {
  const { root, source, write } = deployFixture(t);
  assert.deepEqual(checkDeployWorkflow(root), [], 'the committed deploy workflow must pass its own safety check');

  // A push trigger would deploy without the owner's explicit command.
  write(source.replace('workflow_dispatch:', 'push:'));
  assert.match(checkDeployWorkflow(root).join(), /workflow_dispatch is missing/);

  // Without the protected environment there is no approval gate.
  write(source.replace('name: production', 'name: staging'));
  assert.match(checkDeployWorkflow(root).join(), /"production" environment/);

  // The SSH key must never be an inline value.
  write(source.replace('secrets.PROD_SSH_KEY', "'-----BEGIN'"));
  assert.match(checkDeployWorkflow(root).join(), /PROD_SSH_KEY secret/);

  // A rollback that is unconditional, or allowed during a dry run, could undo a good
  // release; one that ignores whether the deploy ran announces a rollback that never
  // happened. Each property is asserted separately so a regression names itself.
  const rollbackIf = source.match(/^\s+if: \$\{\{ failure\(\).*$/m)?.[0].trim() ?? '';
  assert.ok(rollbackIf, 'the workflow must have a failure-conditioned rollback step');

  write(source.replace(rollbackIf, 'if: ${{ always() }}'));
  assert.match(checkDeployWorkflow(root).join(), /conditional on failure\(\)/);

  write(source.replace(rollbackIf, "if: ${{ failure() && steps.deploy.outcome == 'failure' }}"));
  assert.match(checkDeployWorkflow(root).join(), /must not run during a dry run/);

  write(source.replace(rollbackIf, "if: ${{ failure() && inputs.dry_run == false && steps.previous.outputs.previous != '' }}"));
  assert.match(checkDeployWorkflow(root).join(), /must require that the deploy step itself failed/);
});

test('deploy workflow check rejects a backup taken after the deploy', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'expitrack-cd-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.github/workflows'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  for (const script of ['release-backup.sh', 'release-healthcheck.sh']) {
    writeFileSync(join(root, 'scripts', script), '#!/usr/bin/env bash\n');
  }
  // Minimal workflow with the steps in the unsafe order: rebuilding before the
  // database has been captured would make the backup useless.
  writeFileSync(join(root, WORKFLOW_PATH), [
    'name: Deploy production',
    'on:',
    '  workflow_dispatch:',
    'jobs:',
    '  deploy:',
    '    environment:',
    '      name: production',
    '    steps:',
    '      - name: Deploy the revision',
    '        run: bash scripts/release-healthcheck.sh',
    '      - name: Back up the production database',
    '        run: bash scripts/release-backup.sh',
    '      - name: Health check the deployed revision',
    '        run: bash scripts/release-healthcheck.sh',
    '      - name: Roll back to the previous revision',
    '        if: ${{ failure() }}',
    '        run: bash scripts/release-healthcheck.sh',
  ].join('\n') + '\n');
  assert.match(checkDeployWorkflow(root).join(), /Backup must run before the deploy/);
  // A missing script is reported even when the workflow references it.
  rmSync(join(root, 'scripts/release-backup.sh'));
  assert.match(checkDeployWorkflow(root).join(), /release-backup\.sh, which does not exist/);
});

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

function specFixture(t, { status = 'APPROVED', approval = 'Alex, 2026-10-23, in chat', criteria = ['AC1 — the screen shows the team', 'AC2 — the API rejects an outsider'], verified = ['AC1', 'AC2'], files = ['`src/pages/settings.tsx`'], extra = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'expitrack-spec-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/specs'), { recursive: true });
  writeFileSync(join(root, 'docs/specs/2026-10-23-example.md'), [
    '# Example',
    '',
    `Status: ${status}`,
    `Owner approval: ${approval}`,
    'Type: feature',
    '',
    '## Acceptance criteria',
    '',
    ...criteria.map((line) => `- ${line}`),
    '',
    '## Files and signatures (draft)',
    '',
    ...files.map((line) => `- ${line}`),
    '',
    '## Verification plan',
    '',
    ...verified.map((id) => `- ${id} -> tests/example.test.cjs`),
    '',
    extra,
  ].join('\n'));
  return root;
}

const EXAMPLE_SPEC = 'docs/specs/2026-10-23-example.md';

test('spec gate asks nothing from a documentation-only change', () => {
  assert.deepEqual(gatedFiles(['docs/engineering/workflow.md', 'docs/adr/README.md', 'README.md', 'memory-bank/activeContext.md']), []);
  assert.deepEqual(checkSpec({ root: REPO_ROOT, files: ['docs/engineering/workflow.md'], prBody: '' }), []);
  assert.deepEqual(gatedFiles(['src/pages/index.tsx', 'prisma/schema.prisma', 'package.json', 'tests/a.test.cjs']), ['src/pages/index.tsx', 'prisma/schema.prisma', 'package.json', 'tests/a.test.cjs']);
});

test('spec gate fails a source change with no spec reference', (t) => {
  const root = specFixture(t);
  const failures = checkSpec({ root, files: ['src/pages/settings.tsx'], prBody: 'Just a fix.' });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /names no spec under docs\/specs/);
});

test('spec gate rejects an unapproved spec and an empty approval line', (t) => {
  const draft = specFixture(t, { status: 'DRAFT' });
  assert.match(checkSpec({ root: draft, files: ['src/pages/settings.tsx'], prBody: `Spec: ${EXAMPLE_SPEC}` }).join(), /expected APPROVED/);

  const empty = specFixture(t, { approval: '<name, YYYY-MM-DD>' });
  assert.match(checkSpec({ root: empty, files: ['src/pages/settings.tsx'], prBody: `Spec: ${EXAMPLE_SPEC}` }).join(), /no filled "Owner approval/);
});

test('spec gate requires a verification entry for every acceptance criterion', (t) => {
  const root = specFixture(t, { verified: ['AC1'] });
  const failures = checkSpec({ root, files: ['src/pages/settings.tsx'], prBody: `Spec: ${EXAMPLE_SPEC}` });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /AC2 has no entry in the verification plan/);

  const noCriteria = specFixture(t, { criteria: [], verified: [] });
  assert.match(checkSpec({ root: noCriteria, files: ['src/pages/settings.tsx'], prBody: `Spec: ${EXAMPLE_SPEC}` }).join(), /lists no acceptance criteria/);
});

test('spec gate rejects a file the spec does not list unless out-of-spec explains it', (t) => {
  const root = specFixture(t);
  const body = `Spec: ${EXAMPLE_SPEC}`;
  const failures = checkSpec({ root, files: ['src/pages/settings.tsx', 'src/lib/server/departments.ts'], prBody: body });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /src\/lib\/server\/departments\.ts is changed/);

  const explained = specFixture(t, { extra: 'out-of-spec: src/lib/server/departments.ts, the handler lives there' });
  assert.deepEqual(checkSpec({ root: explained, files: ['src/pages/settings.tsx', 'src/lib/server/departments.ts'], prBody: body }), []);

  const explainedInPr = checkSpec({ root, files: ['src/pages/settings.tsx', 'src/lib/server/departments.ts'], prBody: `${body}\nout-of-spec: src/lib/server/departments.ts, shared helper` });
  assert.deepEqual(explainedInPr, []);
});

test('spec gate honours the explicit chore override and a missing spec file', (t) => {
  const root = specFixture(t);
  assert.deepEqual(checkSpec({ root, files: ['package-lock.json'], prBody: 'No spec required: dependency bump' }), []);
  assert.match(checkSpec({ root, files: ['package-lock.json'], prBody: '' }).join(), /names no spec/);
  const missing = checkSpec({ root: REPO_ROOT, files: ['src/pages/settings.tsx'], prBody: 'Spec: docs/specs/1999-01-01-missing.md' });
  assert.match(missing.join(), /does not exist/);
});
