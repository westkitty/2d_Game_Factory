import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../paths.ts';

/**
 * `sw2d stats` - Show project statistics.
 *
 * Displays counts of games, demos, proofs, and other project artifacts.
 * Useful for understanding the scope of a factory installation.
 */
export async function run(): Promise<number> {
  console.log('SW2D Project Statistics');
  console.log('=======================');
  console.log('');

  // Count generated games
  const gamesDir = join(REPO_ROOT, 'games');
  const gameCount = existsSync(gamesDir) ? countDirectories(gamesDir) : 0;
  console.log(`Generated games: ${gameCount}`);

  // Count demos
  const demosDir = join(REPO_ROOT, 'demos');
  const demoCount = existsSync(demosDir) ? countDirectories(demosDir) : 0;
  console.log(`Demo games:        ${demoCount}`);

  // Count proofs
  const proofsDir = join(REPO_ROOT, 'proofs');
  const proofCount = existsSync(proofsDir) ? countDirectories(proofsDir) : 0;
  console.log(`Proof games:       ${proofCount}`);

  // Count packages
  const packagesDir = join(REPO_ROOT, 'packages');
  const packageCount = existsSync(packagesDir) ? countDirectories(packagesDir) : 0;
  console.log(`Packages:          ${packageCount}`);

  console.log('');
  console.log('Total playable games: ' + (gameCount + demoCount + proofCount));
  console.log('');
  console.log('For preset information: npm run sw2d -- list-presets');

  return 0;
}

function countDirectories(dir: string): number {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith('.'))
      .length;
  } catch {
    return 0;
  }
}
