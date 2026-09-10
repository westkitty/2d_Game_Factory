import type { PresetDefinition } from '@sw2d/contracts';

/**
 * `src/game-specific/packConfig.ts` - the generated composition root's
 * code-supplied pack config.
 *
 * Most packs are configured as JSON, in `content/game.json`. A pack that
 * declares `configSource: 'code'` cannot be: its config carries functions, and
 * `content/game.json` can only ever hold data. Before Phase 9 the generator
 * serialized `config: {}` for those packs anyway, so all six presets requiring
 * `sw2d.puzzle` produced games that built cleanly and then threw
 * `createInitialState is not a function` the moment the player pressed
 * CONFIRM.
 *
 * The fix is a real seam rather than a removal: this file is generated into
 * `src/game-specific/`, which is normal game work, so the game author edits
 * the puzzle's own rules exactly where every other game-specific mechanic
 * already lives. Category-C Wave 12 ships two working, materially different
 * placeholders (a Matter ball-in-goal and a gated note/key lock) so the two
 * remaining `sw2d.puzzle` recipes enter play as real games, not a 3-move
 * counter. The pack keeps `TState` opaque; this file stays plain TypeScript
 * the author replaces wholesale.
 *
 * Category-C Wave 13 also stamps `SIMULATION_STARTER` here (`farm` /
 * `colony` / null) so the shared ui-simulation shell can present two
 * different `sw2d.simulation` loops without extending that pack into a
 * crop/season or colony-AI monolith. Wave 14 stamps `NARRATIVE_STARTER`
 * (`fiction` / `case` / null) the same way for `sw2d.narrative`. Wave 15
 * stamps `ARCADE_STARTER` (`fishing` / `cooking` / null) for `sw2d.arcade`
 * score/elapsed — not a casting/tension or recipe pack. Wave 16 stamps
 * `POINTER_STARTER` (`draw` / `wardrobe` / null) so the pointer shell can
 * present two ADR-0018 loops without inventing a drawing-canvas or wardrobe
 * pack. Wave 17 stamps `PROGRESSION_STARTER` (`survive` / `run` / null) for
 * `sw2d.progression` XP/currency/unlocks — not difficulty scaling or
 * permadeath. Wave 18 stamps `STRATEGY_STARTER` (`tactics` / `battler` /
 * null) so the grid and ui-simulation shells can present two different
 * `sw2d.strategy` loops without inventing pathfinding, attack-range or
 * autonomous-combat packs.
 *
 * Deliberately NOT a universal puzzle DSL.
 */

const CODE_CONFIGURED_PACK_IDS = new Set(['sw2d.puzzle']);

/** True when this preset selects at least one pack whose config must come from code. */
export function requiresCodePackConfig(preset: PresetDefinition): boolean {
  return preset.requiredSystemPacks.some((selection) => CODE_CONFIGURED_PACK_IDS.has(selection.packId));
}

const PHYSICS_PREAMBLE = `/** Physics-puzzle state: solved when the Matter ball rests in the goal. */
export interface PlaceholderPuzzleState {
  readonly kind: 'physics-goal';
  readonly inGoal: boolean;
}

`;

const PHYSICS_ENTRY = `  /**
   * sw2d.puzzle is code-configured: its config is two functions, so it can
   * never live in content/game.json. The generated pointer shell nudges a
   * Matter ball and calls apply() when it crosses the goal.
   */
  'sw2d.puzzle': {
    createInitialState: (): PlaceholderPuzzleState => ({ kind: 'physics-goal', inGoal: false }),
    isSolved: (state: PlaceholderPuzzleState): boolean => state.inGoal,
  },
`;

const ESCAPE_PREAMBLE = `/** Escape-room state: inspect the note, then the key. */
export interface PlaceholderPuzzleState {
  readonly kind: 'escape-locks';
  readonly note: boolean;
  readonly key: boolean;
}

`;

const ESCAPE_ENTRY = `  /**
   * sw2d.puzzle is code-configured: its config is two functions, so it can
   * never live in content/game.json. The generated pointer shell registers
   * two linked hotspots and calls apply() as they unlock.
   */
  'sw2d.puzzle': {
    createInitialState: (): PlaceholderPuzzleState => ({ kind: 'escape-locks', note: false, key: false }),
    isSolved: (state: PlaceholderPuzzleState): boolean => state.note && state.key,
  },
`;

const FALLBACK_PREAMBLE = `/** Replace with this game's real puzzle state. */
export interface PlaceholderPuzzleState {
  readonly moves: number;
}

const SOLVED_AT_MOVES = 3;

`;

const FALLBACK_ENTRY = `  /**
   * sw2d.puzzle is code-configured: its config is two functions, so it can
   * never live in content/game.json. Replace this placeholder with this
   * game's real puzzle state - the pack keeps the state type opaque, so any
   * shape works as long as createInitialState() and isSolved() agree.
   */
  'sw2d.puzzle': {
    createInitialState: (): PlaceholderPuzzleState => ({ moves: 0 }),
    isSolved: (state: PlaceholderPuzzleState): boolean => state.moves >= SOLVED_AT_MOVES,
  },
`;

/**
 * Byte-identical for every preset that needs no code-configured pack (the
 * overwhelming majority): an empty, documented map. Determinism is preserved -
 * same preset in, same file out.
 */
export function generatePackConfig(preset: PresetDefinition): string {
  const needsPuzzle = requiresCodePackConfig(preset);
  const variant = !needsPuzzle
    ? 'none'
    : preset.id === 'escape-room'
      ? 'escape'
      : preset.id === 'physics-puzzle'
        ? 'physics'
        : 'fallback';
  const preamble = variant === 'physics' ? PHYSICS_PREAMBLE : variant === 'escape' ? ESCAPE_PREAMBLE : variant === 'fallback' ? FALLBACK_PREAMBLE : '';
  const entry =
    variant === 'physics'
      ? PHYSICS_ENTRY
      : variant === 'escape'
        ? ESCAPE_ENTRY
        : variant === 'fallback'
          ? FALLBACK_ENTRY
          : '  // This preset selects no code-configured pack.';
  const simulationStarter =
    preset.id === 'farming-lite' ? "'farm'" : preset.id === 'colony-lite' ? "'colony'" : 'null';
  const narrativeStarter =
    preset.id === 'interactive-fiction-hybrid' ? "'fiction'" : preset.id === 'investigation-game' ? "'case'" : 'null';
  const arcadeStarter =
    preset.id === 'fishing-game' ? "'fishing'" : preset.id === 'cooking-game' ? "'cooking'" : 'null';
  const pointerStarter =
    preset.id === 'drawing-game' ? "'draw'" : preset.id === 'dress-up-character-toy' ? "'wardrobe'" : 'null';
  const progressionStarter =
    preset.id === 'survivor-like' ? "'survive'" : preset.id === 'action-roguelite' ? "'run'" : 'null';
  const strategyStarter =
    preset.id === 'turn-based-tactics' ? "'tactics'" : preset.id === 'auto-battler' ? "'battler'" : 'null';
  return [
    '/**',
    " * Config for packs that declare `configSource: 'code'` in their definition -",
    ' * config carrying functions, which content/game.json cannot express.',
    ' *',
    ' * Passed to createGame({ packConfig }) by src/main.ts. Packs configured as',
    ' * JSON stay in content/game.json; nothing here overrides those.',
    ' */',
    '',
    preamble ? preamble.trimEnd() + '\n' : '',
    'export const PACK_CONFIG: Readonly<Record<string, unknown>> = {',
    entry.trimEnd(),
    '};',
    '',
    '/** Category-C Wave 13: farm vs colony presentation of sw2d.simulation. Null otherwise. */',
    `export const SIMULATION_STARTER: 'farm' | 'colony' | null = ${simulationStarter};`,
    '',
    '/** Category-C Wave 14: fiction vs case presentation of sw2d.narrative. Null otherwise. */',
    `export const NARRATIVE_STARTER: 'fiction' | 'case' | null = ${narrativeStarter};`,
    '',
    '/** Category-C Wave 15: fishing vs cooking presentation of sw2d.arcade. Null otherwise. */',
    `export const ARCADE_STARTER: 'fishing' | 'cooking' | null = ${arcadeStarter};`,
    '',
    '/** Category-C Wave 16: draw vs wardrobe presentation of ADR-0018 interaction. Null otherwise. */',
    `export const POINTER_STARTER: 'draw' | 'wardrobe' | null = ${pointerStarter};`,
    '',
    '/** Category-C Wave 17: survive vs run presentation of sw2d.progression. Null otherwise. */',
    `export const PROGRESSION_STARTER: 'survive' | 'run' | null = ${progressionStarter};`,
    '',
    '/** Category-C Wave 18: tactics vs battler presentation of sw2d.strategy. Null otherwise. */',
    `export const STRATEGY_STARTER: 'tactics' | 'battler' | null = ${strategyStarter};`,
    '',
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');
}
