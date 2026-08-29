import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface StealthShellSnap {
  readonly x: number;
  readonly y: number;
  readonly guardX: number;
  readonly guardY: number;
  readonly guardStatus: 'calm' | 'suspicious' | 'alert' | 'investigating' | 'pursuit';
  readonly playerAwareness: number;
  readonly currentlyVisible: boolean;
  readonly lastKnownX: number | null;
  readonly lastKnownY: number | null;
  readonly investigationX: number | null;
  readonly investigationY: number | null;
  readonly isHiding: boolean;
  readonly noiseGenerated: boolean;
  readonly pursuitTriggered: boolean;
  readonly objectiveReached: boolean;
  readonly reachedUnseen: boolean;
}

function state(harness: Harness): Promise<StealthShellSnap> {
  return readShellState(harness, 'game.top-down-shell');
}

async function stepUntil(
  harness: Harness,
  label: string,
  predicate: (s: StealthShellSnap) => boolean,
  maxFrames: number,
): Promise<StealthShellSnap> {
  for (let i = 0; i < maxFrames; i++) {
    const snap = await state(harness);
    if (predicate(snap)) return snap;
    await harness.stepFrames(2);
  }
  const last = await state(harness);
  if (predicate(last)) return last;
  throw new Error(`Condition "${label}" not reached within ${maxFrames} frames (current state: ${JSON.stringify(last)})`);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  // 1. Launch & start
  await harness.keyTap('Space');
  await harness.stepFrames(10);
  const snap = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;

  const startedOk =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.ai-perception') &&
    initial.guardStatus === 'calm' &&
    initial.playerAwareness === 0 &&
    initial.currentlyVisible === false;

  // 2. Player navigates to (340, 200): right past wall, then up
  await harness.keyDown('ArrowRight');
  await stepUntil(harness, 'player right of wall', (s) => s.x >= 340, 150);
  await harness.keyUp('ArrowRight');

  await harness.keyDown('ArrowUp');
  await stepUntil(harness, 'player level with patrol line', (s) => s.y <= 200, 100);
  await harness.keyUp('ArrowUp');

  // Wait for guard to spot player
  const inFov = await stepUntil(
    harness,
    'player in guard FOV',
    (s) => s.playerAwareness > 0.1 && s.currentlyVisible === true,
    200,
  );
  evidence.inFov = inFov;
  const fovOk = inFov.currentlyVisible && inFov.playerAwareness > 0;

  // 3. Player moves behind wall: step left until x <= 200 (wall is [240, 280])
  await harness.keyDown('ArrowLeft');
  await stepUntil(harness, 'player left behind wall', (s) => s.x <= 200, 150);
  await harness.keyUp('ArrowLeft');

  const behindWall = await state(harness);
  evidence.behindWall = behindWall;
  const wallOcclusionOk = !behindWall.currentlyVisible && behindWall.lastKnownX !== null;

  // Wait briefly behind wall for awareness to decay down below alert
  await stepUntil(harness, 'awareness decays behind wall', (s) => s.playerAwareness < 0.1, 150);

  // 4. Noise distraction: press KeyK to throw pebble to (700, 200)
  await harness.keyTap('KeyK');
  await harness.stepFrames(10);
  const noiseState = await stepUntil(
    harness,
    'guard investigates noise',
    (s) => s.guardStatus === 'investigating' && s.investigationX !== null,
    100,
  );
  evidence.noiseState = noiseState;
  const noiseOk = noiseState.guardStatus === 'investigating' && noiseState.investigationX !== null;

  // 5. Player enters hiding zone: move left & down to (120, 300)
  await harness.keyDown('ArrowLeft');
  await harness.keyDown('ArrowDown');
  const hidingState = await stepUntil(
    harness,
    'player in hiding zone',
    (s) => s.isHiding === true,
    150,
  );
  await harness.keyUp('ArrowLeft');
  await harness.keyUp('ArrowDown');
  evidence.hidingState = hidingState;
  const hidingOk = hidingState.isHiding === true;

  // 6. Full detection and pursuit: player moves into guard patrol line
  await harness.keyDown('ArrowRight');
  await stepUntil(harness, 'player moves right of wall', (s) => s.x >= 340, 150);
  await harness.keyUp('ArrowRight');

  await harness.keyDown('ArrowUp');
  await stepUntil(harness, 'player moves up to patrol line', (s) => s.y <= 200, 100);
  await harness.keyUp('ArrowUp');

  const pursuitState = await stepUntil(
    harness,
    'guard reaches pursuit state',
    (s) => s.guardStatus === 'pursuit' && s.pursuitTriggered === true,
    250,
  );
  evidence.pursuitState = pursuitState;
  const pursuitOk = pursuitState.guardStatus === 'pursuit';

  // 7. Escape: retreat down away from guard to spawn (100, 440) so awareness decays
  await harness.keyDown('ArrowDown');
  await harness.keyDown('ArrowLeft');
  const escapedState = await stepUntil(
    harness,
    'player escapes and awareness decays to zero',
    (s) => s.y >= 400 && !s.currentlyVisible && s.guardStatus === 'calm' && s.playerAwareness === 0,
    400,
  );
  await harness.keyUp('ArrowDown');
  await harness.keyUp('ArrowLeft');
  evidence.escapedState = escapedState;
  const escapeOk = escapedState.guardStatus === 'calm' && escapedState.playerAwareness === 0;

  // 8. Reach exit: align with exit row if needed, then move right
  if (escapedState.y > 455) {
    await harness.keyDown('ArrowUp');
    await stepUntil(harness, 'align with exit row', (s) => s.y <= 445, 50);
    await harness.keyUp('ArrowUp');
  }

  await harness.keyDown('ArrowRight');
  const exitState = await stepUntil(
    harness,
    'objective reached at exit',
    (s) => s.objectiveReached === true,
    450,
  );
  await harness.keyUp('ArrowRight');
  evidence.exitState = exitState;
  const exitOk = exitState.objectiveReached === true;

  const passed =
    startedOk &&
    fovOk &&
    wallOcclusionOk &&
    noiseOk &&
    hidingOk &&
    pursuitOk &&
    escapeOk &&
    exitOk;

  return {
    passed,
    details: {
      startedOk,
      fovOk,
      wallOcclusionOk,
      noiseOk,
      hidingOk,
      pursuitOk,
      escapeOk,
      exitOk,
      evidence,
    },
  };
}
