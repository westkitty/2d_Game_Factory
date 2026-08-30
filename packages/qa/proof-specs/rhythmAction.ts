import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { RhythmShellState } from '../../proofs/rhythm-action/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.rhythm-shell';

const state = (h: Harness): Promise<RhythmShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

interface PressResult {
  judged: boolean;
  judgement: string | null;
  deltaMs: number | null;
}

/** Sit at an exact chart position and press there. */
function pressAt(harness: Harness, timeMs: number, action = 'CONFIRM', lane?: string): Promise<PressResult> {
  const laneArg = lane === undefined ? '' : `, ${JSON.stringify(lane)}`;
  return evalShell<PressResult>(harness, `(s) => { s.seek(${timeMs}); return s.press(${JSON.stringify(action)}${laneArg}); }`);
}

/**
 * The chart under test (`proofs/rhythm-action/content/rhythm.json`): 120bpm,
 * 1000ms offset, so beat-authored notes land at 1000, 2000, 3000, ... and the
 * millisecond-authored lane notes land at 9000, 9750, 10500, 11250.
 */
const BEAT_0 = 1000;
const BEAT_2 = 2000;
const BEAT_4 = 3000;
const LANE_0 = 9000;

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(10);

  // 1. Boot: the pack is installed, the chart is loaded, nothing is judged, and
  //    the transport has not started.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = { chartId: s1.chartId, status: s1.status, notes: s1.notesTotal, transport: s1.transportState };
  const step1_boot =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.rhythm') &&
    s1.chartId === 'demo-chart' &&
    s1.status === 'idle' &&
    s1.notesTotal === 12 &&
    s1.notesJudged === 0 &&
    s1.transportState === 'idle';

  // 2. A press before the chart starts judges nothing at all.
  const early = await pressAt(harness, BEAT_0);
  const s2 = await state(harness);
  evidence.beforeStart = { early, judged: s2.notesJudged };
  const step2_inertBeforeStart = early.judged === false && s2.notesJudged === 0;

  // 3. Start: the transport plays and the chart is live.
  await evalShell(harness, `(s) => s.start()`);
  await harness.stepFrames(2);
  const s3 = await state(harness);
  evidence.started = { status: s3.status, transport: s3.transportState, time: s3.timeMs };
  const step3_start = s3.status === 'playing' && s3.transportState === 'playing' && s3.timeMs === 0;

  // 4. A dead-centre press on a BEAT-authored note is PERFECT. That the note is
  //    at 1000ms at all is the beat conversion (offset 1000 + 0 beats at 120bpm).
  const perfect = await pressAt(harness, BEAT_0);
  const s4 = await state(harness);
  evidence.perfect = { perfect, score: s4.score };
  const step4_perfect =
    perfect.judged === true &&
    perfect.judgement === 'perfect' &&
    perfect.deltaMs === 0 &&
    s4.score.perfect === 1 &&
    s4.score.combo === 1 &&
    s4.lastNoteId === 'beat-0';

  // 5. A press 60ms late is GOOD - outside the 40ms perfect window, inside the
  //    90ms good window. The window boundaries come from the document.
  const good = await pressAt(harness, BEAT_2 + 60);
  const s5 = await state(harness);
  evidence.good = { good, score: s5.score };
  const step5_good =
    good.judged === true &&
    good.judgement === 'good' &&
    good.deltaMs === 60 &&
    s5.score.good === 1 &&
    s5.score.combo === 2;

  // 6. The same note cannot be judged twice: a second press at the same instant
  //    finds nothing, and the score does not move.
  const doubled = await pressAt(harness, BEAT_2 + 60);
  const s6 = await state(harness);
  evidence.doubled = { doubled, score: s6.score, judgedIds: s6.judgedNoteIds };
  const step6_noDoubleJudge =
    doubled.judged === false &&
    s6.score.good === 1 &&
    s6.score.perfect === 1 &&
    s6.judgedNoteIds.filter((id) => id === 'beat-1').length === 1;

  // 7. A MISS: letting a note's whole window pass expires it exactly once, and
  //    breaks the combo.
  const comboBefore = (await state(harness)).score.combo;
  await evalShell(harness, `(s) => s.seek(${BEAT_4 + 400})`);
  await harness.stepFrames(6);
  const s7 = await state(harness);
  // Ticking again must not expire it a second time.
  await harness.stepFrames(6);
  const s7b = await state(harness);
  evidence.miss = { comboBefore, score: s7.score, scoreAfterSecondTick: s7b.score };
  const step7_miss =
    s7.score.miss >= 1 &&
    s7.score.combo === 0 &&
    comboBefore === 2 &&
    s7b.score.miss === s7.score.miss && // expired once, not twice
    // An expired note is judged by the service, not by a press, so the press log
    // must NOT contain it while the service's own record must - exactly once.
    s7.judgedNoteIds.includes('beat-2') === false &&
    s7b.allJudgedIds.filter((id) => id === 'beat-2').length === 1;

  // 8. Combo and accuracy track the run so far, and maxCombo remembers the peak.
  const s8 = await state(harness);
  const hits = s8.score.perfect + s8.score.good;
  const judgedTotal = hits + s8.score.miss;
  evidence.score = s8.score;
  const step8_score =
    s8.score.maxCombo === 2 &&
    s8.score.score === s8.score.perfect * 100 + s8.score.good * 50 &&
    // `accuracy` is reported rounded to four decimal places.
    Math.abs(s8.score.accuracy - hits / judgedTotal) < 1e-4;

  // 9. Pause: the transport stops, a press judges nothing, and nothing expires -
  //    a pause must not let a player farm notes at a frozen time, and must not
  //    silently miss the notes it froze over.
  await evalShell(harness, `(s) => s.pause()`);
  const pausedState = await state(harness);
  const pausedPress = await pressAt(harness, LANE_0, 'PRIMARY_ACTION', 'right');
  await harness.stepFrames(10);
  const s9 = await state(harness);
  evidence.paused = { status: pausedState.status, transport: pausedState.transportState, pausedPress, score: s9.score };
  const step9_pause =
    pausedState.status === 'paused' &&
    pausedState.transportState === 'paused' &&
    pausedPress.judged === false &&
    s9.score.miss === s8.score.miss && // nothing expired while paused
    s9.notesJudged === s8.notesJudged;

  // 10. Resume: the note the pause protected is still there, still judgeable,
  //     and judged exactly once. It is also a LANE note, matched by lane.
  await evalShell(harness, `(s) => s.resume()`);
  const wrongLane = await pressAt(harness, LANE_0, 'PRIMARY_ACTION', 'left');
  const rightLane = await pressAt(harness, LANE_0, 'PRIMARY_ACTION', 'right');
  const s10 = await state(harness);
  evidence.resumed = { status: s10.status, wrongLane, rightLane };
  const step10_resume =
    s10.status === 'playing' &&
    s10.transportState === 'playing' &&
    wrongLane.judged === false && // the lane is part of the match
    rightLane.judged === true &&
    rightLane.judgement === 'perfect' &&
    s10.lastNoteId === 'ms-0';

  // 11. Calibration shifts judgement by a bounded amount: a player who reads
  //     60ms late calibrates by -60 and their late press becomes perfect.
  await evalShell(harness, `(s) => s.setCalibration(-60)`);
  const calibrated = await pressAt(harness, 9750 + 60, 'PRIMARY_ACTION', 'right');
  const s11a = await state(harness);
  await evalShell(harness, `(s) => s.setCalibration(100000)`);
  const s11b = await state(harness);
  evidence.calibration = { calibrated, applied: s11a.calibrationMs, clamped: s11b.calibrationMs };
  const step11_calibration =
    s11a.calibrationMs === -60 &&
    calibrated.judged === true &&
    calibrated.judgement === 'perfect' &&
    calibrated.deltaMs === 0 &&
    s11b.calibrationMs === 200; // bounded, not unbounded

  // 12. Completion: once every note has been judged the chart finishes, and a
  //     restart re-arms it from a clean score.
  await evalShell(harness, `(s) => { s.setCalibration(0); s.seek(60000); }`);
  await harness.stepFrames(8);
  const finished = await state(harness);
  await evalShell(harness, `(s) => s.start()`);
  await harness.stepFrames(2);
  const restarted = await state(harness);
  evidence.finish = { status: finished.status, remaining: finished.notesRemaining, restarted: restarted.score };
  const step12_finishAndRestart =
    finished.status === 'finished' &&
    finished.notesRemaining === 0 &&
    finished.notesJudged === 12 &&
    restarted.status === 'playing' &&
    restarted.score.score === 0 &&
    restarted.notesRemaining === 12;

  const passed =
    step1_boot &&
    step2_inertBeforeStart &&
    step3_start &&
    step4_perfect &&
    step5_good &&
    step6_noDoubleJudge &&
    step7_miss &&
    step8_score &&
    step9_pause &&
    step10_resume &&
    step11_calibration &&
    step12_finishAndRestart;

  return {
    passed,
    details: {
      ...evidence,
      step1_boot,
      step2_inertBeforeStart,
      step3_start,
      step4_perfect,
      step5_good,
      step6_noDoubleJudge,
      step7_miss,
      step8_score,
      step9_pause,
      step10_resume,
      step11_calibration,
      step12_finishAndRestart,
    },
  };
}
