import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function isPlaceholder(value) {
  const v = String(value ?? '').trim().toLowerCase();

  if (!v) return true;

  return [
    'your_own_geoapify_key',
    'your_geoapify_key',
    'placeholder',
    'example',
    'redacted',
    'changeme',
    'replace_me',
    'replace-me',
  ].some((x) => v.includes(x));
}

function scan(text, source) {
  let failures = 0;

  for (const line of text.split(/\r?\n/)) {
    const marker = 'GEOAPIFY_API_KEY=';
    const index = line.indexOf(marker);

    if (index === -1) continue;

    const value = line.slice(index + marker.length).trim();

    if (value.length >= 16 && !isPlaceholder(value)) {
      failures += 1;
      console.error(`Potential Geoapify credential found in ${source}`);
    }
  }

  return failures;
}

let failures = 0;

const trackedFiles = git(['ls-files', '-z'])
  .split('\0')
  .filter(Boolean);

for (const file of trackedFiles) {
  let content;

  try {
    content = readFileSync(file);
  } catch {
    continue;
  }

  if (content.includes(0)) continue;

  failures += scan(
    content.toString('utf8'),
    `tracked file ${file}`,
  );
}

const history = git([
  'log',
  '-p',
  '--all',
  '--full-history',
  '--no-ext-diff',
  '--format=fuller',
]);

failures += scan(history, 'Git history');

if (failures > 0) {
  console.error(
    `Secret verification failed: ${failures} potential finding(s).`,
  );
  process.exit(1);
}

console.log(
  'Secret verification passed: no likely Geoapify API key assignment found in tracked files or Git history.',
);
