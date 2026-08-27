import { describe, expect, it } from 'vitest';
import { OverlayContainmentError, OVERLAY_ROOTS, assertOverlayContained } from '../../packages/cli/src/factory.ts';
import { getPreset, listPresets } from '../../packages/presets/src/index.ts';
import { allStarterKits, everyOverlayPath, starterKitDepthFor, starterKitFor } from '../server/starterKits/index.ts';

const PROOF_PRESETS = ['chase-platformer', 'twin-stick-shooter', 'tower-defense', 'sokoban', 'idle-incremental'] as const;
const VERIFIED_RICH_STARTERS = [
  'traditional-platformer',
  'metroidvania',
  'bullet-hell',
  'stealth-game',
  'top-down-racer',
  'turn-based-tactics',
  'visual-novel',
  'time-trial-racer',
  'reaction-timing',
  'shopkeeper',
  'tycoon-lite',
  'auto-runner',
  'puzzle-platformer',
  'top-down-adventure',
  'action-adventure',
  'arena-combat',
  'base-defense',
  'breakout',
  'collectathon-platformer',
  'dungeon-crawler',
  'endless-runner',
] as const;

describe('overlay containment', () => {
  it('accepts every path the shipped starter kits actually write', () => {
    expect(() => assertOverlayContained(everyOverlayPath())).not.toThrow();
  });

  it('refuses an overlay that would edit the machine rather than the game', () => {
    for (const bad of [
      'packages/runtime/src/index.ts',
      'vite.config.ts',
      'package.json',
      '../outside.ts',
      'src/main.ts',
      '/etc/passwd',
      'content/../../escape.ts',
    ]) {
      expect(() => assertOverlayContained([bad])).toThrow(OverlayContainmentError);
    }
  });

  it('names every offending path at once, not just the first', () => {
    try {
      assertOverlayContained(['packages/runtime/x.ts', 'vite.config.ts', 'content/ok.json']);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(OverlayContainmentError);
      const offending = (error as OverlayContainmentError).offendingPaths;
      expect(offending).toEqual(['packages/runtime/x.ts', 'vite.config.ts']);
    }
  });

  it('allows exactly the normal-game surfaces and no others', () => {
    expect([...OVERLAY_ROOTS]).toEqual(['content/', 'themes/', 'public/', 'resources/', 'src/game-specific/']);
  });
});

describe('starter kit registry', () => {
  it('has a rich proof kit for every proof-validated preset (W17)', () => {
    const proofValidated = listPresets()
      .filter((preset) => preset.maturity === 'proof-validated')
      .map((preset) => preset.id)
      .sort();
    expect(proofValidated).toEqual([...PROOF_PRESETS].sort());
    for (const presetId of proofValidated) {
      const kit = starterKitFor(presetId);
      expect(kit, `no starter kit for ${presetId}`).toBeDefined();
      expect(kit!.depth).toBe('rich-proof-kit');
    }
  });

  it('ships every candidate that earned rich starter evidence', () => {
    for (const presetId of VERIFIED_RICH_STARTERS) {
      expect(starterKitFor(presetId)?.depth, presetId).toBe('rich-starter-kit');
    }
  });

  it('keeps registry ids unique and keeps kit depth honest about preset maturity', () => {
    const ids = allStarterKits().map((kit) => kit.presetId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const kit of allStarterKits()) {
      const preset = getPreset(kit.presetId);
      expect(kit.depth).toBe(preset.maturity === 'proof-validated' ? 'rich-proof-kit' : 'rich-starter-kit');
    }
  });

  it('reports depth honestly for registered and unregistered presets (F15)', () => {
    expect(starterKitDepthFor('idle-clicker', 'recipe')).toBe('generated-shell');
    expect(starterKitDepthFor('unregistered-smoke-example', 'smoke-validated')).toBe('smoke-kit');
    expect(starterKitDepthFor('traditional-platformer', 'smoke-validated')).toBe('rich-starter-kit');
    expect(starterKitDepthFor('chase-platformer', 'proof-validated')).toBe('rich-proof-kit');
  });

  it('every kit describes a real loop and the roles it actually draws', () => {
    for (const kit of allStarterKits()) {
      expect(kit.loop.length).toBeGreaterThan(30);
      expect(kit.usefulRoles).toContain('player');
      expect(kit.usefulRoles.length).toBeGreaterThan(1);
    }
  });

  it('every kit names a preset that really exists in the catalogue', () => {
    for (const kit of allStarterKits()) expect(() => getPreset(kit.presetId)).not.toThrow();
  });
});

describe('starter kit output', () => {
  it('writes a shell, a presentation module, a manifest, a level and tuning for every kit', () => {
    for (const kit of allStarterKits()) {
      const files = kit.overlay('demo-game', 'Demo Game');
      expect(files.has('src/game-specific/shellPack.ts')).toBe(true);
      expect(files.has('src/game-specific/presentation.ts')).toBe(true);
      expect(files.has('content/game.json')).toBe(true);
      expect(files.has('content/levels/main.json')).toBe(true);
      expect(files.has('content/tuning.json')).toBe(true);
    }
  });

  it('never copies a shared runtime package into the game', () => {
    for (const kit of allStarterKits()) {
      for (const [path, contents] of kit.overlay('demo-game', 'Demo Game')) {
        expect(path.startsWith('packages/')).toBe(false);
        expect(contents.includes('from \'../../../packages/')).toBe(false);
      }
    }
  });

  it('resolves art through semantic roles, never a file name', () => {
    for (const kit of allStarterKits()) {
      const shell = kit.overlay('demo-game', 'Demo Game').get('src/game-specific/shellPack.ts')!;
      expect(shell, kit.presetId).toContain("context.assets.resolve('player')");
      expect(shell).not.toMatch(/assets\/workbench\//);
      expect(shell).not.toMatch(/\.png['"]/);
    }
  });

  it('guards the optional background role instead of assuming it exists', () => {
    for (const kit of allStarterKits()) {
      const shell = kit.overlay('demo-game', 'Demo Game').get('src/game-specific/shellPack.ts')!;
      expect(shell).toContain("context.assets.has('background')");
    }
  });

  it('writes tuning values the content schema will accept', () => {
    for (const kit of allStarterKits()) {
      const tuning = JSON.parse(kit.overlay('demo-game', 'Demo Game').get('content/tuning.json')!) as {
        player: Record<string, number>;
      };
      for (const [field, value] of Object.entries(tuning.player)) {
        expect(value, `${kit.presetId} tuning.player.${field}`).toBeGreaterThan(0);
      }
    }
  });

  it('declares the game id and display name it was asked for', () => {
    for (const kit of allStarterKits()) {
      const manifest = JSON.parse(kit.overlay('my-game', 'My Game').get('content/game.json')!) as { id: string; displayName: string };
      expect(manifest.id).toBe('my-game');
      expect(manifest.displayName).toBe('My Game');
    }
  });

  it('declares the game-specific shell pack its own shell defines', () => {
    for (const kit of allStarterKits()) {
      const files = kit.overlay('demo-game', 'Demo Game');
      const manifest = JSON.parse(files.get('content/game.json')!) as { systemPacks: { packId: string }[] };
      const shell = files.get('src/game-specific/shellPack.ts')!;
      const declaredShellPack = manifest.systemPacks.map((s) => s.packId).find((id) => id.startsWith('game.'));
      expect(declaredShellPack).toBeDefined();
      expect(shell).toContain(`id: '${declaredShellPack}'`);
    }
  });

  it('produces the same files for the same inputs', () => {
    for (const kit of allStarterKits()) {
      const first = kit.overlay('demo-game', 'Demo Game');
      const second = kit.overlay('demo-game', 'Demo Game');
      expect([...first.keys()].sort()).toEqual([...second.keys()].sort());
      for (const [key, value] of first) expect(second.get(key)).toBe(value);
    }
  });
});
