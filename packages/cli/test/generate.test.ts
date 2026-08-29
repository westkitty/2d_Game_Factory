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

    it(`${preset.id}'s generated content/puzzles.json validates as a puzzle-rules document`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const puzzlesJson: unknown = JSON.parse(files.get('content/puzzles.json')!);
      expect(() => validateContentBundleData({ puzzles: puzzlesJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/generation.json validates as a generation document`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const genJson: unknown = JSON.parse(files.get('content/generation.json')!);
      expect(() => validateContentBundleData({ generation: genJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/world-graph.json validates as a world-graph document`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const wgJson: unknown = JSON.parse(files.get('content/world-graph.json')!);
      expect(() => validateContentBundleData({ 'world-graph': wgJson })).not.toThrow();
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

/**
 * Phase 9 / Gate B. `content/game.json` can only ever hold JSON, so a pack
 * whose config is functions (`configSource: 'code'` - `sw2d.puzzle` today)
 * cannot be configured from there. Before this phase the generator wrote
 * `config: {}` for it anyway: all six presets requiring it produced games that
 * built cleanly and then threw `createInitialState is not a function` the
 * instant the player pressed CONFIRM, taking the shell pack down with them via
 * install rollback. The generated code seam replaces that silent falsehood.
 */
describe('code-configured packs get a real code seam, never a false JSON config', () => {
  const puzzlePresets = PRESETS.filter((preset) =>
    preset.requiredSystemPacks.some((selection) => selection.packId === 'sw2d.puzzle'),
  );

  it('the catalog still has presets requiring sw2d.puzzle (otherwise this suite is vacuous)', () => {
    expect(puzzlePresets.length).toBeGreaterThan(0);
  });

  for (const preset of PRESETS) {
    const needsCodeConfig = puzzlePresets.includes(preset);

    it(`${preset.id} generates src/game-specific/packConfig.ts${needsCodeConfig ? ' with a working puzzle seed' : ''}`, () => {
      const files = buildGameFiles('probe-game', preset);
      const packConfig = files.get('src/game-specific/packConfig.ts');
      expect(packConfig, preset.id).toBeDefined();
      expect(packConfig, preset.id).toContain('export const PACK_CONFIG');

      if (needsCodeConfig) {
        // A real, callable default - not a `{}` placeholder that crashes on install.
        expect(packConfig, preset.id).toContain("'sw2d.puzzle'");
        expect(packConfig, preset.id).toContain('createInitialState');
        expect(packConfig, preset.id).toContain('isSolved');
      } else {
        expect(packConfig, preset.id).not.toContain('createInitialState');
      }
    });

    it(`${preset.id}'s main.ts passes packConfig to createGame`, () => {
      const files = buildGameFiles('probe-game', preset);
      const mainTs = files.get('src/main.ts')!;
      expect(mainTs, preset.id).toContain('packConfig: PACK_CONFIG');
      expect(mainTs, preset.id).toContain("from './game-specific/packConfig.ts'");
    });
  }
});

/**
 * Phase 9 / Gate B. `content/tuning.json` was generated for all 74 presets,
 * schema-validated by `tests/content.test.ts`, listed in the generated README
 * as "tuning values" - and read by nothing. Its numbers were hard-coded in the
 * shell templates instead, so editing the document changed nothing about the
 * game. That is the "metadata never evaluated at runtime" shape this gate
 * exists to catch, and it is only really fixed while the shells keep reading
 * it.
 */
describe('content/tuning.json is actually consumed, not just validated', () => {
  const MOVEMENT_SHELLS = ['platform', 'top-down'] as const;

  for (const family of MOVEMENT_SHELLS) {
    const preset = PRESETS.find((candidate) => candidate.controllerFamilies[0] === family)!;

    it(`the ${family} shell reads the tuning document instead of hard-coding movement numbers`, () => {
      const shell = buildGameFiles('probe-game', preset).get('src/game-specific/shellPack.ts')!;
      expect(shell).toContain("const TUNING_DOCUMENT = 'tuning'");
      expect(shell).toContain('readPlayerTuning(context)');
      expect(shell).toContain('tuning.moveSpeed');
      // The generator's own tuning document must supply every key the shell reads.
      const tuning = JSON.parse(buildGameFiles('probe-game', preset).get('content/tuning.json')!) as {
        player: Record<string, number>;
      };
      expect(Object.keys(tuning.player).sort()).toEqual(['gravity', 'jumpVelocity', 'moveSpeed']);
    });
  }
});

/**
 * Start / Confirm UX: a generated game must give the player an obvious
 * keyboard start path AND an obvious clickable start control that lives in
 * the game itself (not the Workbench). The click control routes through the
 * semantic input layer (`data-sw2d-action="CONFIRM"`), so it is not a second
 * start path. The full behaviour is proven in a real browser by
 * `tools/scripts/qa-start-controls.ts`.
 */
describe('generated games ship explicit start controls', () => {
  const preset = PRESETS.find((candidate) => candidate.controllerFamilies[0] === 'platform')!;

  it('the generated index.html has a visible Start control inside the game, bound to CONFIRM', () => {
    const html = buildGameFiles('start-ux', preset).get('index.html')!;
    expect(html).toContain('id="start-overlay"');
    expect(html).toContain('data-sw2d-action="CONFIRM"');
    expect(html).toContain('aria-label="Start game"');
    // It sits inside the game canvas container, not the touch-controls cluster.
    const gameRoot = html.slice(html.indexOf('id="game-root"'), html.indexOf('id="touch-controls"'));
    expect(gameRoot).toContain('id="start-overlay"');
  });

  it('the generated styles show the Start control on desktop (not gated on pointer: coarse) and hide it once running', () => {
    const css = buildGameFiles('start-ux', preset).get('src/styles.css')!;
    expect(css).toContain('.start-overlay');
    expect(css).toContain('.start-overlay[hidden] { display: none; }');
    // Never inside a `(pointer: coarse)` / touch media query.
    const overlayBlock = css.slice(css.indexOf('.start-overlay'));
    expect(overlayBlock).not.toContain('pointer: coarse');
  });

  it('the generated main.ts hides the Start control once a run begins, via runtime events only', () => {
    const main = buildGameFiles('start-ux', preset).get('src/main.ts')!;
    expect(main).toContain("#start-overlay");
    expect(main).toContain("runtime.context.events.on('scene:changed'");
    expect(main).toContain('SCENE_KEYS.title');
    // No bespoke scene-transition logic in the template: it only shows/hides.
    expect(main).not.toContain('router.startRun');
  });

  it('no generated file tells the player to "PRESS CONFIRM"', () => {
    for (const candidate of PRESETS.slice(0, 6)) {
      for (const [name, content] of buildGameFiles('confirm-jargon', candidate)) {
        expect(content, `${candidate.id}:${name}`).not.toContain('PRESS CONFIRM TO START');
      }
    }
  });

  it('the template additions leave no unresolved tokens (covered per-preset by the 74 matrix too)', () => {
    expect(findUnresolvedTokens(buildGameFiles('token-check', preset))).toEqual([]);
  });
});

/**
 * Capability program Phase 1 (ADR-0018): a newly generated pointer-family game
 * consumes the reusable spatial interaction capability - not just a string
 * constant, the real generated shell. End-to-end behaviour is proven in a real
 * browser by proofs/gallery-shooter/ and proofs/point-and-click/.
 */
describe('generated pointer games consume the spatial interaction capability', () => {
  const pointerPreset = PRESETS.find((candidate) => candidate.controllerFamilies[0] === 'pointer')!;

  it('the generated pointer shell wires context.interaction and context.spatialPointer', () => {
    const shell = buildGameFiles('spatial-probe', pointerPreset).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('context.interaction.register(');
    expect(shell).toContain('context.spatialPointer.state');
    expect(shell).toContain('onHoverEnter');
    expect(shell).toContain('onClick');
    // It does not reimplement hit-testing or read raw pointer coordinates off ActionInput.
    expect(shell).not.toContain("input.value('");
  });

  it('every pointer-family preset still generates a resolvable shell with no unresolved tokens', () => {
    for (const candidate of PRESETS.filter((p) => p.controllerFamilies[0] === 'pointer')) {
      const files = buildGameFiles('spatial-probe', candidate);
      expect(files.get('src/game-specific/shellPack.ts')).toContain('export const GAME_SPECIFIC_PACK');
      expect(findUnresolvedTokens(files)).toEqual([]);
    }
  });
});
