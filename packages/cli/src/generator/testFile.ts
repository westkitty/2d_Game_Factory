/**
 * The generated per-game regression test (MASTER_PROJECT.md section 8's
 * "preset-appropriate starter test"). Deliberately Node-safe - no Phaser
 * import - mirroring starter/test/content.test.ts's own disclosure of why:
 * this suite runs in plain Node (see the root vitest.config.ts), and the
 * game-specific pack (which does import Phaser) is exercised by the build +
 * browser smoke instead.
 */
export function generateContentTest(): string {
  return `import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
describe('generated game content', () => {
  it('content/game.json validates against the GameDefinition schema', () => {
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', gameData)).not.toThrow();
  });

  it('content/themes/default/theme.json validates against the theme-manifest schema', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'content/themes/default/theme.json', themeData)).not.toThrow();
  });

  it('content/levels/main.json normalizes and validates as a level document', () => {
    const level = normalizeTiledMap('main', rawLevel);
    expect(() => validateContentBundleData({ tuning: tuningData, 'levels/main': level })).not.toThrow();
  });

  it('rejects a malformed tuning document with a located error', () => {
    const malformed = { ...tuningData, player: { ...tuningData.player, jumpVelocity: 'fast' } };
    expect(() => validateContentBundleData({ tuning: malformed })).toThrow();
  });
});
`;
}
