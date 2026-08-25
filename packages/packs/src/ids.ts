/**
 * Stable pack and capability ids for every Phase 4 family, in one place so
 * they never drift into scattered string literals. A pack's id and the
 * capability id(s) it provides are deliberately different strings: a pack
 * could in principle be swapped for another implementation providing the
 * same capability.
 */

export const PACK_IDS = {
  combat: 'sw2d.combat',
  ai: 'sw2d.ai',
  world: 'sw2d.world',
  progression: 'sw2d.progression',
  arcade: 'sw2d.arcade',
  puzzle: 'sw2d.puzzle',
  simulation: 'sw2d.simulation',
  narrative: 'sw2d.narrative',
  strategy: 'sw2d.strategy',
} as const;

export const CAPABILITY_IDS = {
  combat: 'combat',
  ai: 'ai',
  world: 'world',
  progression: 'progression',
  arcade: 'arcade',
  puzzle: 'puzzle',
  simulation: 'simulation',
  narrative: 'narrative',
  strategy: 'strategy',
} as const;
