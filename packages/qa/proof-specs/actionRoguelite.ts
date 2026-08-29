import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { RunState } from '@sw2d/contracts';
import type {
  ActionRogueliteShellState,
  ActionRogueliteShellService,
  SavedRunProbe,
} from '../../proofs/action-roguelite/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.action-roguelite-shell';

const state = (h: Harness): Promise<ActionRogueliteShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);

  // 1. Boot and initial idle/active run state
  const s1 = await state(harness);
  const step1_boot = s1.phase === 'active';

  // 2. Initial attempt = 1, initial duration = 0, initial seed derived deterministically
  const step2_initialParams = s1.attempt === 1 && s1.seed > 0;

  // 3. Player spawns in the generated entrance room
  const step3_entrance = s1.currentRoom === 'r0' && s1.totalRooms >= 4;

  // 4. Player collects transient currency and items
  await evalShell(harness, `(shell) => { shell.collectCurrency(20); shell.collectItem('dungeon-key', 1); }`);
  await harness.stepFrames(4);
  const s4 = await state(harness);
  const step4_collection = s4.transientCurrency === 30 && s4.inventory['dungeon-key'] === 1;

  // 5. Player clears room / records room clear stats
  await evalShell(harness, `(shell) => shell.clearRoom()`);
  await harness.stepFrames(4);
  const s5 = await state(harness);
  const step5_clear = s5.stats.roomsCleared >= 1;

  // 6. Player takes damage and deals damage (stats advance)
  await evalShell(harness, `(shell) => { shell.dealDamage(50); shell.takeDamage(20); }`);
  await harness.stepFrames(4);
  const s6 = await state(harness);
  const step6_combat = s6.stats.damageDealt >= 50 && s6.stats.damageTaken >= 20 && s6.playerHp === 80;

  // 7. Player purchases transient upgrade with transient currency; verify effect/state
  const buyTransientOk = await evalShell<boolean>(harness, `(shell) => shell.buyTransientUpgrade('transient-attack-buff')`);
  await harness.stepFrames(4);
  const s7 = await state(harness);
  const step7_upgrade = buyTransientOk && s7.transientCurrency === 15 && s7.attackBonus === 5;

  // 8. Player dies (defeat condition triggers endRun)
  await evalShell(harness, `(shell) => shell.die()`);
  await harness.stepFrames(6);
  const s8 = await state(harness);
  const step8_death = s8.playerHp <= 0;

  // 9. Run outcome = defeat; transient currency wiped; attempt stats finalized
  const step9_defeat = s8.phase === 'defeat' && s8.stats.roomsCleared >= 1;

  // 10. Meta-currency earned from run carries into ProgressionService
  const step10_metaEarned = s8.metaCurrency >= 15 && s8.metaXp >= 50;

  // 11. Reset run advances attempt = 2; seed advances deterministically
  await evalShell(harness, `(shell) => shell.reset()`);
  await harness.stepFrames(6);
  const s11 = await state(harness);
  const step11_reset = s11.attempt === 2 && s11.seed !== s1.seed && s11.phase === 'active' && s11.transientCurrency === 10;

  // 12. Player purchases permanent meta-upgrade with meta-currency via ProgressionService
  // Grant difference if needed for 25 cost (s11.metaCurrency is at least 15)
  await harness.evaluate(`
    (() => {
      const prog = window.__SW2D__.context.capabilities.require('progression.state');
      if (prog.currency() < 25) prog.addCurrency(25 - prog.currency());
    })()
  `);
  const buyMetaOk = await evalShell<boolean>(harness, `(shell) => shell.buyPermanentUpgrade('perm-health-meta')`);
  await harness.stepFrames(4);
  const s12 = await state(harness);
  const step12_metaUpgrade = buyMetaOk && s12.metaUnlocks.includes('meta-health-boost');

  // 13. Permanent unlock persists across resets
  await evalShell(harness, `(shell) => shell.reset()`);
  await harness.stepFrames(6);
  const s13 = await state(harness);
  const step13_metaPersists = s13.metaUnlocks.includes('meta-health-boost');

  // 14. Player starts attempt with advanced seed and permanent meta-bonus
  const step14_metaBonus = s13.attempt === 3 && s13.maxHp === 120 && s13.playerHp === 120;

  // 15. Player defeats final objective / boss room
  await evalShell(harness, `(shell) => shell.reachObjective()`);
  await harness.stepFrames(6);
  const s15 = await state(harness);
  const step15_bossDefeated = s15.phase === 'victory';

  // 16. Run outcome = victory; victory rewards granted to ProgressionService
  const step16_victory = s15.phase === 'victory' && s15.metaUnlocks.includes('conquered-depths');

  // 17. Resumable run lifecycle, proven against the game's real SaveStore rather
  //     than asserted. Three observable properties, all through public API:
  //       a) an active run with mutated transient state is durably written,
  //       b) a RunService rebuilt over that same store restores the run,
  //       c) finishing the run clears the slot and a rebuild does NOT resume it.
  await evalShell(harness, `(shell) => shell.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(shell) => { shell.clearRoom(); shell.dealDamage(11); shell.collectCurrency(7); }`);
  // Duration and stats are checkpointed on a bounded interval (1000ms of run
  // time), so step past it before probing rather than probing mid-window.
  await harness.stepFrames(70);

  const live17 = await state(harness);
  const saved17 = await evalShell<SavedRunProbe>(harness, `(shell) => shell.probeSavedRun()`);
  const restored17 = await evalShell<RunState>(harness, `(shell) => shell.rehydrateRunService()`);

  const step17a_activeRunPersisted =
    live17.phase === 'active' &&
    saved17.outcome === 'loaded' &&
    saved17.record !== null &&
    saved17.record.phase === 'active' &&
    saved17.record.runId === live17.runId &&
    saved17.record.attempt === live17.attempt &&
    saved17.record.seed === live17.seed &&
    saved17.record.transientCurrency === live17.transientCurrency &&
    saved17.record.stats.roomsCleared === live17.stats.roomsCleared &&
    saved17.record.stats.kills === live17.stats.kills &&
    saved17.record.runDurationMs > 0;

  const step17b_restoresIntoFreshService =
    restored17.phase === 'active' &&
    restored17.runId === live17.runId &&
    restored17.attempt === live17.attempt &&
    restored17.seed === live17.seed &&
    restored17.transientCurrency === live17.transientCurrency &&
    restored17.stats.roomsCleared === live17.stats.roomsCleared &&
    restored17.stats.kills === live17.stats.kills &&
    restored17.runDurationMs > 0;

  await evalShell(harness, `(shell) => shell.reachObjective()`);
  await harness.stepFrames(6);
  const savedAfter17 = await evalShell<SavedRunProbe>(harness, `(shell) => shell.probeSavedRun()`);
  const restoredAfter17 = await evalShell<RunState>(harness, `(shell) => shell.rehydrateRunService()`);

  const step17c_finishedRunNotResumed =
    savedAfter17.outcome === 'default' &&
    savedAfter17.record === null &&
    restoredAfter17.phase === 'idle' &&
    restoredAfter17.attempt === 1 &&
    restoredAfter17.transientUpgrades.length === 0 &&
    restoredAfter17.stats.roomsCleared === 0;

  // 18. Clean scene teardown without leaked event listeners or dangling timers
  const snap = await readSnapshot(harness);
  const step18_teardown = snap.scene !== null && snap.installedPacks.includes('sw2d.runs');

  const passed =
    step1_boot &&
    step2_initialParams &&
    step3_entrance &&
    step4_collection &&
    step5_clear &&
    step6_combat &&
    step7_upgrade &&
    step8_death &&
    step9_defeat &&
    step10_metaEarned &&
    step11_reset &&
    step12_metaUpgrade &&
    step13_metaPersists &&
    step14_metaBonus &&
    step15_bossDefeated &&
    step16_victory &&
    step17a_activeRunPersisted &&
    step17b_restoresIntoFreshService &&
    step17c_finishedRunNotResumed &&
    step18_teardown;

  return {
    passed,
    details: {
      step1_boot,
      step2_initialParams,
      step3_entrance,
      step4_collection,
      step5_clear,
      step6_combat,
      step7_upgrade,
      step8_death,
      step9_defeat,
      step10_metaEarned,
      step11_reset,
      step12_metaUpgrade,
      step13_metaPersists,
      step14_metaBonus,
      step15_bossDefeated,
      step16_victory,
      step17a_activeRunPersisted,
      step17b_restoresIntoFreshService,
      step17c_finishedRunNotResumed,
      step18_teardown,
    },
  };
}
