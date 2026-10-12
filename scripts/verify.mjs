import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function buildChecks(root, profile) {
  if (!['developer', 'release'].includes(profile)) throw new Error('Unknown verification profile');
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const compiler = resolve(root, 'node_modules/typescript/bin/tsc');
  const npmCli = process.env.npm_execpath;
  const applicationCommand = npmCli && existsSync(npmCli)
    ? [process.execPath, npmCli, 'run', 'test:app']
    : [process.platform === 'win32' ? 'npm.cmd' : 'npm', 'run', 'test:app'];
  const releaseOnly = profile === 'release'
    ? [{ name: 'published source', argv: [process.execPath, 'scripts/release-source.mjs'], available: true }]
    : [];
  return [
    ...releaseOnly,
    { name: 'context', argv: [process.execPath, 'scripts/check-context.mjs'], available: true },
    { name: 'harness', argv: [process.execPath, '--test', 'tests/harness.test.mjs'], available: true },
    { name: 'typecheck', argv: [process.execPath, compiler, '--noEmit', '--incremental', 'false'], available: existsSync(compiler) },
    { name: 'application tests', argv: applicationCommand,
      available: Boolean(pkg.scripts?.['test:app']) && existsSync(resolve(root, 'node_modules')) },
  ];
}

export function runVerification(root, profile, runner = spawnSync) {
  return buildChecks(root, profile).map((check) => {
    if (!check.available) return { name: check.name, status: profile === 'release' ? 'FAIL' : 'SKIP', reason: 'Missing local prerequisite', exitCode: null };
    const result = runner(check.argv[0], check.argv.slice(1), {
      cwd: root, stdio: 'inherit', timeout: 300000,
      // npm.cmd needs cmd.exe on Windows; argv contains only fixed repository commands.
      shell: process.platform === 'win32' && check.argv[0] === 'npm.cmd',
    });
    return { name: check.name, status: !result.error && result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status ?? null };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--profile' && ['developer', 'release'].includes(args[1]))) {
    console.error('Usage: node scripts/verify.mjs [--profile developer|release]');
    process.exitCode = 1;
  } else {
    const profile = args[1] ?? 'developer';
    const checks = runVerification(ROOT, profile);
    mkdirSync(resolve(ROOT, '.verification'), { recursive: true });
    writeFileSync(resolve(ROOT, '.verification/verification.json'), JSON.stringify({ profile, timestamp: new Date().toISOString(), checks }, null, 2) + '\n');
    for (const check of checks) console.log(`${check.status}: ${check.name}${check.reason ? ` (${check.reason})` : ''}`);
    process.exitCode = checks.some((check) => check.status === 'FAIL') ? 1 : 0;
  }
}
