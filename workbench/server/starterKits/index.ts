/**
 * The starter-kit registry.
 *
 * A generated shell is a proof that composition works; it is not a game. For
 * the five proof-validated presets the workbench overlays a real, playable
 * starting point derived from the corresponding committed proof - a designed
 * level, the packs that starting point actually uses, and a game-specific
 * shell that resolves all of its art through semantic roles so imported
 * assets drive it (section 20, acceptance W17).
 *
 * `depth` is reported honestly everywhere it is shown. A preset with no kit
 * gets `generated-shell` and says so; nothing here dresses a recipe preset up
 * as a proven one (failure condition F15).
 */

import type { GameSeed } from '../../shared/types.ts';
import { chasePlatformerOverlay } from './chasePlatformer.ts';
import { idleIncrementalOverlay, sokobanOverlay, towerDefenseOverlay, twinStickOverlay } from './otherKits.ts';

export type StarterKitDepth = GameSeed['starterKitDepth'];

export interface StarterKit {
  readonly presetId: string;
  readonly depth: StarterKitDepth;
  /** One sentence, present tense, describing what the player actually does. Shown on the Game Seed card. */
  readonly loop: string;
  /** Roles this kit will draw if the project supplies them. Drives the Role Mapper's "this matters for your game" ordering. */
  readonly usefulRoles: readonly string[];
  overlay(gameId: string, displayName: string): ReadonlyMap<string, string>;
}

const KITS: readonly StarterKit[] = [
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

const BY_PRESET: ReadonlyMap<string, StarterKit> = new Map(KITS.map((kit) => [kit.presetId, kit]));

export function starterKitFor(presetId: string): StarterKit | undefined {
  return BY_PRESET.get(presetId);
}

export function starterKitDepthFor(presetId: string, maturity: string): StarterKitDepth {
  const kit = BY_PRESET.get(presetId);
  if (kit) return kit.depth;
  // A smoke-validated preset has a committed demo proving its composition
  // boots and plays, which is a real, smaller claim than a proof kit.
  return maturity === 'smoke-validated' ? 'smoke-kit' : 'generated-shell';
}

export function allStarterKits(): readonly StarterKit[] {
  return KITS;
}

/** Every path any kit writes. A unit test feeds this to `assertOverlayContained`, so an overlay that strays outside normal game surfaces fails before it can ever be written. */
export function everyOverlayPath(): readonly string[] {
  const paths = new Set<string>();
  for (const kit of KITS) for (const key of kit.overlay('sample-game', 'Sample Game').keys()) paths.add(key);
  return [...paths].sort();
}
