import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import climbingData from '../content/climbing.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };

describe('climbing-game proof content', () => {
  it('content/game.json validates against GameDefinition schema', () => {
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', gameData)).not.toThrow();
  });

  it('content/themes/default/theme.json validates against theme-manifest schema', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'content/themes/default/theme.json', themeData)).not.toThrow();
  });

  it('content/climbing.json validates against climbing-config schema', () => {
    expect(() => validateDocumentOrThrow('climbing-config', 'content/climbing.json', climbingData)).not.toThrow();
  });

  it('content/levels/main.json normalizes as a level document', () => {
    const level = normalizeTiledMap('main', rawLevel);
    expect(() => validateContentBundleData({ tuning: tuningData, climbing: climbingData, 'levels/main': level })).not.toThrow();
  });

  it('rejects malformed climbing config with located error', () => {
    const malformed = { ...climbingData, wallSlideMaxSpeed: 'fast' };
    expect(() => validateContentBundleData({ climbing: malformed })).toThrow();
  });
});
