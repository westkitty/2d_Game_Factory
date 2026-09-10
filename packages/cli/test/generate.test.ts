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

    it(`${preset.id}'s generated content/vehicles.json + content/races.json validate`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const vJson: unknown = JSON.parse(files.get('content/vehicles.json')!);
      const rJson: unknown = JSON.parse(files.get('content/races.json')!);
      expect(() => validateContentBundleData({ vehicles: vJson, races: rJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/economy.json validates as an economy catalog`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const ecoJson: unknown = JSON.parse(files.get('content/economy.json')!);
      expect(() => validateContentBundleData({ economy: ecoJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/needs.json validates as a needs catalog`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const needsJson: unknown = JSON.parse(files.get('content/needs.json')!);
      expect(() => validateContentBundleData({ needs: needsJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/dialogue.json validates as a dialogue catalog`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const dialogueJson: unknown = JSON.parse(files.get('content/dialogue.json')!);
      expect(() => validateContentBundleData({ dialogue: dialogueJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/perception.json validates as a perception catalog`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const perceptionJson: unknown = JSON.parse(files.get('content/perception.json')!);
      expect(() => validateContentBundleData({ perception: perceptionJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/ball-paddle.json validates as a ball-paddle catalog`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const tableJson: unknown = JSON.parse(files.get('content/ball-paddle.json')!);
      expect(() => validateContentBundleData({ 'ball-paddle': tableJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/melee.json validates as a melee catalog`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const meleeJson: unknown = JSON.parse(files.get('content/melee.json')!);
      expect(() => validateContentBundleData({ melee: meleeJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/local-play.json validates as a local-play catalog`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const seatsJson: unknown = JSON.parse(files.get('content/local-play.json')!);
      expect(() => validateContentBundleData({ 'local-play': seatsJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/stage-scroll.json validates as a stage-scroll catalog`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const stageJson: unknown = JSON.parse(files.get('content/stage-scroll.json')!);
      expect(() => validateContentBundleData({ 'stage-scroll': stageJson })).not.toThrow();
    });

    it(`${preset.id}'s generated content/timing.json validates as a timing catalog`, () => {
      const files = buildGameFiles('matrix-game', preset);
      const timingJson: unknown = JSON.parse(files.get('content/timing.json')!);
      expect(() => validateContentBundleData({ timing: timingJson })).not.toThrow();
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
describe('generated ui-simulation economy games consume sw2d.economy', () => {
  it('the generated ui-simulation shell binds bindStarterEconomy', () => {
    const shop = PRESETS.find((candidate) => candidate.id === 'shopkeeper')!;
    const shell = buildGameFiles('economy-probe', shop).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterEconomy(context)');
    expect(shell).toContain('economy.select(');
    expect(shell).toContain('economy.serve()');
    expect(buildGameFiles('economy-probe', shop).get('src/content.ts')).toContain('economy: economyData');
  });

  it('shopkeeper, restaurant and tycoon-lite enable sw2d.economy and emit a non-empty catalog', () => {
    for (const id of ['shopkeeper', 'restaurant', 'tycoon-lite'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('economy-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.economy');
      const eco = JSON.parse(files.get('content/economy.json')!) as { mode: string; goods: unknown[]; demand: unknown[] };
      expect(eco.mode, id).toBe(id === 'restaurant' ? 'kitchen' : id === 'tycoon-lite' ? 'factory' : 'shop');
      expect(eco.goods.length, id).toBeGreaterThan(0);
      expect(eco.demand.length, id).toBeGreaterThan(0);
    }
  });
});

describe('generated dialogue games consume sw2d.dialogue', () => {
  it('the generated ui-simulation shell binds bindStarterDialogue', () => {
    const vn = PRESETS.find((candidate) => candidate.id === 'visual-novel')!;
    const shell = buildGameFiles('dialogue-probe', vn).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterDialogue(context)');
    expect(shell).toContain('dialogue.choose()');
    expect(buildGameFiles('dialogue-probe', vn).get('src/content.ts')).toContain('dialogue: dialogueData');
    expect(buildGameFiles('dialogue-probe', vn).get('src/main.ts')).toContain('dialoguePack');
  });

  it('the generated pointer shell binds adventure hotspots', () => {
    const pan = PRESETS.find((candidate) => candidate.id === 'point-and-click')!;
    const shell = buildGameFiles('dialogue-probe', pan).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterDialogue(context)');
    expect(shell).toContain('dialogue.start(');
  });

  it('visual-novel and point-and-click enable sw2d.dialogue and emit a non-empty catalog', () => {
    for (const id of ['visual-novel', 'point-and-click'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('dialogue-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.dialogue');
      const doc = JSON.parse(files.get('content/dialogue.json')!) as { mode: string; conversations: unknown[] };
      expect(doc.mode, id).toBe(id === 'point-and-click' ? 'adventure' : 'novel');
      expect(doc.conversations.length, id).toBeGreaterThan(0);
    }
  });
});

describe('generated perception games consume sw2d.perception', () => {
  it('the generated top-down shell binds bindStarterPerception', () => {
    const stealth = PRESETS.find((candidate) => candidate.id === 'stealth-game')!;
    const shell = buildGameFiles('perception-probe', stealth).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterPerception(context)');
    expect(shell).toContain('perception.tick(');
    expect(buildGameFiles('perception-probe', stealth).get('src/content.ts')).toContain('perception: perceptionData');
    expect(buildGameFiles('perception-probe', stealth).get('src/main.ts')).toContain('perceptionPack');
  });

  it('stealth-game and heist-game enable sw2d.perception and emit a non-empty catalog', () => {
    for (const id of ['stealth-game', 'heist-game'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('perception-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.perception');
      const doc = JSON.parse(files.get('content/perception.json')!) as { mode: string; observers: unknown[] };
      expect(doc.mode, id).toBe(id === 'heist-game' ? 'heist' : 'infiltrate');
      expect(doc.observers.length, id).toBeGreaterThan(0);
    }
  });
});

describe('generated ball-paddle games consume sw2d.ball-paddle', () => {
  it('the generated top-down shell binds bindStarterBallPaddle', () => {
    const breakout = PRESETS.find((candidate) => candidate.id === 'breakout')!;
    const shell = buildGameFiles('ball-paddle-probe', breakout).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterBallPaddle(context)');
    expect(shell).toContain('table.tick(');
    expect(buildGameFiles('ball-paddle-probe', breakout).get('src/content.ts')).toContain("'ball-paddle': ballPaddleData");
    expect(buildGameFiles('ball-paddle-probe', breakout).get('src/main.ts')).toContain(
      'ballPaddlePack, meleePack, localPlayPack, stageScrollPack, timingPack, GAME_SPECIFIC_PACK',
    );
  });

  it('breakout and pong enable sw2d.ball-paddle and emit a non-empty catalog', () => {
    for (const id of ['breakout', 'pong'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('ball-paddle-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.ball-paddle');
      const doc = JSON.parse(files.get('content/ball-paddle.json')!) as { mode: string; bricks: unknown[]; pong?: unknown };
      expect(doc.mode, id).toBe(id);
      if (id === 'breakout') expect(doc.bricks.length, id).toBeGreaterThan(0);
      else expect(doc.pong, id).toBeDefined();
    }
  });
});

describe('generated melee games consume sw2d.melee', () => {
  it('the generated top-down shell binds bindStarterMelee', () => {
    const adventure = PRESETS.find((candidate) => candidate.id === 'action-adventure')!;
    const shell = buildGameFiles('melee-probe', adventure).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterMelee(context)');
    expect(shell).toContain('melee.strike(');
    expect(buildGameFiles('melee-probe', adventure).get('src/content.ts')).toContain('melee: meleeData');
    expect(buildGameFiles('melee-probe', adventure).get('src/main.ts')).toContain(
      'ballPaddlePack, meleePack, localPlayPack, stageScrollPack, timingPack, GAME_SPECIFIC_PACK',
    );
  });

  it('action-adventure and arena-combat enable sw2d.melee and emit a non-empty catalog', () => {
    for (const id of ['action-adventure', 'arena-combat'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('melee-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.melee');
      const doc = JSON.parse(files.get('content/melee.json')!) as { mode: string; foes: unknown[] };
      expect(doc.mode, id).toBe(id === 'arena-combat' ? 'arena' : 'skirmish');
      expect(doc.foes.length, id).toBeGreaterThan(0);
    }
  });
});

describe('generated local-play games consume sw2d.local-play', () => {
  it('the generated ui-simulation shell binds bindStarterLocalPlay', () => {
    const party = PRESETS.find((candidate) => candidate.id === 'local-party-game')!;
    const shell = buildGameFiles('local-play-probe', party).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterLocalPlay(context)');
    expect(shell).toContain('seats.act()');
    expect(buildGameFiles('local-play-probe', party).get('src/content.ts')).toContain("'local-play': localPlayData");
    expect(buildGameFiles('local-play-probe', party).get('src/main.ts')).toContain(
      'ballPaddlePack, meleePack, localPlayPack, stageScrollPack, timingPack, GAME_SPECIFIC_PACK',
    );
  });

  it('the generated top-down shell pumps versus seats into the pong table', () => {
    const pong = PRESETS.find((candidate) => candidate.id === 'pong')!;
    const shell = buildGameFiles('local-play-probe', pong).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterLocalPlay(context, { hud: false })');
    expect(shell).toContain('table.setOpponentAxis(seats.axis(1))');
  });

  it('local-party-game and pong enable sw2d.local-play and emit a non-empty catalog', () => {
    for (const id of ['local-party-game', 'pong'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('local-play-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.local-play');
      const doc = JSON.parse(files.get('content/local-play.json')!) as { mode: string; players: unknown[] };
      expect(doc.mode, id).toBe(id === 'pong' ? 'versus' : 'hotseat');
      expect(doc.players.length, id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('generated puzzle-board games consume sw2d.puzzle-rules match and falling-block', () => {
  it('the generated grid shell binds bindStarterPuzzle', () => {
    const match = PRESETS.find((candidate) => candidate.id === 'match-puzzle')!;
    const shell = buildGameFiles('puzzle-board-probe', match).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterPuzzle(context)');
    expect(shell).toContain('board.tick(');
    expect(buildGameFiles('puzzle-board-probe', match).get('src/content.ts')).toContain('puzzles: puzzlesData');
    expect(buildGameFiles('puzzle-board-probe', match).get('src/main.ts')).toContain('puzzleRulesPack');
  });

  it('match-puzzle and falling-block-puzzle enable sw2d.puzzle-rules and emit the matching kind', () => {
    for (const id of ['match-puzzle', 'falling-block-puzzle'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('puzzle-board-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.puzzle-rules');
      expect(gameJson.systemPacks.map((s) => s.packId), id).not.toContain('sw2d.puzzle');
      const doc = JSON.parse(files.get('content/puzzles.json')!) as { puzzles: Array<{ kind: string }> };
      expect(doc.puzzles[0]?.kind, id).toBe(id === 'falling-block-puzzle' ? 'falling-block' : 'match');
      const packConfig = files.get('src/game-specific/packConfig.ts')!;
      expect(packConfig, id).not.toContain('createInitialState');
      const theme = JSON.parse(files.get('content/themes/default/theme.json')!) as { ui: { playHint: string } };
      expect(theme.ui.playHint, id).toContain(id === 'falling-block-puzzle' ? 'DROP K' : 'ENTER SELECTS OR SWAPS');
    }
  });
});

describe('generated timing games consume sw2d.timing', () => {
  it('the generated ui-simulation shell binds bindStarterTiming', () => {
    const reaction = PRESETS.find((candidate) => candidate.id === 'reaction-timing')!;
    const shell = buildGameFiles('timing-probe', reaction).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterTiming(context)');
    expect(shell).toContain('clock.hit()');
    expect(buildGameFiles('timing-probe', reaction).get('src/content.ts')).toContain('timing: timingData');
    expect(buildGameFiles('timing-probe', reaction).get('src/main.ts')).toContain(
      'ballPaddlePack, meleePack, localPlayPack, stageScrollPack, timingPack, GAME_SPECIFIC_PACK',
    );
  });

  it('reaction-timing and rhythm-action enable sw2d.timing and emit a non-empty catalog', () => {
    for (const id of ['reaction-timing', 'rhythm-action'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('timing-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.timing');
      const doc = JSON.parse(files.get('content/timing.json')!) as {
        mode: string;
        hitsToWin: number;
        reaction?: { delaysMs: unknown[] };
        rhythm?: { periodMs: number };
      };
      expect(doc.mode, id).toBe(id === 'rhythm-action' ? 'rhythm' : 'reaction');
      expect(doc.hitsToWin, id).toBeGreaterThan(0);
      if (id === 'rhythm-action') expect(doc.rhythm?.periodMs, id).toBeGreaterThan(0);
      else expect(doc.reaction?.delaysMs.length, id).toBeGreaterThan(0);
      const theme = JSON.parse(files.get('content/themes/default/theme.json')!) as { ui: { playHint: string } };
      expect(theme.ui.playHint, id).toContain(id === 'rhythm-action' ? 'ENTER ON THE BEAT' : 'WAIT FOR THE GO');
    }
  });
});

describe('generated stage-scroll games consume sw2d.stage-scroll', () => {
  it('the generated top-down shell binds bindStarterStageScroll', () => {
    const shmup = PRESETS.find((candidate) => candidate.id === 'horizontal-shmup')!;
    const shell = buildGameFiles('stage-scroll-probe', shmup).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterStageScroll(context)');
    expect(shell).toContain('stage.tick(');
    expect(buildGameFiles('stage-scroll-probe', shmup).get('src/content.ts')).toContain("'stage-scroll': stageScrollData");
    expect(buildGameFiles('stage-scroll-probe', shmup).get('src/main.ts')).toContain(
      'ballPaddlePack, meleePack, localPlayPack, stageScrollPack, timingPack, GAME_SPECIFIC_PACK',
    );
  });

  it('horizontal-shmup and vertical-shmup enable sw2d.stage-scroll and emit a non-empty catalog', () => {
    for (const id of ['horizontal-shmup', 'vertical-shmup'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('stage-scroll-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.stage-scroll');
      const doc = JSON.parse(files.get('content/stage-scroll.json')!) as { mode: string; length: number; hazards: unknown[] };
      expect(doc.mode, id).toBe(id === 'vertical-shmup' ? 'vertical' : 'horizontal');
      expect(doc.length, id).toBeGreaterThan(0);
      expect(doc.hazards.length, id).toBeGreaterThan(0);
    }
  });
});

describe('generated ui-simulation needs games consume sw2d.needs', () => {
  it('the generated ui-simulation shell binds bindStarterNeeds', () => {
    const pet = PRESETS.find((candidate) => candidate.id === 'pet-creature')!;
    const shell = buildGameFiles('needs-probe', pet).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterNeeds(context)');
    expect(shell).toContain('needs.actByIndex(');
    expect(buildGameFiles('needs-probe', pet).get('src/content.ts')).toContain('needs: needsData');
  });

  it('pet-creature, aquarium-terrarium and virtual-pet enable sw2d.needs and emit a non-empty catalog', () => {
    for (const id of ['pet-creature', 'aquarium-terrarium', 'virtual-pet'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('needs-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.needs');
      const doc = JSON.parse(files.get('content/needs.json')!) as { mode: string; needs: unknown[]; actions: unknown[] };
      expect(doc.mode, id).toBe(id === 'aquarium-terrarium' ? 'habitat' : id === 'virtual-pet' ? 'companion' : 'creature');
      expect(doc.needs.length, id).toBeGreaterThan(0);
      expect(doc.actions.length, id).toBeGreaterThan(0);
    }
  });
});

describe('generated vehicle and pointer shooters consume sw2d.weapons', () => {
  it('the generated vehicle shell binds bindStarterWeapon and fires on PRIMARY_ACTION', () => {
    const asteroids = PRESETS.find((candidate) => candidate.id === 'asteroids-shooter')!;
    const shell = buildGameFiles('weapons-probe', asteroids).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterWeapon(context)');
    expect(shell).toContain("justPressed('PRIMARY_ACTION')");
    expect(shell).toContain('weapon.fire(');
    expect(buildGameFiles('weapons-probe', asteroids).get('src/content.ts')).toContain('weapons: weaponsData');
  });

  it('the generated pointer shell binds bindStarterWeapon and fires toward the cursor', () => {
    const gallery = PRESETS.find((candidate) => candidate.id === 'gallery-shooter')!;
    const shell = buildGameFiles('weapons-probe', gallery).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain('bindStarterWeapon(context)');
    expect(shell).toContain('weapon.fire(');
    expect(shell).toContain('context.spatialPointer.state');
  });

  it('asteroids-shooter and gallery-shooter enable sw2d.weapons and emit a non-empty catalog', () => {
    for (const id of ['asteroids-shooter', 'gallery-shooter'] as const) {
      const preset = PRESETS.find((candidate) => candidate.id === id)!;
      const files = buildGameFiles('weapons-probe', preset);
      const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
      expect(gameJson.systemPacks.map((s) => s.packId), id).toContain('sw2d.weapons');
      const doc = JSON.parse(files.get('content/weapons.json')!) as { weapons: unknown[] };
      expect(doc.weapons.length, id).toBeGreaterThan(0);
      const theme = JSON.parse(files.get('content/themes/default/theme.json')!) as { ui: { playHint: string } };
      expect(theme.ui.playHint, id).toContain('FIRE J/X');
    }
  });

  it('rail-shooter does not enable sw2d.weapons (rail-camera leftover, not a second shooting adapter)', () => {
    const rail = PRESETS.find((candidate) => candidate.id === 'rail-shooter')!;
    const files = buildGameFiles('weapons-probe', rail);
    const gameJson = JSON.parse(files.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
    expect(gameJson.systemPacks.map((s) => s.packId)).not.toContain('sw2d.weapons');
    const theme = JSON.parse(files.get('content/themes/default/theme.json')!) as { ui: { playHint: string } };
    expect(theme.ui.playHint).not.toContain('FIRE');
  });
});

describe('generated pointer puzzles consume sw2d.puzzle', () => {
  it('the generated pointer shell presents physics-goal and escape-locks on puzzle.state', () => {
    const physics = PRESETS.find((candidate) => candidate.id === 'physics-puzzle')!;
    const shell = buildGameFiles('puzzle-seam-probe', physics).get('src/game-specific/shellPack.ts')!;
    expect(shell).toContain("context.capabilities.get<CodePuzzleService>('puzzle.state')");
    expect(shell).toContain("'physics-goal'");
    expect(shell).toContain("'escape-locks'");
    expect(shell).toContain('puzzle.apply(');
    expect(shell).toContain('physics.setVelocity(');
  });

  it('physics-puzzle and escape-room enable sw2d.puzzle with different code-seam states', () => {
    const physics = PRESETS.find((candidate) => candidate.id === 'physics-puzzle')!;
    const escape = PRESETS.find((candidate) => candidate.id === 'escape-room')!;
    const physicsFiles = buildGameFiles('puzzle-seam-probe', physics);
    const escapeFiles = buildGameFiles('puzzle-seam-probe', escape);
    const physicsJson = JSON.parse(physicsFiles.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
    const escapeJson = JSON.parse(escapeFiles.get('content/game.json')!) as { systemPacks: Array<{ packId: string }> };
    expect(physicsJson.systemPacks.map((s) => s.packId)).toContain('sw2d.puzzle');
    expect(escapeJson.systemPacks.map((s) => s.packId)).toContain('sw2d.puzzle');
    expect(physicsFiles.get('src/game-specific/packConfig.ts')).toContain("kind: 'physics-goal'");
    expect(physicsFiles.get('src/game-specific/packConfig.ts')).toContain('inGoal');
    expect(escapeFiles.get('src/game-specific/packConfig.ts')).toContain("kind: 'escape-locks'");
    expect(escapeFiles.get('src/game-specific/packConfig.ts')).toContain('note');
    const physicsTheme = JSON.parse(physicsFiles.get('content/themes/default/theme.json')!) as { ui: { playHint: string } };
    const escapeTheme = JSON.parse(escapeFiles.get('content/themes/default/theme.json')!) as { ui: { playHint: string } };
    expect(physicsTheme.ui.playHint).toContain('CLICK TO NUDGE');
    expect(escapeTheme.ui.playHint).toContain('CLICK THE NOTE');
  });
});

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
