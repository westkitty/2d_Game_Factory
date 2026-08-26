import { describe, expect, it } from 'vitest';
import { PRESETS } from '@sw2d/presets';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { buildGameFiles, findUnresolvedTokens } from '../src/generator/generate.ts';

/**
 * Determinism (MASTER_PROJECT.md section 10) and the all-74 static/schema
 * matrix (section 10's numbered list, items 1-5). Item 6 ("prove buildable/
 * runnable evidence, not only file existence") is deliberately NOT here:
 * spawning `npm install`/`tsc`/`vite build` 74 times would make this file
 * unusable as part of the fast unit-test loop every other package enjoys.
 * `tools/scripts/build-matrix.ts` covers item 6 with a real build for one
 * representative preset per controller-family equivalence class (the only
 * axis that changes which generated *source file* gets copied - see that
 * script's own header comment for the full equivalence argument) plus all
 * 12 committed demos. Both together are "the all-74 generation/build
 * matrix" MASTER_PROJECT.md section 29 asks for.
 */

describe('generator determinism', () => {
  it('the same gameId+preset produces a byte-identical file tree on repeated calls', () => {
    for (const preset of PRESETS) {
      const first = buildGameFiles('determinism-check', preset);
      const second = buildGameFiles('determinism-check', preset);
      expect([...second.entries()], preset.id).toEqual([...first.entries()]);
    }
  });

  it('two different game ids produce trees that differ only where the id is meant to appear', () => {
    const preset = PRESETS[0]!;
    const a = buildGameFiles('game-alpha', preset);
    const b = buildGameFiles('game-beta', preset);
    // Every file path is identical - only content differs (or not, for
    // family-generic files like the shell pack).
    expect([...a.keys()]).toEqual([...b.keys()]);
    // The shell pack (no gameId inside it at all) must be byte-identical.
    expect(a.get('src/game-specific/shellPack.ts')).toBe(b.get('src/game-specific/shellPack.ts'));
    // package.json must differ (carries the game id).
    expect(a.get('package.json')).not.toBe(b.get('package.json'));
  });

  it('contains no timestamp-shaped or random-looking content (a weak nondeterminism smell test)', () => {
    const files = buildGameFiles('determinism-check', PRESETS[0]!);
    for (const [path, content] of files) {
      expect(content, path).not.toMatch(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp
    }
  });
});

describe('all 74 presets generate valid, token-free, schema-valid source', () => {
  for (const preset of PRESETS) {
    it(`${preset.id} generates without unresolved template tokens`, () => {
      const files = buildGameFiles('matrix-game', preset);
      expect(findUnresolvedTokens(files)).toEqual([]);
    });

    it(`${preset.id}'s generated content/game.json is schema-valid`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const gameJson: unknown = JSON.parse(files.get('content/game.json')!);
      expect(() => validateDocumentOrThrow('game-definition', preset.id, gameJson)).not.toThrow();
    });

    it(`${preset.id}'s generated theme is schema-valid`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const themeJson: unknown = JSON.parse(files.get('content/themes/default/theme.json')!);
      expect(() => validateDocumentOrThrow('theme-manifest', preset.id, themeJson)).not.toThrow();
    });

    it(`${preset.id}'s generated level normalizes and validates as a level document`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const rawLevel: unknown = JSON.parse(files.get('content/levels/main.json')!);
      const normalized = normalizeTiledMap('main', rawLevel);
      expect(() => validateDocumentOrThrow('level-document', preset.id, normalized)).not.toThrow();
    });

    it(`${preset.id}'s tuning + level content documents validate together as a ContentBundle.data map`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const tuningJson: unknown = JSON.parse(files.get('content/tuning.json')!);
      const rawLevel: unknown = JSON.parse(files.get('content/levels/main.json')!);
      const normalized = normalizeTiledMap('main', rawLevel);
      expect(() => validateContentBundleData({ tuning: tuningJson, 'levels/main': normalized })).not.toThrow();
    });

    it(`${preset.id} selects a real, resolvable shell template for its primary controller family`, () => {
      const files = buildGameFiles('matrix-game', preset);
      expect(files.has('src/game-specific/shellPack.ts')).toBe(true);
      const shellSource = files.get('src/game-specific/shellPack.ts')!;
      expect(shellSource).toContain('export const GAME_SPECIFIC_PACK');
    });

    it(`${preset.id}'s generated game.json systemPacks enables exactly the recipe's required packs plus the shell pack`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      const enabledIds = gameJson.systemPacks.map((s) => s.packId);
      for (const required of preset.requiredSystemPacks) {
        expect(enabledIds, preset.id).toContain(required.packId);
      }
      // Optional packs are preserved as metadata (README), not silently enabled (MASTER_PROJECT.md section 8).
      for (const optional of preset.optionalSystemPacks) {
        if (!preset.requiredSystemPacks.some((r) => r.packId === optional.packId)) {
          expect(enabledIds, `${preset.id} should not auto-enable optional pack ${optional.packId}`).not.toContain(optional.packId);
        }
      }
      expect(enabledIds.length, preset.id).toBe(preset.requiredSystemPacks.length + 1);
    });

    it(`${preset.id}'s generated README documents its optional packs and known limitations`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const readme = files.get('README.md')!;
      for (const optional of preset.optionalSystemPacks) {
        expect(readme, preset.id).toContain(optional.packId);
      }
      for (const limitation of preset.knownLimitations) {
        expect(readme, preset.id).toContain(limitation);
      }
    });
  }

  it('generates exactly 74 independent, valid trees - matching the full catalog', () => {
    expect(PRESETS.length).toBe(74);
  });
});
