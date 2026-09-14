import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface PhysicsPlay {
  readonly active: boolean;
  readonly mode: string | null;
  readonly ballX: number;
  readonly ballY: number;
  readonly score: number;
  readonly flips: number;
  readonly lastResult: string | null;
  readonly balls: number;
  readonly outcome: string;
}
interface Shell {
  readonly physicsPlay?: PhysicsPlay;
}

// The generated table's flippers (content/pinball.json). Read here so the
// spec flips only when a real player could - ball over the flipper.
const FLIPPERS = [
  { key: 'KeyJ', x: 320, y: 480, halfWidth: 90 },
  { key: 'KeyK', x: 640, y: 480, halfWidth: 90 },
] as const;

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const pp = async () => (await read()).physicsPlay!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 4);
  const booted = await readSnapshot(harness);
  const initial = await pp();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.pinball') && initial.mode === 'table' && initial.outcome === 'playing' && initial.score === 0 && initial.flips === 0 && initial.balls === 3;

  // Hands off: the ball falls under gravity, misses every bumper, drains, and the table resets it - no score.
  await harness.stepFrames(6);
  const falling = await pp();
  const fallOk = falling.ballY > initial.ballY;
  const drained = (await waitUntil(harness, read, (s) => s.physicsPlay?.lastResult === 'drain', 80, 4)).physicsPlay!;
  evidence.drained = { last: drained.lastResult, score: drained.score, ballY: drained.ballY };
  const drainOk = drained.lastResult === 'drain' && drained.score === 0 && drained.ballY < 200 && drained.balls === 2;

  // Now play: flip whenever the ball is over a flipper. Bumper hits score; the win needs the flips.
  let live = drained;
  let flipsPressed = 0;
  let bumperHits = 0;
  for (let i = 0; i < 400 && live.outcome !== 'complete'; i++) {
    for (const f of FLIPPERS) {
      if (Math.abs(live.ballX - f.x) <= f.halfWidth && Math.abs(live.ballY - f.y) <= 36) {
        await harness.keyTap(f.key);
        flipsPressed += 1;
      }
    }
    await harness.stepFrames(2);
    const next = await pp();
    if (next.score > live.score) bumperHits += 1;
    live = next;
  }
  evidence.played = { score: live.score, flips: live.flips, flipsPressed, bumperHits, last: live.lastResult, outcome: live.outcome };
  const winOk = live.outcome === 'complete' && live.score >= 3 && live.lastResult === 'score';
  const flipsLoadBearingOk = flipsPressed > 0 && live.flips === flipsPressed && bumperHits >= 1;

  const run = await restartRun(harness);
  const fresh = await pp();
  evidence.restart = { ...run, score: fresh.score, flips: fresh.flips, ballY: fresh.ballY, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.score === 0 && fresh.flips === 0 && fresh.outcome === 'playing';

  const passed = startedOk && fallOk && drainOk && winOk && flipsLoadBearingOk && restartOk;
  return { passed, details: { ...evidence, startedOk, fallOk, drainOk, winOk, flipsLoadBearingOk, restartOk } };
}
