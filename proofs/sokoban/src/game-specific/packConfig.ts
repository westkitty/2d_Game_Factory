/**
 * Config for packs that declare `configSource: 'code'` in their definition -
 * config carrying functions, which content/game.json cannot express.
 *
 * Passed to createGame({ packConfig }) by src/main.ts.
 *
 * As of the capability program's Phase 6 (ADR-0023) this proof selects no
 * code-configured pack: the entire Sokoban ruleset is the validated
 * `content/puzzles.json` document, driven by the reusable `sw2d.puzzle-rules`
 * capability. This map is intentionally empty.
 */
export const PACK_CONFIG: Readonly<Record<string, unknown>> = {};
