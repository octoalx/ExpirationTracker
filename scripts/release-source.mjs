import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Release only what is already on GitHub main: a clean tree whose HEAD is contained in a freshly fetched origin/main.
export function checkReleaseSource(root, { remote = 'origin', branch = 'main', run = spawnSync } = {}) {
  const git = (...args) => run('git', args, { cwd: root, encoding: 'utf8', timeout: 60000 });
  const problems = [];
  const status = git('status', '--porcelain');
  if (status.status !== 0) return ['Not a git checkout: release source cannot be confirmed'];
  if (status.stdout.trim()) problems.push('Uncommitted changes: commit them on a branch and merge a PR first');
  const fetched = git('fetch', '--quiet', remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`);
  if (fetched.status !== 0) return [...problems, `Cannot fetch ${remote}/${branch}: release source cannot be confirmed`];
  const contained = git('merge-base', '--is-ancestor', 'HEAD', `${remote}/${branch}`);
  if (contained.status !== 0) problems.push(`HEAD is not in ${remote}/${branch}: push a branch, merge the PR, release from ${branch}`);
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkReleaseSource(ROOT);
  for (const problem of problems) console.error(`release source: ${problem}`);
  process.exitCode = problems.length ? 1 : 0;
}
