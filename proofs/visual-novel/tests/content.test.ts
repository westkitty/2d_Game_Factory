import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { validateDialogueDocument, type DialogueDocument } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import dialogueData from '../content/dialogue.json' with { type: 'json' };
import itemsData from '../content/items.json' with { type: 'json' };

const doc = dialogueData as unknown as DialogueDocument;

describe('generated game content', () => {
  it('content/game.json validates against the GameDefinition schema', () => {
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', gameData)).not.toThrow();
  });

  it('selects the Phase 20 pack the preset requires', () => {
    const packIds = (gameData as { systemPacks: { packId: string }[] }).systemPacks.map((s) => s.packId);
    expect(packIds).toContain('sw2d.dialogue');
    // The effect owners this script actually writes through.
    expect(packIds).toContain('sw2d.narrative');
    expect(packIds).toContain('sw2d.world');
    expect(packIds).toContain('sw2d.items');
    expect(packIds).toContain('sw2d.progression');
  });

  it('content/themes/default/theme.json validates against the theme-manifest schema', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'content/themes/default/theme.json', themeData)).not.toThrow();
  });

  it('content/levels/main.json normalizes and validates as a level document', () => {
    const level = normalizeTiledMap('main', rawLevel);
    expect(() => validateContentBundleData({ tuning: tuningData, 'levels/main': level })).not.toThrow();
  });

  it('content/dialogue.json validates against content-dialogue:v1', () => {
    const result = validateContentBundleData({ dialogue: dialogueData });
    expect(result['dialogue']?.valid).toBe(true);
    expect(result['dialogue']?.schemaId).toBe('urn:sw2d:schema:content-dialogue:v1');
  });

  it('also passes the semantic checks the schema cannot express', () => {
    expect(() => validateDialogueDocument(doc)).not.toThrow();
  });

  it('every line and choice id is distinct from its text', () => {
    // Text is what gets translated and proofread; an id that *is* the text
    // breaks a save the first time a typo is fixed.
    for (const node of doc.nodes) {
      for (const line of node.lines) expect(line.id).not.toBe(line.text);
      for (const choice of node.choices ?? []) expect(choice.id).not.toBe(choice.text);
    }
  });

  it('every id in the document is unique across the whole script', () => {
    const ids = new Set<string>();
    const claim = (id: string): void => {
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    };
    for (const node of doc.nodes) {
      claim(node.id);
      for (const line of node.lines) claim(line.id);
      for (const choice of node.choices ?? []) claim(choice.id);
    }
  });

  it('portraits name asset roles, never file paths', () => {
    for (const character of doc.characters ?? []) {
      for (const role of Object.values(character.portraits ?? {})) {
        expect(role).not.toContain('/');
        expect(role).not.toContain('.');
      }
    }
  });

  it('every item a dialogue effect touches exists in the item catalog', () => {
    const known = new Set((itemsData as { items: { id: string }[] }).items.map((item) => item.id));
    for (const node of doc.nodes) {
      const effects = [...node.lines.flatMap((l) => l.effects ?? []), ...(node.choices ?? []).flatMap((c) => c.effects ?? [])];
      for (const effect of effects) {
        if (effect.kind === 'grant-item' || effect.kind === 'remove-item') expect(known.has(effect.itemId)).toBe(true);
      }
      for (const choice of node.choices ?? []) {
        for (const condition of choice.conditions ?? []) {
          if (condition.kind === 'item-count') expect(known.has(condition.itemId)).toBe(true);
        }
      }
    }
  });

  it('rejects a schema-invalid dialogue document with a located error', () => {
    expect(() => validateContentBundleData({ dialogue: { ...doc, nodes: [] } })).toThrow();
    expect(() =>
      validateContentBundleData({ dialogue: { ...doc, nodes: [{ ...doc.nodes[0]!, whoops: true }] } }),
    ).toThrow();
  });

  it('rejects a dangling target at the semantic gate, which the schema cannot see', () => {
    const dangling = {
      ...doc,
      nodes: doc.nodes.map((node, index) =>
        index === 0 && node.choices
          ? { ...node, choices: [{ ...node.choices[0]!, target: 'nowhere' }, ...node.choices.slice(1)] }
          : node,
      ),
    };
    // 'nowhere' is a well-formed string, so the schema is content.
    expect(() => validateContentBundleData({ dialogue: dangling })).not.toThrow();
    expect(() => validateDialogueDocument(dangling)).toThrow(/points at node "nowhere"/);
  });
});
