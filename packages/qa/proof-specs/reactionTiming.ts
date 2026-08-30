import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { ReactionShellState } from '../../proofs/reaction-timing/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.reaction-shell';

const state = (h: Harness): Promise<ReactionShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

/** Step frames until `predicate` holds or the budget runs out. */
async function stepUntil(
  harness: Harness,
  predicate: (s: ReactionShellState) => boolean,
  budgetFrames = 400,
): Promise<ReactionShellState> {
  let current = await state(harness);
  let stepped = 0;
  while (!predicate(current) && stepped < budgetFrames) {
    await harness.stepFrames(2);
    stepped += 2;
    current = await state(harness);
  }
  return current;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(10);

  // 1. Boot: the pack is installed, the machine is ready, nothing has run, and
  //    the authored round count is in force.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = { phase: s1.phase, rounds: s1.rounds, summary: s1.summary };
  const step1_boot =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.rhythm') &&
    snap.capabilities.includes('arcade.reaction') &&
    s1.phase === 'ready' &&
    s1.rounds === 3 &&
    s1.round === 0 &&
    s1.summary.completed === 0 &&
    s1.stimulusVisible === false;

  // 2. The REAL browser transport is installed here and is on the audio clock.
  //    The reaction test runs on simulation time and never consults it, so this
  //    is a free but genuine check that BrowserAudioTransport works in a page
  //    rather than only in unit tests.
  const started = await evalShell<string>(harness, `(s) => s.driveTransport('start')`);
  const paused = await evalShell<string>(harness, `(s) => s.driveTransport('pause')`);
  const resumed = await evalShell<string>(harness, `(s) => s.driveTransport('resume')`);
  const stopped = await evalShell<string>(harness, `(s) => s.driveTransport('stop')`);
  const s2 = await state(harness);
  evidence.transport = { usingAudioClock: s2.transportUsingAudioClock, started, paused, resumed, stopped };
  const step2_realTransport =
    s2.transportUsingAudioClock === true &&
    started === 'playing' &&
    paused === 'paused' &&
    resumed === 'playing' &&
    stopped === 'stopped';

  // 3. Begin: round 1 opens with a wait drawn from the authored seed, inside the
  //    authored bounds. A seeded draw is what makes the run replayable.
  await evalShell(harness, `(s) => s.begin()`);
  const s3 = await state(harness);
  evidence.wait = { phase: s3.phase, waitMs: s3.waitMs, round: s3.round };
  const step3_seededWait =
    s3.phase === 'wait' &&
    s3.round === 1 &&
    s3.waitMs >= 400 &&
    s3.waitMs <= 1200 && // the authored min/max
    s3.stimulusVisible === false;

  // 4. FALSE START: a press during the wait ends the round without a time, and
  //    the stimulus never appeared.
  await harness.keyTap('Enter'); // CONFIRM
  await harness.stepFrames(4);
  const s4 = await state(harness);
  evidence.falseStart = { phase: s4.phase, lastResult: s4.lastResult, summary: s4.summary };
  const step4_falseStart =
    s4.phase === 'result' &&
    s4.lastResult?.falseStart === true &&
    s4.lastResult.reactionMs === null &&
    s4.summary.falseStarts === 1 &&
    s4.stimulusVisible === false;

  // 5. Next round: the wait is drawn again and differs from round 1's, so a
  //    player cannot learn the interval.
  const round1Wait = s3.waitMs;
  await evalShell(harness, `(s) => s.next()`);
  const s5 = await state(harness);
  evidence.round2 = { phase: s5.phase, round: s5.round, waitMs: s5.waitMs, round1Wait };
  const step5_nextRound = s5.phase === 'wait' && s5.round === 2 && s5.waitMs !== round1Wait;

  // 6. The stimulus appears only after the wait elapses - not before.
  const beforeStimulus = await state(harness);
  const stimulated = await stepUntil(harness, (s) => s.phase === 'stimulus');
  evidence.stimulus = { before: beforeStimulus.phase, after: stimulated.phase, visible: stimulated.stimulusVisible };
  const step6_stimulus =
    beforeStimulus.phase === 'wait' &&
    stimulated.phase === 'stimulus' &&
    stimulated.stimulusVisible === true;

  // 7. A VALID RESPONSE records a positive reaction interval, measured from
  //    simulation time the service accumulated - not from a clock the shell read.
  await harness.stepFrames(6);
  await harness.keyTap('Enter');
  await harness.stepFrames(2);
  const s7 = await state(harness);
  evidence.response = { phase: s7.phase, lastResult: s7.lastResult };
  const step7_response =
    s7.phase === 'result' &&
    s7.lastResult?.falseStart === false &&
    typeof s7.lastResult.reactionMs === 'number' &&
    s7.lastResult.reactionMs > 0 &&
    s7.summary.completed === 2;

  // 8. TIMEOUT: letting the third round's stimulus go unanswered past the
  //    authored timeout ends it as a completed round with no time - not a false
  //    start, which is a different failure.
  await evalShell(harness, `(s) => s.next()`);
  await stepUntil(harness, (s) => s.phase === 'stimulus');
  const timedOut = await stepUntil(harness, (s) => s.phase === 'result', 600);
  evidence.timeout = { phase: timedOut.phase, lastResult: timedOut.lastResult };
  const step8_timeout =
    timedOut.phase === 'result' &&
    timedOut.lastResult?.falseStart === false &&
    timedOut.lastResult.reactionMs === null;

  // 9. SUMMARY: after the authored number of rounds the machine reaches the
  //    summary, and its statistics agree with the individual results.
  await evalShell(harness, `(s) => s.next()`);
  const s9 = await state(harness);
  const timed = s9.summary.results.filter((r) => r.reactionMs !== null).map((r) => r.reactionMs!);
  evidence.summary = s9.summary;
  const step9_summary =
    s9.phase === 'summary' &&
    s9.summary.rounds === 3 &&
    s9.summary.completed === 3 &&
    s9.summary.falseStarts === 1 &&
    s9.summary.results.length === 3 &&
    timed.length === 1 &&
    s9.summary.bestMs === Math.min(...timed) &&
    Math.abs((s9.summary.averageMs ?? 0) - timed.reduce((a, b) => a + b, 0) / timed.length) < 0.02;

  // 10. Reset returns to ready with a clean summary, and the run replays with
  //     the same seeded wait - the determinism the seed exists for.
  await evalShell(harness, `(s) => s.reset()`);
  const afterReset = await state(harness);
  await evalShell(harness, `(s) => s.begin()`);
  const replayed = await state(harness);
  evidence.replay = { afterReset: afterReset.phase, summary: afterReset.summary, waitMs: replayed.waitMs, round1Wait };
  const step10_resetAndReplay =
    afterReset.phase === 'ready' &&
    afterReset.summary.completed === 0 &&
    afterReset.summary.bestMs === null &&
    replayed.phase === 'wait' &&
    replayed.waitMs === round1Wait; // same seed, same round, same wait

  const passed =
    step1_boot &&
    step2_realTransport &&
    step3_seededWait &&
    step4_falseStart &&
    step5_nextRound &&
    step6_stimulus &&
    step7_response &&
    step8_timeout &&
    step9_summary &&
    step10_resetAndReplay;

  return {
    passed,
    details: {
      ...evidence,
      step1_boot,
      step2_realTransport,
      step3_seededWait,
      step4_falseStart,
      step5_nextRound,
      step6_stimulus,
      step7_response,
      step8_timeout,
      step9_summary,
      step10_resetAndReplay,
    },
  };
}
