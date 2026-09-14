import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface LocalPlay {
  readonly active: boolean;
  readonly mode: string | null;
  readonly currentPlayer: number;
  readonly scores: readonly number[];
  readonly turns: number;
  readonly winner: number | null;
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly axes: readonly number[];
  readonly gamepads: readonly { readonly seat: number; readonly index: number; readonly id: string; readonly connected: boolean }[];
  readonly views: readonly { readonly seat: number }[];
  readonly netplay: { readonly enabled: boolean; readonly role: string | null; readonly connected: boolean; readonly peerCount: number; readonly transport: string | null; readonly authority: string };
}
interface Shell {
  readonly localPlay?: LocalPlay;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const lp = async () => (await read()).localPlay!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await lp();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.local-play') && initial.active && initial.mode === 'hotseat' && initial.turns === 0 && initial.currentPlayer === 0 && initial.scores.length === 4 && initial.views.length === 4;

  // Synthetic standard-mapping controllers are assigned stably and publish simultaneous per-seat axes.
  await harness.page.evaluate(() => {
    const make = (index: number, vertical: number) => ({
      index, id: `qa-pad-${index}`, connected: true, mapping: 'standard', timestamp: 1,
      axes: [0, vertical, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })),
    });
    (window as unknown as { __QA_PADS__: unknown[] }).__QA_PADS__ = [make(3, -1), make(8, 1)];
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => (window as unknown as { __QA_PADS__: unknown[] }).__QA_PADS__ });
    window.dispatchEvent(new Event('gamepadconnected'));
  });
  await harness.stepFrames(4);
  const pads = await lp();
  const padsOk = pads.gamepads.length === 2 && pads.gamepads[0]?.seat === 0 && pads.gamepads[1]?.seat === 1 && pads.axes[0]! < -0.9 && pads.axes[1]! > 0.9;

  // Hot-seat: each act is owned by the current seat, then the seat passes.
  await harness.keyTap('KeyJ');
  const one = await lp();
  evidence.one = one;
  const seatOneOk = one.turns === 1 && one.currentPlayer === 1 && one.scores[0]! > 0 && one.scores[1] === 0;
  await harness.keyTap('KeyJ');
  const two = await lp();
  evidence.two = two;
  const seatTwoOk = two.turns === 2 && two.currentPlayer === 2 && two.scores[1]! > 0;

  // Play the round out to a decided winner.
  for (let i = 0; i < 6; i++) await harness.keyTap('KeyJ');
  const done = await lp();
  evidence.done = done;
  const doneOk = done.turns === 8 && done.winner !== null && done.outcome === 'complete' && done.scores.every((score) => score > 0);
  await harness.keyTap('KeyJ');
  const after = await lp();
  const inertOk = after.turns === 8;

  const run = await restartRun(harness);
  const fresh = await lp();
  evidence.restart = { ...run, turns: fresh.turns, winner: fresh.winner, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.turns === 0 && fresh.winner === null && fresh.outcome === 'playing';

  // Explicit opt-in, no-backend netplay: a guest page requests an action; only the host mutates authoritative state.
  const base = new URL(harness.page.url());
  base.search = '?netplay=host&room=qa';
  await harness.gotoAndWaitForRuntime(base.toString());
  await startPlay(harness);
  const guestUrl = new URL(base); guestUrl.search = '?netplay=guest&room=qa';
  const popup = harness.page.waitForEvent('popup');
  await harness.page.evaluate((url) => { window.open(url, '_blank'); }, guestUrl.toString());
  const guest = await popup;
  await guest.waitForLoadState('load');
  await guest.waitForFunction(() => Boolean((window as unknown as { __SW2D__?: unknown }).__SW2D__));
  await guest.evaluate(() => { (window as unknown as { __SW2D__: { phaser: { loop: { stop(): void } } } }).__SW2D__.phaser.loop.stop(); });
  const guestStep = async (frames: number): Promise<void> => guest.evaluate((count) => {
    const w = window as unknown as { __SW2D__: { phaser: { loop: { step(t: number): void; now: number } } }; __QA_T__?: number };
    const loop = w.__SW2D__.phaser.loop; w.__QA_T__ ??= loop.now;
    for (let i = 0; i < count; i++) { w.__QA_T__ += 16.67; loop.step(w.__QA_T__); }
  }, frames);
  await guest.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })));
  await guestStep(2);
  await guest.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })));
  await guestStep(10);
  await guest.waitForTimeout(80);
  await harness.stepFrames(3);
  const hostConnected = await lp();
  await guest.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true })));
  await guestStep(2);
  await guest.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ', bubbles: true })));
  await guestStep(3); await guest.waitForTimeout(80); await harness.stepFrames(3);
  const hostAfterGuest = await lp();
  const guestState = await guest.evaluate(() => {
    const snap = (window as unknown as { __SW2D__: { snapshot(): { extra: Record<string, unknown> } } }).__SW2D__.snapshot();
    return (snap.extra['game.ui-simulation-shell'] as Shell).localPlay!;
  });
  await guest.close(); await harness.page.waitForTimeout(80);
  const hostSurvives = await lp();
  evidence.netplay = { hostConnected: hostConnected.netplay, hostAfterGuest, guestState, hostSurvives: hostSurvives.netplay };
  const netplayOk = hostConnected.netplay.connected && hostConnected.netplay.authority === 'host' && hostAfterGuest.turns === 1 && guestState.turns === 1 && guestState.netplay.role === 'guest' && hostSurvives.outcome === 'playing';

  const passed = startedOk && padsOk && seatOneOk && seatTwoOk && doneOk && inertOk && restartOk && netplayOk;
  return { passed, details: { ...evidence, pads, startedOk, padsOk, seatOneOk, seatTwoOk, doneOk, inertOk, restartOk, netplayOk } };
}
