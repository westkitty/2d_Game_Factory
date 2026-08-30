import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import dialogueData from '../content/dialogue.json' with { type: 'json' };
import { validateDialogueDocument, type DialogueDocument } from '@sw2d/contracts';

const dialogueDoc = dialogueData as unknown as DialogueDocument;

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

  // Post-ten Phase 20: the conversation a clicked world object opens.
  it('content/dialogue.json validates against content-dialogue:v1', () => {
    const result = validateContentBundleData({ dialogue: dialogueData });
    expect(result['dialogue']?.valid).toBe(true);
    expect(result['dialogue']?.schemaId).toBe('urn:sw2d:schema:content-dialogue:v1');
  });

  it('also passes the semantic checks the schema cannot express', () => {
    expect(() => validateDialogueDocument(dialogueDoc)).not.toThrow();
  });

  it('selects sw2d.dialogue alongside the Phase 1 packs it already had', () => {
    const packIds = (gameData as { systemPacks: { packId: string }[] }).systemPacks.map((s) => s.packId);
    expect(packIds).toContain('sw2d.world-entities');
    expect(packIds).toContain('sw2d.dialogue');
    // The choice writes a world flag, so world.state has to be installed for
    // the effect to land rather than be skipped.
    expect(packIds).toContain('sw2d.world');
  });

  it('the choice that matters writes through world.state, not the dialogue', () => {
    const effects = dialogueDoc.nodes.flatMap((node) => (node.choices ?? []).flatMap((choice) => choice.effects ?? []));
    expect(effects.some((effect) => effect.kind === 'set-world-flag' && effect.flag === 'chest-blessed')).toBe(true);
  });
});