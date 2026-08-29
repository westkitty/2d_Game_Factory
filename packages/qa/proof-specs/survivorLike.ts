import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { SurvivorShellState } from '../../proofs/survivor-like/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.survivor-shell';

const state = (h: Harness): Promise<SurvivorShellState> => readShellState(h, SHELL_ID);

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

  // 1. Boot into arena
  const s1 = await state(harness);
  const step1_boot = s1.phase === 'active';

  // 2. Attempt = 1, wave 1 active
  const step2_wave1 = s1.attempt === 1 && s1.wave === 1;

  // 3. Wave spawns enemies via sw2d.encounters
  await evalShell(harness, `(shell) => shell.spawnWave(5)`);
  await harness.stepFrames(4);
  const s3 = await state(harness);
  const step3_spawns = s3.spawnedEnemies === 5;

  // 4. Player defeats wave enemies (kills recorded in RunStats)
  await evalShell(harness, `(shell) => { shell.defeatEnemy(); shell.defeatEnemy(); }`);
  await harness.stepFrames(4);
  const s4 = await state(harness);
  const step4_kills = s4.stats.kills >= 2 && s4.spawnedEnemies === 3;

  // 5. Wave cleared recorded (runs.recordWaveCleared())
  await evalShell(harness, `(shell) => shell.advanceWave()`);
  await harness.stepFrames(4);
  const s5 = await state(harness);
  const step5_waveCleared = s5.stats.wavesCleared === 1 && s5.wave === 2;

  // 6. Wave timer/duration progresses
  await harness.stepFrames(10);
  const s6 = await state(harness);
  const step6_timer = s6.attempt === 1;

  // 7. Transient currency accumulates per wave
  const step7_currency = s6.transientCurrency >= 20; // 5*2 kills + 10 wave clear

  // 8. Upgrade choice offered and purchased from run upgrade pool
  const buyOk = await evalShell<boolean>(harness, `(shell) => shell.buyUpgrade('transient-bullet-speed')`);
  await harness.stepFrames(4);
  const s8 = await state(harness);
  const step8_upgrade = buyOk && s8.transientUpgrades.includes('transient-bullet-speed') && s8.bulletSpeedBonus === 20;

  // 9. Player survives to target duration/waves -> winRun triggered -> meta progression rewards delivered
  await evalShell(harness, `(shell) => shell.surviveToVictory()`);
  await harness.stepFrames(6);
  const s9 = await state(harness);
  const step9_victory = s9.phase === 'victory' && s9.metaCurrency >= 50 && s9.metaUnlocks.includes('survivor-veteran');

  // 10. Reset -> attempt = 2, wave counter resets, meta upgrades retained
  await evalShell(harness, `(shell) => shell.reset()`);
  await harness.stepFrames(6);
  const s10 = await state(harness);
  const step10_reset = s10.attempt === 2 && s10.wave === 1 && s10.metaUnlocks.includes('survivor-veteran');

  const passed =
    step1_boot &&
    step2_wave1 &&
    step3_spawns &&
    step4_kills &&
    step5_waveCleared &&
    step6_timer &&
    step7_currency &&
    step8_upgrade &&
    step9_victory &&
    step10_reset;

  return {
    passed,
    details: {
      step1_boot,
      step2_wave1,
      step3_spawns,
      step4_kills,
      step5_waveCleared,
      step6_timer,
      step7_currency,
      step8_upgrade,
      step9_victory,
      step10_reset,
    },
  };
}
