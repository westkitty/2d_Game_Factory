import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface PrecisionShellSnap {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly mode: 'ground' | 'air' | 'wall-slide' | 'wall-stick' | 'ledge-hang' | 'ladder-climb';
  readonly wallSide: -1 | 1 | 0;
  readonly canWallJump: boolean;
  readonly ledgeX: number | null;
  readonly ledgeY: number | null;
  readonly wallSlideDemonstrated: boolean;
  readonly wallJumpDemonstrated: boolean;
  readonly ledgeHangDemonstrated: boolean;
  readonly ledgeClimbDemonstrated: boolean;
  readonly objectiveReached: boolean;
}

function state(harness: Harness): Promise<PrecisionShellSnap> {
  return readShellState(harness, 'game.platform-shell');
}

async function stepUntil(
  harness: Harness,
  label: string,
  predicate: (s: PrecisionShellSnap) => boolean,
  maxFrames: number,
): Promise<PrecisionShellSnap> {
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
  await stepUntil(harness, 'land on ground', (s) => s.mode === 'ground', 50);
  const snap = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;

  const startedOk =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.climbing') &&
    initial.mode === 'ground';

  // 2. Approach Left Wall (x=240) and jump up into it
  await harness.keyDown('ArrowLeft');
  await stepUntil(harness, 'approach Left Wall', (s) => s.x <= 260, 100);
  await harness.keyTap('Space'); // jump while pressing left into wall

  const wallSlideState = await stepUntil(
    harness,
    'enter wall slide on Left Wall',
    (s) => (s.mode === 'wall-slide' || s.mode === 'wall-stick') && s.wallSide === -1,
    150,
  );
  evidence.wallSlideState = wallSlideState;
  const wallSlideOk =
    wallSlideState.wallSlideDemonstrated ||
    wallSlideState.mode === 'wall-slide' ||
    wallSlideState.mode === 'wall-stick';

  // 3. Slow falling speed clamp verification
  // Wait a few frames while sliding down Left Wall
  await harness.stepFrames(5);
  const slidingSnap = await state(harness);
  evidence.slidingSnap = slidingSnap;
  // Falling speed should be clamped to <= 75 (wallSlideMaxSpeed is 70)
  const speedClampOk = slidingSnap.vy <= 75;

  // 4. Wall jump off Left Wall
  await harness.keyTap('Space'); // trigger wall jump
  await harness.keyUp('ArrowLeft');

  const wallJumpState = await stepUntil(
    harness,
    'wall jump off Left Wall',
    (s) => s.wallJumpDemonstrated || (s.mode === 'air' && s.vx > 0),
    100,
  );
  evidence.wallJumpState = wallJumpState;
  const wallJumpOk = wallJumpState.wallJumpDemonstrated || wallJumpState.vx > 0;

  // 5. Traversal across shaft to Right Wall / Ledge at (380, 160)
  await harness.keyDown('ArrowRight');
  const ledgeHangState = await stepUntil(
    harness,
    'grab ledge at top of Right Wall',
    (s) => s.mode === 'ledge-hang' || s.ledgeHangDemonstrated,
    250,
  );
  await harness.keyUp('ArrowRight');
  evidence.ledgeHangState = ledgeHangState;
  const ledgeHangOk = ledgeHangState.mode === 'ledge-hang' || ledgeHangState.ledgeHangDemonstrated;

  // 6. Vault / Climb up over ledge
  await harness.keyTap('Space');
  await harness.keyDown('ArrowRight');

  const climbedState = await stepUntil(
    harness,
    'climb up onto top platform',
    (s) => (s.y <= 310 && (s.mode === 'ground' || s.mode === 'air')) || s.ledgeClimbDemonstrated,
    150,
  );
  evidence.climbedState = climbedState;
  const climbOk =
    (climbedState.y <= 310 && (climbedState.mode === 'ground' || climbedState.mode === 'air')) ||
    climbedState.ledgeClimbDemonstrated;

  // 7. Move across top platform to Exit
  const exitState = await stepUntil(
    harness,
    'reach exit on top platform',
    (s) => s.objectiveReached === true,
    300,
  );
  await harness.keyUp('ArrowRight');
  evidence.exitState = exitState;
  const exitOk = exitState.objectiveReached === true;

  const passed =
    startedOk &&
    wallSlideOk &&
    speedClampOk &&
    wallJumpOk &&
    ledgeHangOk &&
    climbOk &&
    exitOk;

  return {
    passed,
    details: {
      startedOk,
      wallSlideOk,
      speedClampOk,
      wallJumpOk,
      ledgeHangOk,
      climbOk,
      exitOk,
      evidence,
    },
  };
}
