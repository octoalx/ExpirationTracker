import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Paths whose change requires an approved specification. Documentation, plans and
// the specs themselves are deliberately absent: a docs-only pull request must not
// need a spec to describe itself.
const GATED = [
  /^src\//,
  /^prisma\//,
  /^scripts\//,
  /^tests\//,
  /^nginx\//,
  /^\.github\/workflows\//,
  /^Dockerfile$/,
  /^docker-compose\.yml$/,
  /^docker-entrypoint\.sh$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^next\.config\.js$/,
  /^tailwind\.config\.js$/,
];

const APPROVED_STATUSES = ['APPROVED', 'IMPLEMENTED'];

export function normalizeFiles(files = []) {
  return files.map((file) => String(file).replace(/\\/g, '/').trim()).filter(Boolean);
}

export function gatedFiles(files = []) {
  return normalizeFiles(files).filter((file) => GATED.some((pattern) => pattern.test(file)));
}

function splitSections(text) {
  const sections = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = heading[1].trim();
      sections.set(current, []);
    } else if (current) {
      sections.get(current).push(line);
    }
  }
  for (const [name, lines] of sections) sections.set(name, lines.join('\n'));
  return sections;
}

function section(sections, pattern) {
  for (const [name, body] of sections) if (pattern.test(name)) return body;
  return '';
}

function backtickedPaths(body) {
  const paths = [];
  for (const match of body.matchAll(/`([^`]+)`/g)) {
    const value = match[1].trim().replace(/^\.\//, '');
    // Skip prose, commands, placeholders and anything with whitespace or a marker.
    if (!value || /\s/.test(value) || /[<>{}*]/.test(value)) continue;
    if (!/^(src|prisma|scripts|tests|nginx|docs|\.github)\//.test(value) && !/^[\w.-]+\.(json|js|mjs|ts|tsx|sh|yml|yaml)$/.test(value)) continue;
    paths.push(value.replace(/\/$/, '/'));
  }
  return paths;
}

function covered(file, listed) {
  if (listed.has(file)) return true;
  for (const entry of listed) {
    if (entry.endsWith('/') && file.startsWith(entry)) return true;
  }
  return false;
}

/**
 * Deterministic HITL gate for pull requests.
 *
 * @param {{root?: string, files?: string[], prBody?: string}} input
 * @returns {string[]} failures; an empty array means the pull request passes.
 */
export function checkSpec({ root = ROOT, files = [], prBody = '' } = {}) {
  const failures = [];
  const gated = gatedFiles(files);

  if (gated.length === 0) return failures;

  const override = /^\s*No spec required:[ \t]*(\S.*)$/im.exec(prBody);
  if (override) return failures;

  const reference = /docs\/specs\/([A-Za-z0-9._/-]+\.md)/.exec(prBody);
  if (!reference) {
    failures.push(
      'PR body names no spec under docs/specs/. Add the spec path, or explain a chore with "No spec required: <reason>".'
    );
    return failures;
  }

  const specPath = `docs/specs/${reference[1]}`;
  const absolute = resolve(root, specPath);
  if (!existsSync(absolute)) {
    failures.push(`${specPath} does not exist.`);
    return failures;
  }

  const text = readFileSync(absolute, 'utf8');
  const status = (/^Status:[ \t]*(.+)$/im.exec(text)?.[1] || '').trim();
  if (!APPROVED_STATUSES.includes(status)) {
    failures.push(`${specPath} has Status "${status || 'missing'}"; expected APPROVED or IMPLEMENTED.`);
  }

  const approval = (/^Owner approval:[ \t]*(.+)$/im.exec(text)?.[1] || '').trim();
  if (approval.length < 5 || approval.startsWith('<')) {
    failures.push(`${specPath} has no filled "Owner approval:" line.`);
  }

  const sections = splitSections(text);
  const criteriaBody = section(sections, /acceptance criteria/i);
  const verificationBody = section(sections, /verification plan|verification\b/i);
  const criteria = [...new Set(criteriaBody.match(/\bAC\d+\b/g) || [])];
  if (criteria.length === 0) {
    failures.push(`${specPath} lists no acceptance criteria (AC1, AC2, …).`);
  }
  const verified = new Set(verificationBody.match(/\bAC\d+\b/g) || []);
  for (const id of criteria) {
    if (!verified.has(id)) failures.push(`${specPath}: ${id} has no entry in the verification plan.`);
  }

  const listed = new Set(backtickedPaths(section(sections, /files and signatures/i)));
  const outOfSpec = /^\s*out-of-spec:[ \t]*(.+)$/gim;
  const explained = [...text.matchAll(outOfSpec), ...prBody.matchAll(outOfSpec)]
    .map((match) => match[1].trim())
    .join('\n');
  for (const file of gated) {
    if (covered(file, listed)) continue;
    if (explained.includes(file)) continue;
    failures.push(
      `${file} is changed but ${specPath} does not list it. Add it to "Files and signatures" or add "out-of-spec: ${file}, <reason>".`
    );
  }

  return failures;
}

export function changedFiles(root, base) {
  const result = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return { files: [], error: (result.stderr || 'git diff failed').trim() };
  }
  return { files: result.stdout.split(/\r?\n/).filter(Boolean), error: null };
}

function argument(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] ?? null;
}

function main() {
  const argv = process.argv.slice(2);
  const root = argument(argv, '--root') || ROOT;
  const base = argument(argv, '--base') || 'origin/main';
  const bodyFile = argument(argv, '--body-file');
  const inlineFiles = argument(argv, '--files');

  const prBody = bodyFile ? readFileSync(resolve(bodyFile), 'utf8') : process.env.PR_BODY || '';

  let files;
  if (inlineFiles) {
    files = existsSync(inlineFiles)
      ? readFileSync(inlineFiles, 'utf8').split(/\r?\n/).filter(Boolean)
      : inlineFiles.split(',').map((file) => file.trim()).filter(Boolean);
  } else {
    const diff = changedFiles(root, base);
    if (diff.error) {
      console.error(`FAIL: cannot determine changed files against ${base}: ${diff.error}`);
      process.exitCode = 1;
      return;
    }
    files = diff.files;
  }

  const failures = checkSpec({ root, files, prBody });
  if (failures.length === 0) {
    const gated = gatedFiles(files).length;
    console.log(
      gated === 0
        ? 'PASS: no gated files changed, no spec required'
        : `PASS: spec gate satisfied for ${gated} changed file(s)`
    );
    return;
  }

  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
