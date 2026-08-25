#!/usr/bin/env node
/**
 * Static guard for the offline requirement.
 *
 * A production build must make zero required external network requests. This
 * scans the built output for the constructs that actually cause a fetch - HTML
 * src/href attributes, CSS url(), dynamic import, importScripts, fetch and
 * XHR against an absolute URL, plus known CDN and webfont hosts.
 *
 * Bare URLs in comments and licence headers are reported but do not fail: they
 * are not requests. This is a fast structural guard, not a substitute for the
 * browser-level network check recorded in docs/qa/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const distDir = process.argv[2] ?? 'starter/dist';
const SCANNED_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest']);

const FORBIDDEN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'ajax.googleapis.com',
  'googletagmanager.com',
  'google-analytics.com',
];

const REQUEST_PATTERNS = [
  { id: 'html-src', pattern: /\ssrc\s*=\s*["']\s*(?:https?:)?\/\//gi },
  { id: 'html-href', pattern: /\shref\s*=\s*["']\s*(?:https?:)?\/\//gi },
  { id: 'css-url', pattern: /url\(\s*["']?\s*(?:https?:)?\/\//gi },
  { id: 'css-import', pattern: /@import\s+(?:url\()?["']?\s*(?:https?:)?\/\//gi },
  { id: 'dynamic-import', pattern: /\bimport\s*\(\s*["'`]https?:\/\//gi },
  { id: 'static-import', pattern: /\bfrom\s*["']https?:\/\//gi },
  { id: 'import-scripts', pattern: /\bimportScripts\s*\(\s*["'`]https?:\/\//gi },
  { id: 'fetch', pattern: /\bfetch\s*\(\s*["'`]https?:\/\//gi },
  { id: 'xhr-open', pattern: /\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["'`]https?:\/\//gi },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(distDir).filter((file) => SCANNED_EXTENSIONS.has(extname(file)));
} catch {
  console.error(`offline check: build output not found at "${distDir}". Run the build first.`);
  process.exit(2);
}

const violations = [];
let informationalUrls = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const shortName = relative(process.cwd(), file);

  for (const { id, pattern } of REQUEST_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      violations.push({ file: shortName, rule: id, excerpt: excerpt(text, match.index ?? 0) });
    }
  }
  for (const host of FORBIDDEN_HOSTS) {
    if (text.includes(host)) {
      violations.push({ file: shortName, rule: `forbidden-host:${host}`, excerpt: host });
    }
  }
  informationalUrls += (text.match(/https?:\/\//g) ?? []).length;
}

function excerpt(text, index) {
  return text.slice(index, index + 90).replace(/\s+/g, ' ');
}

console.log(`offline check: scanned ${files.length} file(s) in "${distDir}"`);
console.log(`offline check: ${informationalUrls} absolute URL string(s) present (comments and licences included)`);

if (violations.length > 0) {
  console.error(`offline check: FAILED with ${violations.length} required external reference(s):`);
  for (const violation of violations) {
    console.error(`  [${violation.rule}] ${violation.file}: ${violation.excerpt}`);
  }
  process.exit(1);
}

console.log('offline check: PASSED - no external request construct found in the build output');
