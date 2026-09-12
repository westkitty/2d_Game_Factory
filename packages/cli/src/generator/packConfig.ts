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
 * autonomous-combat packs. Wave 19 stamps `NAV_STARTER` (`maze` / `lane` /
 * null) so the grid shell can present two different `sw2d.navigation` loops
 * without inventing fog-of-war, spawn-scheduling or combat packs. Wave 20
 * stamps `TOY_STARTER` (`photo` / `sandbox` / null) so the top-down and
 * pointer shells can present two different ADR-0018 loops without inventing
 * a camera/framing pack or a generalized authoring sandbox. Wave 21 stamps
 * `COMBAT_STARTER` (`room` / `hold` / null) so the top-down shell can present
 * two different `sw2d.combat` loops without inventing targeting, AI or
 * encounter packs. Wave 22 stamps `RUN_STARTER` (`course` / `endless` / null)
 * so the platform shell can present two different auto-run loops without
 * inventing a climbing, chase, or scrolling-stage pack. Wave 28 extends
 * `ARCADE_STARTER` with `'micro'` (tap-then-mash rounds on the existing
 * arcade ledger — not a scheduler pack). Wave 29 stamps `KART_STARTER`
 * (`item` / null) for game-specific on-demand kart item-fire. Wave 31 stamps
 * `CHASE_STARTER` (`pursuit` / null) for closing-wall pursuit on
 * chase-platformer — not a reusable chase pack.
 *
 * Deliberately NOT a universal puzzle DSL.
 */

const CODE_CONFIGURED_PACK_IDS = new Set(['sw2d.puzzle']);

/** True when this preset selects at least one pack whose config must come from code. */
export function requiresCodePackConfig(preset: PresetDefinition): boolean {
  return preset.requiredSystemPacks.some((selection) => CODE_CONFIGURED_PACK_IDS.has(selection.packId));
}

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
  const variant = needsPuzzle ? 'fallback' : 'none';
  const preamble = variant === 'fallback' ? FALLBACK_PREAMBLE : '';
  const entry = variant === 'fallback' ? FALLBACK_ENTRY : '  // This preset selects no code-configured pack.';
  const simulationStarter =
    preset.id === 'idle-incremental'
      ? "'idle'"
      : preset.id === 'farming-lite'
        ? "'farm'"
        : preset.id === 'colony-lite'
          ? "'colony'"
          : 'null';
  const narrativeStarter =
    preset.id === 'interactive-fiction-hybrid' ? "'fiction'" : preset.id === 'investigation-game' ? "'case'" : 'null';
  const arcadeStarter =
    preset.id === 'fishing-game'
      ? "'fishing'"
      : preset.id === 'cooking-game'
        ? "'cooking'"
        : preset.id === 'microgame-collection'
          ? "'micro'"
          : 'null';
  const pointerStarter =
    preset.id === 'drawing-game' ? "'draw'" : preset.id === 'dress-up-character-toy' ? "'wardrobe'" : 'null';
  const progressionStarter = preset.id === 'survivor-like' ? "'survive'" : 'null';
  const strategyStarter =
    preset.id === 'turn-based-tactics' ? "'tactics'" : preset.id === 'auto-battler' ? "'battler'" : 'null';
  const navStarter = preset.id === 'maze-game' ? "'maze'" : preset.id === 'lane-defense' ? "'lane'" : 'null';
  const toyStarter =
    preset.id === 'photography-game' ? "'photo'" : preset.id === 'sandbox-playground' ? "'sandbox'" : 'null';
  const combatStarter = preset.id === 'base-defense' ? "'hold'" : 'null';
  const dungeonStarter =
    preset.id === 'dungeon-crawler' ? "'crawl'" : preset.id === 'action-roguelite' ? "'rogue'" : 'null';
  const runStarter =
    preset.id === 'auto-runner' ? "'course'" : preset.id === 'endless-runner' ? "'endless'" : 'null';
  const vehicleStarter =
    preset.id === 'endless-driving' ? "'road'" : preset.id === 'boat-flight-racer' ? "'craft'" : 'null';
  const physicsStarter =
    preset.id === 'physics-toy' ? "'toy'" : preset.id === 'pinball-lite' ? "'table'" : 'null';
  const commandStarter =
    preset.id === 'simple-rts' ? "'rts'" : preset.id === 'territory-control' ? "'zone'" : 'null';
  const lookStarter = preset.id === 'museum-exhibit' ? "'museum'" : 'null';
  const galleryStarter = preset.id === 'gallery-shooter' ? "'gallery'" : preset.id === 'rail-shooter' ? "'rail'" : 'null';
  const asteroidsStarter = preset.id === 'asteroids-shooter' ? "'field'" : 'null';
  const parkourStarter =
    preset.id === 'precision-platformer' ? "'precision'" : preset.id === 'climbing-game' ? "'climb'" : 'null';
  const kartStarter = preset.id === 'kart-racer' || preset.id === 'endless-driving' ? "'item'" : 'null';
  const chaseStarter = preset.id === 'chase-platformer' ? "'pursuit'" : 'null';
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
    `export const SIMULATION_STARTER: 'idle' | 'farm' | 'colony' | null = ${simulationStarter};`,
    '',
    '/** Category-C Wave 14: fiction vs case presentation of sw2d.narrative. Null otherwise. */',
    `export const NARRATIVE_STARTER: 'fiction' | 'case' | null = ${narrativeStarter};`,
    '',
    '/** Category-C Wave 15/28: fishing vs cooking vs micro presentation of sw2d.arcade. Null otherwise. */',
    `export const ARCADE_STARTER: 'fishing' | 'cooking' | 'micro' | null = ${arcadeStarter};`,
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
    '/** Category-C Wave 19: maze vs lane presentation of sw2d.navigation. Null otherwise. */',
    `export const NAV_STARTER: 'maze' | 'lane' | null = ${navStarter};`,
    '',
    '/** Category-C Wave 20: photo vs sandbox presentation of ADR-0018 interaction. Null otherwise. */',
    `export const TOY_STARTER: 'photo' | 'sandbox' | null = ${toyStarter};`,
    '',
    '/** Category-C Wave 21: room vs hold presentation of sw2d.combat. Null otherwise. */',
    `export const COMBAT_STARTER: 'room' | 'hold' | null = ${combatStarter};`,
    '',
    '/** Category-C Wave 22: course vs endless presentation of auto-run. Null otherwise. */',
    `export const RUN_STARTER: 'course' | 'endless' | null = ${runStarter};`,
    '',
    '/** Category-C Wave 23: road vs craft presentation of vehicle.motion. Null otherwise. */',
    `export const VEHICLE_STARTER: 'road' | 'craft' | null = ${vehicleStarter};`,
    '',
    '/** Category-C Wave 24: toy vs table presentation of AdvancedPhysics. Null otherwise. */',
    `export const PHYSICS_STARTER: 'toy' | 'table' | null = ${physicsStarter};`,
    '',
    '/** Category-C Wave 25: rts vs zone command/occupy. Null otherwise. */',
    `export const COMMAND_STARTER: 'rts' | 'zone' | null = ${commandStarter};`,
    '',
    '/** Category-C Wave 26: museum vs rail look/damage. Null otherwise. */',
    `export const LOOK_STARTER: 'museum' | 'rail' | null = ${lookStarter};`,
    '',
    '/** Category-C Wave 27: precision vs climb parkour. Null otherwise. */',
    `export const PARKOUR_STARTER: 'precision' | 'climb' | null = ${parkourStarter};`,
    '',
    '/** Category-C Wave 29: kart on-demand item-fire. Null otherwise. */',
    `export const KART_STARTER: 'item' | null = ${kartStarter};`,
    '',
    '/** Category-C Wave 31: closing-wall pursuit. Null otherwise. */',
    `export const CHASE_STARTER: 'pursuit' | null = ${chaseStarter};`,
    '',
    '/** Final Product Completion Wave 2: room-graph dungeon (crawl) vs roguelite run (rogue). Null otherwise. */',
    `export const DUNGEON_STARTER: 'crawl' | 'rogue' | null = ${dungeonStarter};`,
    '',
    '/** Final Product Completion Wave 3: pointer target shooter - fixed gallery vs camera rail. Null otherwise. */',
    `export const GALLERY_STARTER: 'gallery' | 'rail' | null = ${galleryStarter};`,
    '',
    '/** Final Product Completion Wave 3: the Asteroids rock field on the vehicle shell. Null otherwise. */',
    `export const ASTEROIDS_STARTER: 'field' | null = ${asteroidsStarter};`,
    '',
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');
}
