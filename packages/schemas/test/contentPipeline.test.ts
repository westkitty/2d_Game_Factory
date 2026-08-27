import { describe, expect, it } from 'vitest';
import type { AssetDescriptor, NormalizedLevel, ThemeManifest, UiCopy } from '@sw2d/contracts';
import { schemaDocumentFor, validateDocument } from '../src/validator.ts';

/**
 * Schema/type parity for Phase 6's five new schemas, following the same
 * `satisfies`-fixture pattern as parity.test.ts (see that file's own
 * residual-limitation note - this proves field-name-set parity and that a
 * correctly-typed fixture validates, not every individual type constraint).
 */

function propertyKeys(schemaName: Parameters<typeof schemaDocumentFor>[0]): string[] {
  const schema = schemaDocumentFor(schemaName) as { properties?: Record<string, unknown> };
  return Object.keys(schema.properties ?? {}).sort();
}

describe('content-assets / asset-descriptor', () => {
  const fixture: readonly AssetDescriptor[] = [
    { role: 'player', key: 'demo/player', spec: { kind: 'generated', width: 8, height: 8, fill: '#fff' } },
    { role: 'exit', key: 'demo/exit', spec: { kind: 'image', url: 'exit.png' } },
  ];

  it('AssetDescriptor schema keys match the AssetDescriptor interface', () => {
    expect(propertyKeys('asset-descriptor')).toEqual(['key', 'role', 'spec']);
    expect(Object.keys(fixture[0]!).sort()).toEqual(['key', 'role', 'spec']);
  });

  it('validates a mix of generated and image asset specs', () => {
    expect(validateDocument('content-assets', 'fixture', fixture).valid).toBe(true);
  });

  it('rejects an unknown asset role', () => {
    const malformed = [{ role: 'not-a-role', key: 'x', spec: { kind: 'generated', width: 1, height: 1, fill: '#fff' } }];
    expect(validateDocument('content-assets', 'fixture', malformed).valid).toBe(false);
  });

  it('rejects a generated spec missing "fill"', () => {
    const malformed = [{ role: 'player', key: 'x', spec: { kind: 'generated', width: 1, height: 1 } }];
    expect(validateDocument('content-assets', 'fixture', malformed).valid).toBe(false);
  });
});

describe('ui-copy', () => {
  const fixture: UiCopy = {
    title: 'T',
    subtitle: 'S',
    startPrompt: 'P',
    playHint: 'H',
    pausedHeading: 'PH',
    pausedResume: 'PR',
    pausedRestart: 'PT',
    pausedQuit: 'PQ',
  };

  it('UiCopy schema keys match the UiCopy interface', () => {
    expect(propertyKeys('ui-copy')).toEqual(Object.keys(fixture).sort());
  });

  it('a partial override validates', () => {
    expect(validateDocument('ui-copy', 'fixture', { title: 'Only Title' }).valid).toBe(true);
  });

  it('rejects a non-string field', () => {
    expect(validateDocument('ui-copy', 'fixture', { title: 123 }).valid).toBe(false);
  });
});

describe('theme-manifest', () => {
  const fixture: ThemeManifest = {
    schemaVersion: 1,
    id: 'demo',
    displayName: 'Demo',
    assets: [{ role: 'player', key: 'demo/player', spec: { kind: 'generated', width: 8, height: 8, fill: '#fff' } }],
    tokens: { background: '#000', panel: '#111', panelActive: '#222', text: '#fff', accent: '#0f0', border: '#333' },
    fonts: { ui: 'monospace' },
  };

  it('ThemeManifest schema keys match the ThemeManifest interface', () => {
    expect(propertyKeys('theme-manifest')).toEqual(
      [...Object.keys(fixture), 'animations', 'ui', 'highContrastTokens'].sort(),
    );
  });

  it('validates a minimal theme with no animations/ui/highContrastTokens', () => {
    expect(validateDocument('theme-manifest', 'fixture', fixture).valid).toBe(true);
  });

  it('validates a full theme with animations, ui and highContrastTokens', () => {
    const full: ThemeManifest = {
      ...fixture,
      animations: [
        {
          role: 'player',
          key: 'demo/player/walk',
          frames: [
            { key: 'demo/player/walk/0', url: 'assets/player-0.png' },
            { key: 'demo/player/walk/1', url: 'assets/player-1.png' },
          ],
          frameRate: 8,
          repeat: -1,
        },
      ],
      ui: { title: 'X' },
      highContrastTokens: { text: '#ffffff' },
    };
    expect(validateDocument('theme-manifest', 'fixture', full).valid).toBe(true);
  });

  it('rejects a theme missing a required token', () => {
    const malformed = { ...fixture, tokens: { background: '#000' } };
    expect(validateDocument('theme-manifest', 'fixture', malformed).valid).toBe(false);
  });
});

describe('level-document', () => {
  const fixture: NormalizedLevel = {
    schemaVersion: 1,
    id: 'demo',
    mapWidth: 10,
    mapHeight: 10,
    tileWidth: 32,
    tileHeight: 32,
    tileLayers: [{ name: 'bg', widthInTiles: 10, heightInTiles: 10 }],
    solids: [{ x: 0, y: 0, width: 32, height: 32 }],
    objects: [{ id: 1, class: 'PlayerSpawn', name: '', x: 0, y: 0, width: 0, height: 0, properties: {} }],
  };

  it('NormalizedLevel schema keys match the NormalizedLevel interface', () => {
    expect(propertyKeys('level-document')).toEqual(Object.keys(fixture).sort());
  });

  it('validates a well-formed level document', () => {
    expect(validateDocument('level-document', 'fixture', fixture).valid).toBe(true);
  });

  it('rejects an object with a non-numeric id', () => {
    const malformed = { ...fixture, objects: [{ ...fixture.objects[0], id: 'one' }] };
    expect(validateDocument('level-document', 'fixture', malformed).valid).toBe(false);
  });
});
