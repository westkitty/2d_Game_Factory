#!/usr/bin/env node
/**
 * Regenerate every *canonical* proof game from the factory.
 *
 * A canonical proof (`proofs/<id>/`) is the unmodified output of
 * `sw2d new proof-<id> --preset <id>` plus a frozen PROOF_CONTRACT.md. When
 * the factory's shells, generators or content documents change, those proofs
 * must be regenerated or `npm run qa:proof` would prove yesterday's factory.
 * The pre-program hand-authored proofs (a `src/game-specific/` that is not a
 * template copy, extra levels, custom content) are left alone - they are
 * evidence of a customised game and are covered by `npm run qa:completion`
 * for the fresh-generation half.
 *
 * Classification is mechanical: a proof is canonical when every file other
 * than PROOF_CONTRACT.md either matches the current factory output or is one
 * of the files the factory owns outright (src/**, content/*.json documents the
 * factory emits, README.md, index.html, package.json, tsconfig.json,
 * vite.config.ts, tests/**, resources/**) *and* the proof's shell is one of
 * the six templates (modulo drift). Hand-authored proofs are recognised by a
 * shell that matches no template closely, or by extra content files.
 *
 * `--check` reports drift and exits non-zero without writing.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '@sw2d/presets';
import { buildGameFiles } from '../../packages/cli/src/generator/generate.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const PROOFS_ROOT = path.join(REPO_ROOT, 'proofs');
const TEMPLATES_ROOT = path.join(REPO_ROOT, 'packages/cli/src/templates/gameSpecific');

/** Proofs written by hand before this program (custom shells / extra content). Never regenerated. */
export const HAND_AUTHORED_PROOFS: ReadonlySet<string> = new Set([
  'chase-platformer',
  'endless-runner',
  'metroidvania',
  'puzzle-platformer',
  'grappling-platformer',
  'collectathon-platformer',
  'top-down-adventure',
  'twin-stick-shooter',
  'dungeon-crawler',
  'boss-rush',
  'bullet-hell',
  'gallery-shooter',
  'run-and-gun',
  'top-down-racer',
  'time-trial-racer',
  'sokoban',
  'tower-defense',
  'lane-defense',
  'turn-based-tactics',
  'idle-incremental',
  'exploration-game',
  'point-and-click',
  'physics-toy',
]);

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

function diffLines(a: string, b: string): number {
  const al = a.split('\n');
  const bl = b.split('\n');
  const setB = new Set(bl);
  const setA = new Set(al);
  let n = 0;
  for (const line of al) if (!setB.has(line)) n++;
  for (const line of bl) if (!setA.has(line)) n++;
  return n;
}

function isCanonical(presetId: string): boolean {
  if (HAND_AUTHORED_PROOFS.has(presetId)) return false;
  const dir = path.join(PROOFS_ROOT, presetId);
  if (!existsSync(dir)) return false;
  const shell = path.join(dir, 'src/game-specific/shellPack.ts');
  if (!existsSync(shell)) return false;
  const shellText = readFileSync(shell, 'utf8');
  let closest = Number.POSITIVE_INFINITY;
  for (const template of readdirSync(TEMPLATES_ROOT)) {
    closest = Math.min(closest, diffLines(shellText, readFileSync(path.join(TEMPLATES_ROOT, template), 'utf8')));
  }
  return closest < 120;
}

export function refreshCanonicalProofs(options: { readonly check: boolean }): { refreshed: string[]; drifted: string[]; skipped: string[] } {
  const refreshed: string[] = [];
  const drifted: string[] = [];
  const skipped: string[] = [];
  for (const preset of PRESETS) {
    if (!isCanonical(preset.id)) {
      skipped.push(preset.id);
      continue;
    }
    const dir = path.join(PROOFS_ROOT, preset.id);
    const files = buildGameFiles(`proof-${preset.id}`, preset);
    let changed = false;
    for (const [relativePath, content] of files) {
      const full = path.join(dir, relativePath);
      const current = existsSync(full) ? readFileSync(full, 'utf8') : null;
      if (current === content) continue;
      changed = true;
      if (!options.check) {
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, content);
      }
    }
    // Files the factory no longer emits but a canonical proof still carries
    // (e.g. a removed content document) are stale.
    const onDisk = walk(dir).filter((f) => f !== 'PROOF_CONTRACT.md');
    for (const stale of onDisk.filter((f) => !files.has(f))) {
      drifted.push(`${preset.id}: stale file ${stale}`);
    }
    if (changed) (options.check ? drifted : refreshed).push(preset.id);
  }
  return { refreshed, drifted, skipped };
}

function main(): number {
  const check = process.argv.includes('--check');
  const { refreshed, drifted, skipped } = refreshCanonicalProofs({ check });
  console.log(`canonical proofs: ${PRESETS.length - skipped.length}; hand-authored (kept): ${skipped.length}`);
  if (check) {
    if (drifted.length > 0) {
      console.log(`DRIFT: ${drifted.join(', ')}`);
      return 1;
    }
    console.log('No canonical proof drifts from the factory.');
    return 0;
  }
  console.log(refreshed.length > 0 ? `refreshed: ${refreshed.join(', ')}` : 'nothing to refresh');
  if (drifted.length > 0) console.log(`stale files (remove by hand): ${drifted.join(', ')}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
