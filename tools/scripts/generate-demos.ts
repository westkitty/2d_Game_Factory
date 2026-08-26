#!/usr/bin/env node
/**
 * Generates the 12 committed representative demos through the exact same
 * generator path `sw2d new` uses (buildGameFiles/writeGameFiles -
 * packages/cli/src/generator/generate.ts) - just targeting `demos/` instead
 * of `games/` (MASTER_PROJECT.md section 11: "Each demo must begin from the
 * same generator path used by `new`. Make that provenance inspectable.").
 *
 * Run once, by hand, when a demo needs regenerating from scratch. Demo-
 * specific game logic (src/game-specific/shellPack.ts overrides, smoke
 * specs) is layered on top afterward and is NOT overwritten by re-running
 * this script against an existing demo directory - it refuses existing
 * targets, same as `new`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getPreset } from '@sw2d/presets';
import { buildGameFiles, writeGameFiles } from '../../packages/cli/src/generator/generate.ts';
import { DEMOS_ROOT } from '../../packages/cli/src/paths.ts';

const DEMO_PRESET_IDS = [
  'traditional-platformer',
  'chase-platformer',
  'metroidvania',
  'twin-stick-shooter',
  'stealth-game',
  'bullet-hell',
  'top-down-racer',
  'sokoban',
  'tower-defense',
  'turn-based-tactics',
  'idle-incremental',
  'visual-novel',
];

for (const presetId of DEMO_PRESET_IDS) {
  const target = path.join(DEMOS_ROOT, presetId);
  if (existsSync(target)) {
    console.log(`skip: demos/${presetId} already exists`);
    continue;
  }
  const files = buildGameFiles(presetId, getPreset(presetId));
  writeGameFiles(files, target);
  console.log(`generated demos/${presetId}`);
}
