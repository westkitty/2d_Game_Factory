import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { validateSimulationAgentsDocument, type SimulationAgentsDocument } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import agentsData from '../content/agents.json' with { type: 'json' };

describe('generated game content', () => {
  it('content/game.json validates against the GameDefinition schema', () => {
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', gameData)).not.toThrow();
  });

  it('selects the Phase 18 pack the preset requires', () => {
    const packIds = (gameData as { systemPacks: { packId: string }[] }).systemPacks.map((s) => s.packId);
    expect(packIds).toContain('sw2d.simulation-agents');
  });

  it('content/themes/default/theme.json validates against the theme-manifest schema', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'content/themes/default/theme.json', themeData)).not.toThrow();
  });

  it('content/levels/main.json normalizes and validates as a level document', () => {
    const level = normalizeTiledMap('main', rawLevel);
    expect(() => validateContentBundleData({ tuning: tuningData, 'levels/main': level })).not.toThrow();
  });

  it('content/agents.json validates against content-agents:v1', () => {
    const result = validateContentBundleData({ agents: agentsData });
    expect(result['agents']?.valid).toBe(true);
    expect(result['agents']?.schemaId).toBe('urn:sw2d:schema:content-agents:v1');
  });

  it('also passes the semantic checks the schema cannot express', () => {
    expect(() => validateSimulationAgentsDocument(agentsData as unknown as SimulationAgentsDocument)).not.toThrow();
  });

  it('every need, behaviour and relationship name is authored here, not built in', () => {
    const doc = agentsData as unknown as SimulationAgentsDocument;
    const needIds = new Set(doc.needs.map((need) => need.id));
    const behaviorIds = new Set(doc.behaviors.map((behavior) => behavior.id));
    for (const agent of doc.agents) {
      expect(agent.needs.every((id) => needIds.has(id))).toBe(true);
      expect(agent.behaviors.every((id) => behaviorIds.has(id))).toBe(true);
    }
  });

  it('rejects a schema-invalid agents document with a located error', () => {
    const doc = agentsData as unknown as SimulationAgentsDocument;
    // Shape and enum membership are the schema's job.
    expect(() => validateContentBundleData({ agents: { ...doc, needs: [] } })).toThrow();
    expect(() =>
      validateContentBundleData({ agents: { ...doc, agents: [{ ...doc.agents[0]!, whoops: true }] } }),
    ).toThrow();
  });

  it('rejects a dangling reference at the semantic gate, which the schema cannot see', () => {
    const doc = agentsData as unknown as SimulationAgentsDocument;
    const dangling = { ...doc, agents: [{ ...doc.agents[0]!, needs: ['nope'] }] };
    // The schema is happy - 'nope' is a well-formed string - so this is exactly
    // the class of error the contract's second gate exists for.
    expect(() => validateContentBundleData({ agents: dangling })).not.toThrow();
    expect(() => validateSimulationAgentsDocument(dangling)).toThrow(/unknown need "nope"/);
  });
});
