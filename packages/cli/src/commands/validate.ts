import { existsSync, readFileSync } from 'node:fs';
import { run as runProcess } from '../exec.ts';
import { REPO_ROOT, GAMES_ROOT, resolveUnder } from '../paths.ts';
import { InvalidSlugError, assertValidSlug } from '../slug.ts';
import { ensureWorkspaceInstalled } from '../workspace.ts';

interface Step {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * The bounded validation ladder MASTER_PROJECT.md section 9 describes:
 * schema/content -> TypeScript -> unit tests -> production build -> browser
 * smoke. Reports incomplete, not "success", when a real browser is
 * unavailable (section 9: "If browser QA is unavailable, do not report full
 * success").
 */
export async function run(args: readonly string[]): Promise<number> {
  const gameId = args[0];
  if (!gameId) {
    console.error('Usage: npm run sw2d -- validate <game-id>');
    return 1;
  }
  try {
    assertValidSlug('game id', gameId);
  } catch (error) {
    if (error instanceof InvalidSlugError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }

  const gamePath = resolveUnder(GAMES_ROOT, gameId);
  if (!existsSync(gamePath)) {
    console.error(`Game "${gameId}" does not exist. Run: npm run sw2d -- new ${gameId} --preset <preset-id>`);
    return 1;
  }

  await ensureWorkspaceInstalled();

  const steps: Step[] = [];

  // 1 + 3: manifest/content schema validation and unit tests are the same
  // suite here - the generated tests/content.test.ts IS the schema check
  // (see packages/cli/src/generator/testFile.ts).
  const testResult = await runProcess('npx', ['vitest', 'run', '--config', `${REPO_ROOT}/vitest.config.ts`, `games/${gameId}/tests`], {
    cwd: REPO_ROOT,
  });
  steps.push({ name: 'Schema/content validation + unit tests', ok: testResult.code === 0, detail: testResult.stdout || testResult.stderr });

  // 2: TypeScript
  const tscResult = await runProcess('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit'], { cwd: gamePath });
  steps.push({ name: 'TypeScript', ok: tscResult.code === 0, detail: tscResult.stdout || tscResult.stderr });

  // 4: production build
  const buildResult = await runProcess('npx', ['vite', 'build'], { cwd: gamePath });
  steps.push({ name: 'Production build', ok: buildResult.code === 0, detail: buildResult.stdout || buildResult.stderr });

  // 5: focused real-browser smoke - only if the earlier steps passed and a
  // browser is available. Import is dynamic so commands that never reach
  // this line never load playwright-core.
  let browserAvailable = false;
  let smokeOk = false;
  let smokeDetail = 'skipped: an earlier step failed';
  if (steps.every((s) => s.ok)) {
    // What the game's own manifest says must install. Read here, in Node,
    // rather than inside the page, so the oracle compares runtime truth
    // against the declared contract instead of against itself.
    const manifest = JSON.parse(readFileSync(`${gamePath}/content/game.json`, 'utf8')) as {
      systemPacks?: readonly { packId: string }[];
    };
    const declaredPackIds = (manifest.systemPacks ?? []).map((selection) => selection.packId);
    const { findSystemChrome, runSmoke } = await import('@sw2d/qa');
    const chrome = findSystemChrome();
    browserAvailable = Boolean(chrome);
    if (browserAvailable) {
      const result = await runSmoke({
        id: gameId,
        buildDir: `${gamePath}/dist`,
        async run(harness) {
          // runSmoke already navigated and waited for window.__SW2D__ to
          // exist. Boot alone does not prove content/game.json's
          // systemPacks actually resolve and install - that only happens
          // once a run starts - so this presses CONFIRM and checks the play
          // scene actually came up with every declared pack installed,
          // catching a bad pack selection the title screen alone cannot.
          type Snap = { scene: string | null; installedPacks: readonly string[] };
          const evalSnap = () => (window as unknown as { __SW2D__: { snapshot(): Snap } }).__SW2D__.snapshot();

          const title = await harness.evaluate(evalSnap);
          if (title.scene !== 'sw2d.title') return { passed: false, details: { title } };

          await harness.keyTap('Space');
          await harness.stepFrames(5);
          const playing = await harness.evaluate(evalSnap);

          // Phase 9 / Gate B: this used to assert only `installedPacks.length
          // > 0`, while its own comment claimed "every declared pack
          // installed". Those are not the same check, and the difference is
          // exactly the class of bug this step exists to catch - a game whose
          // manifest names a pack that never installs. Compare against what
          // content/game.json actually declared.
          const missingPacks = declaredPackIds.filter((id) => !playing.installedPacks.includes(id));
          return {
            passed: playing.scene === 'sw2d.play' && missingPacks.length === 0,
            details: { title, playing, declaredPackIds, missingPacks },
          };
        },
      }).catch((error: unknown) => ({ passed: false, details: {}, failureReason: String(error), id: gameId, consoleErrors: [], externalRequests: [] }));
      smokeOk = result.passed;
      smokeDetail = smokeOk
        ? `boot smoke passed: entered sw2d.play with all ${declaredPackIds.length} declared pack(s) installed`
        : `smoke failed: ${result.failureReason ?? JSON.stringify(result.details)}`;
    } else {
      smokeDetail = 'Browser smoke unavailable: no system Chrome found (see `npm run sw2d -- doctor`).';
    }
  }
  steps.push({ name: 'Browser smoke', ok: browserAvailable && smokeOk, detail: smokeDetail });

  for (const step of steps) {
    console.log(`[${step.ok ? 'PASS' : 'FAIL'}] ${step.name}`);
    if (!step.ok) console.log(step.detail);
  }

  const allPassed = steps.every((s) => s.ok);
  if (!browserAvailable) {
    console.log('Validation is INCOMPLETE: browser smoke could not run (no system Chrome available).');
    return 1;
  }
  console.log(allPassed ? `"${gameId}" validated successfully.` : `Validation FAILED for "${gameId}".`);
  return allPassed ? 0 : 1;
}
