/**
 * The starter-kit registry.
 *
 * Starter-kit depth and preset evidence maturity are deliberately separate.
 * The original five proof-validated presets keep `rich-proof-kit`; additional
 * genre-specific starters may be promoted as `rich-starter-kit` without
 * pretending the underlying preset became proof-validated.
 *
 * An unfinished scaffold is never registered here. Expanded kits enter the
 * shipped registry only through `expanded/index.ts` after their focused tests
 * and real generated-game browser proof pass.
 */

import type { StarterKit, StarterKitDepth } from './contracts.ts';
import { chasePlatformerOverlay } from './chasePlatformer.ts';
import { idleIncrementalOverlay, sokobanOverlay, towerDefenseOverlay, twinStickOverlay } from './otherKits.ts';
import { EXPANDED_STARTER_KITS } from './expanded/index.ts';

export type { StarterKit, StarterKitDepth } from './contracts.ts';

const ORIGINAL_KITS: readonly StarterKit[] = [
  {
    presetId: 'chase-platformer',
    depth: 'rich-proof-kit',
    loop: 'Run, jump and double-jump across ledges collecting every coin before the chase pressure catches you, then reach the exit.',
    usefulRoles: ['player', 'background', 'platform', 'pickup', 'hazard', 'enemy', 'checkpoint', 'exit'],
    overlay: chasePlatformerOverlay,
  },
  {
    presetId: 'twin-stick-shooter',
    depth: 'rich-proof-kit',
    loop: 'Move with one hand, aim and fire with the other, and clear two waves of turrets without running out of health.',
    usefulRoles: ['player', 'background', 'enemy', 'pickup'],
    overlay: twinStickOverlay,
  },
  {
    presetId: 'tower-defense',
    depth: 'rich-proof-kit',
    loop: 'Move a grid cursor onto a build pad, spend currency to place and upgrade a tower, and stop three creeps before they reach the end of the route.',
    usefulRoles: ['player', 'background', 'enemy', 'platform', 'pickup', 'checkpoint'],
    overlay: towerDefenseOverlay,
  },
  {
    presetId: 'sokoban',
    depth: 'rich-proof-kit',
    loop: 'Push two crates onto two goal tiles in a walled room, with undo and reset when you box yourself in.',
    usefulRoles: ['player', 'background', 'platform', 'pickup', 'checkpoint'],
    overlay: sokobanOverlay,
  },
  {
    presetId: 'idle-incremental',
    depth: 'rich-proof-kit',
    loop: 'Watch gold accumulate, queue gather jobs for a bonus, buy the rate upgrade, and save your progress.',
    usefulRoles: ['player', 'background'],
    overlay: idleIncrementalOverlay,
  },
];

const KITS: readonly StarterKit[] = Object.freeze([...ORIGINAL_KITS, ...EXPANDED_STARTER_KITS]);
const BY_PRESET: ReadonlyMap<string, StarterKit> = new Map(KITS.map((kit) => [kit.presetId, kit]));

if (BY_PRESET.size !== KITS.length) {
  throw new Error('Starter-kit registry contains duplicate preset ids.');
}

export function starterKitFor(presetId: string): StarterKit | undefined {
  return BY_PRESET.get(presetId);
}

export function starterKitDepthFor(presetId: string, maturity: string): StarterKitDepth {
  const kit = BY_PRESET.get(presetId);
  if (kit) return kit.depth;
  // A smoke-validated preset has a committed demo proving its composition
  // boots and plays, which is a real, smaller claim than a rich starter.
  return maturity === 'smoke-validated' ? 'smoke-kit' : 'generated-shell';
}

export function allStarterKits(): readonly StarterKit[] {
  return KITS;
}

/** Every path any shipped kit writes. */
export function everyOverlayPath(): readonly string[] {
  const paths = new Set<string>();
  for (const kit of KITS) for (const key of kit.overlay('sample-game', 'Sample Game').keys()) paths.add(key);
  return [...paths].sort();
}
