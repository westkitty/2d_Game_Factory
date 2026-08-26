/**
 * Config for packs that declare `configSource: 'code'` in their definition -
 * config carrying functions, which content/game.json cannot express.
 *
 * Passed to createGame({ packConfig }) by src/main.ts. Packs configured as
 * JSON stay in content/game.json; nothing here overrides those.
 */

export const PACK_CONFIG: Readonly<Record<string, unknown>> = {
  // This preset selects no code-configured pack.
};
