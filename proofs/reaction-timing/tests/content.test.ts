import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { validateRhythmDocument, noteTimeMs, type RhythmDocument } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import rhythmData from '../content/rhythm.json' with { type: 'json' };

describe('generated game content', () => {
  it('content/game.json validates against the GameDefinition schema', () => {
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', gameData)).not.toThrow();
  });

  it('selects the Phase 17 pack the preset requires', () => {
    const packIds = (gameData as { systemPacks: { packId: string }[] }).systemPacks.map((s) => s.packId);
    expect(packIds).toContain('sw2d.rhythm');
  });

  it('content/themes/default/theme.json validates against the theme-manifest schema', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'content/themes/default/theme.json', themeData)).not.toThrow();
  });

  it('content/levels/main.json normalizes and validates as a level document', () => {
    const level = normalizeTiledMap('main', rawLevel);
    expect(() => validateContentBundleData({ tuning: tuningData, 'levels/main': level })).not.toThrow();
  });

  it('content/rhythm.json validates against content-rhythm:v1', () => {
    const result = validateContentBundleData({ rhythm: rhythmData });
    expect(result['rhythm']?.valid).toBe(true);
    expect(result['rhythm']?.schemaId).toBe('urn:sw2d:schema:content-rhythm:v1');
  });

  it('also passes the semantic checks the schema cannot express', () => {
    expect(() => validateRhythmDocument(rhythmData as unknown as RhythmDocument)).not.toThrow();
  });

  it('every note resolves to a non-negative chart time', () => {
    const doc = rhythmData as unknown as RhythmDocument;
    for (const chart of doc.charts) {
      for (const note of chart.notes) {
        expect(noteTimeMs(note, chart.bpm, chart.offsetMs)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('rejects a malformed chart with a located error', () => {
    const doc = rhythmData as unknown as RhythmDocument;
    expect(() =>
      validateContentBundleData({
        rhythm: { ...doc, charts: [{ ...doc.charts[0]!, bpm: 0 }] },
      }),
    ).toThrow();
  });
});
