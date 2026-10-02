import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function checkContext(root = ROOT) {
  const failures = [];
  const contract = resolve(root, 'AGENTS.md');
  if (!existsSync(contract)) return ['Missing AGENTS.md'];
  const estimate = Math.ceil(readFileSync(contract, 'utf8').length / 3.5);
  if (estimate > 2000) failures.push(`AGENTS.md exceeds 2000 estimated tokens (${estimate})`);
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.md')) checkLinks(path);
    }
  }
  function checkLinks(path) {
    const content = readFileSync(path, 'utf8');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^[a-z][a-z\d+.-]*:|^#/i.test(link)) continue;
      const target = link.split('#')[0];
      if (!existsSync(resolve(dirname(path), target))) failures.push(`Broken link in ${path}: ${link}`);
    }
  }
  checkLinks(contract);
  walk(resolve(root, 'docs'));
  walk(resolve(root, 'memory-bank'));
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkContext();
  console.log(failures.length ? failures.join('\n') : 'PASS: context budget and local documentation links');
  process.exitCode = failures.length ? 1 : 0;
}
