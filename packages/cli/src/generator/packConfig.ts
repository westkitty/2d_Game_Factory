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
 * already lives. The generated default is a genuinely working placeholder
 * puzzle (a tiny deterministic counter that is "solved" at a target value) -
 * small enough that nobody mistakes it for a designed puzzle, real enough that
 * the generated game actually enters play with `sw2d.puzzle` installed.
 *
 * Deliberately NOT a universal puzzle DSL: the pack keeps `TState` opaque, and
 * this file stays plain TypeScript the author replaces wholesale.
 */

const CODE_CONFIGURED_PACK_IDS = new Set(['sw2d.puzzle']);

/** True when this preset selects at least one pack whose config must come from code. */
export function requiresCodePackConfig(preset: PresetDefinition): boolean {
  return preset.requiredSystemPacks.some((selection) => CODE_CONFIGURED_PACK_IDS.has(selection.packId));
}

const PUZZLE_ENTRY = `  /**
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

const PUZZLE_PREAMBLE = `/** Replace with this game's real puzzle state. */
export interface PlaceholderPuzzleState {
  readonly moves: number;
}

const SOLVED_AT_MOVES = 3;

`;

/**
 * Byte-identical for every preset that needs no code-configured pack (the
 * overwhelming majority): an empty, documented map. Determinism is preserved -
 * same preset in, same file out.
 */
export function generatePackConfig(preset: PresetDefinition): string {
  const needsPuzzle = requiresCodePackConfig(preset);
  return [
    '/**',
    " * Config for packs that declare `configSource: 'code'` in their definition -",
    ' * config carrying functions, which content/game.json cannot express.',
    ' *',
    ' * Passed to createGame({ packConfig }) by src/main.ts. Packs configured as',
    ' * JSON stay in content/game.json; nothing here overrides those.',
    ' */',
    '',
    needsPuzzle ? PUZZLE_PREAMBLE.trimEnd() + '\n' : '',
    'export const PACK_CONFIG: Readonly<Record<string, unknown>> = {',
    needsPuzzle ? PUZZLE_ENTRY.trimEnd() : '  // This preset selects no code-configured pack.',
    '};',
    '',
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');
}
