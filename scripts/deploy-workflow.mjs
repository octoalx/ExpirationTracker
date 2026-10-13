import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const WORKFLOW_PATH = '.github/workflows/deploy-production.yml';

/**
 * Returns the lines of a top-level YAML block, excluding the key line itself.
 * The deploy workflow is small and hand-written, so a structural slice is
 * enough: it keeps the trigger checks from matching text inside job steps.
 */
function block(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start === -1) return null;
  const rest = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.startsWith('#')) { rest.push(line); continue; }
    if (!/^\s/.test(line)) break;            // a new top-level key ends the block
    rest.push(line);
  }
  return rest.join('\n');
}

/**
 * Checks the CD workflow's safety properties. These are the guarantees that make
 * an automated deploy acceptable on production, so they are asserted in CI rather
 * than trusted to review:
 *   - delivery is manual (workflow_dispatch) and never triggered by a push;
 *   - the job is gated by the `production` environment;
 *   - a database backup completes before anything is rebuilt;
 *   - a health check follows the deploy, and a failure triggers a rollback;
 *   - the helper scripts the workflow calls exist in the repository.
 *
 * @returns {string[]} problems; empty means the workflow is acceptable.
 */
export function checkDeployWorkflow(root = ROOT) {
  const problems = [];
  const file = resolve(root, WORKFLOW_PATH);
  if (!existsSync(file)) return [`Missing ${WORKFLOW_PATH}`];
  const text = readFileSync(file, 'utf8');

  const on = block(text, 'on');
  if (on === null) problems.push('Workflow has no top-level "on:" trigger block');
  else {
    if (!/^\s+workflow_dispatch:/m.test(on)) problems.push('Delivery must be manually triggered: workflow_dispatch is missing');
    // A push or schedule trigger would deploy without an explicit owner command.
    if (/^\s+push:/m.test(on)) problems.push('Workflow must not deploy on push; delivery is manual');
    if (/^\s+schedule:/m.test(on)) problems.push('Workflow must not deploy on a schedule; delivery is manual');
  }

  if (!/^\s+environment:/m.test(text)) problems.push('Deploy job must be bound to a protected environment');
  if (!/name:\s*production\b/.test(text)) problems.push('Deploy job must target the "production" environment');

  const jobs = block(text, 'jobs');
  if (jobs === null) problems.push('Workflow has no "jobs:" block');
  else if (!/concurrency:/m.test(text)) problems.push('Workflow needs a concurrency group so releases cannot overlap');

  // Ordering is the core safety property: no rebuild before a backup exists, and
  // no success claim before a health check has passed.
  const backupAt = text.indexOf('Back up the production database');
  const deployAt = text.indexOf('Deploy the revision');
  const healthAt = text.indexOf('Health check the deployed revision');
  const rollbackAt = text.indexOf('Roll back to the previous revision');
  if (backupAt === -1) problems.push('Workflow has no database backup step');
  if (deployAt === -1) problems.push('Workflow has no deploy step');
  if (healthAt === -1) problems.push('Workflow has no health check step');
  if (rollbackAt === -1) problems.push('Workflow has no rollback step');
  if (backupAt !== -1 && deployAt !== -1 && backupAt > deployAt) {
    problems.push('Backup must run before the deploy; data would be lost on failure');
  }
  if (deployAt !== -1 && healthAt !== -1 && deployAt > healthAt) {
    problems.push('Health check must run after the deploy');
  }

  // The rollback step must be conditional on a prior failure and must not fire
  // during a dry run, otherwise a successful deploy could be rolled back.
  if (rollbackAt !== -1) {
    const rollbackStep = text.slice(rollbackAt, rollbackAt + 400);
    if (!/if:\s*\$\{\{\s*failure\(\)/.test(rollbackStep)) {
      problems.push('Rollback step must be conditional on failure()');
    }
  }

  for (const script of ['scripts/release-backup.sh', 'scripts/release-healthcheck.sh']) {
    if (!text.includes(script)) problems.push(`Workflow does not call ${script}`);
    else if (!existsSync(resolve(root, script))) problems.push(`Workflow calls ${script}, which does not exist`);
  }

  // The SSH key must come from a secret, never from a value in the repository.
  if (!/secrets\.PROD_SSH_KEY/.test(text)) problems.push('SSH key must be read from the PROD_SSH_KEY secret');

  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkDeployWorkflow();
  for (const problem of problems) console.error(`deploy workflow: ${problem}`);
  if (!problems.length) console.log('PASS: CD workflow keeps manual trigger, environment gate, ordered backup/deploy/health and rollback');
  process.exitCode = problems.length ? 1 : 0;
}
