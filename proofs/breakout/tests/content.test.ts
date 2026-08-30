import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { validateBallPaddleDocument, type BallPaddleDocument } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import ballPaddleData from '../content/ball-paddle.json' with { type: 'json' };

describe('generated game content', () => {
  it('content/game.json validates against the GameDefinition schema', () => {
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', gameData)).not.toThrow();
  });

  it('selects the Phase 16 pack the preset requires', () => {
    const packIds = (gameData as { systemPacks: { packId: string }[] }).systemPacks.map((s) => s.packId);
    expect(packIds).toContain('sw2d.ball-paddle');
  });

  it('content/themes/default/theme.json validates against the theme-manifest schema', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'content/themes/default/theme.json', themeData)).not.toThrow();
  });

  it('content/levels/main.json normalizes and validates as a level document', () => {
    const level = normalizeTiledMap('main', rawLevel);
    expect(() => validateContentBundleData({ tuning: tuningData, 'levels/main': level })).not.toThrow();
  });

  it('content/ball-paddle.json validates against content-ball-paddle:v1', () => {
    const result = validateContentBundleData({ 'ball-paddle': ballPaddleData });
    expect(result['ball-paddle']?.valid).toBe(true);
    expect(result['ball-paddle']?.schemaId).toBe('urn:sw2d:schema:content-ball-paddle:v1');
  });

  it('also passes the semantic checks the schema cannot express', () => {
    expect(() => validateBallPaddleDocument(ballPaddleData as unknown as BallPaddleDocument)).not.toThrow();
  });

  it('authors the whole game as content: 15 bricks, a loss edge and lives', () => {
    const doc = ballPaddleData as unknown as BallPaddleDocument;
    expect(doc.layout).toHaveLength(15);
    expect(doc.arena.edges.some((edge) => edge.behavior === 'loss')).toBe(true);
    expect(doc.match?.lives).toBe(3);
    // Every placement references a real brick, and the tough row drops a
    // canonical Phase-2 item id rather than an invented one.
    const brickIds = new Set((doc.bricks ?? []).map((brick) => brick.id));
    expect(doc.layout!.every((placement) => brickIds.has(placement.brickId))).toBe(true);
    expect((doc.bricks ?? []).find((brick) => brick.id === 'tough')?.itemDropId).toBe('coin-1');
  });

  it('rejects a malformed ball/paddle document with a located error', () => {
    expect(() =>
      validateContentBundleData({
        'ball-paddle': { ...ballPaddleData, ball: { ...ballPaddleData.ball, maximumBounceAngleDegrees: 89 } },
      }),
    ).toThrow();
  });
});
