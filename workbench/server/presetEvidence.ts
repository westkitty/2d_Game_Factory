/**
 * Repository-derived preset evidence (Arena finish program, Wave 3).
 *
 * The preset browser shows two claims per preset: maturity and starter-kit
 * depth. Maturity is a *catalogue assertion*; this module surfaces the
 * *artifacts* that assertion rests on, read from the repository itself at
 * request time:
 *
 *  - `proofGame`   - proofs/<preset-id>/ exists: a committed real-browser
 *    proof game with a frozen PROOF_CONTRACT.md, exercised by `qa:proof`.
 *  - `demoGame`    - demos/<preset-id>/ exists: a committed hand-built demo.
 *
 * Nothing here is hand-maintained, calls an LLM, or touches the network. The
 * directory scan is the same evidence source
 * `packages/presets/test/proofEvidence.test.ts` pins the catalogue against,
 * so the browser can never show evidence the tests do not enforce. The scan
 * result is cached per process: the set of committed proof/demo games only
 * changes with a checkout change, which restarts the host.
 */

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DEMOS_ROOT, PROOFS_ROOT } from './paths.ts';

export interface PresetEvidence {
  readonly proofGame: boolean;
  readonly demoGame: boolean;
}

function scanGameDirs(root: string): ReadonlySet<string> {
  if (!existsSync(root)) return new Set();
  const ids = new Set<string>();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    // Only a directory with a package.json counts - an empty or stray
    // directory is not evidence of anything.
    if (entry.isDirectory() && existsSync(path.join(root, entry.name, 'package.json'))) {
      ids.add(entry.name);
    }
  }
  return ids;
}

let cache: { proofs: ReadonlySet<string>; demos: ReadonlySet<string> } | null = null;

export function presetEvidenceFor(presetId: string): PresetEvidence {
  cache ??= { proofs: scanGameDirs(PROOFS_ROOT), demos: scanGameDirs(DEMOS_ROOT) };
  return {
    proofGame: cache.proofs.has(presetId),
    demoGame: cache.demos.has(presetId),
  };
}

/** Test seam: forget the directory scan so a test can observe fresh state. */
export function resetPresetEvidenceCache(): void {
  cache = null;
}
