import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ClimbingGameSnap {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly mode: 'ground' | 'air' | 'wall-slide' | 'wall-stick' | 'ledge-hang' | 'ladder-climb';
  readonly wallSide: -1 | 1 | 0;
  readonly canWallJump: boolean;
  readonly ledgeX: number | null;
  readonly ledgeY: number | null;
  readonly wallSlideLeftDemonstrated: boolean;
  readonly wallSlideRightDemonstrated: boolean;
  readonly wallJumpLeftDemonstrated: boolean;
  readonly wallToWallDemonstrated: boolean;
  readonly ledgeDetected: boolean;
  readonly ledgeGrabDemonstrated: boolean;
  readonly ledgeDropDemonstrated: boolean;
  readonly recoveryDemonstrated: boolean;
  readonly ledgeClimbDemonstrated: boolean;
  readonly objectiveReached: boolean;
}

function state(harness: Harness): Promise<ClimbingGameSnap> {
  return readShellState(harness, 'game.platform-shell');
}

async function stepUntil(
  harness: Harness,
  label: string,
  predicate: (s: ClimbingGameSnap) => boolean,
  maxFrames: number,
): Promise<ClimbingGameSnap> {
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

  // 2. Approach Left Wall (x=240) and jump into it -> wall slide
  await harness.keyDown('ArrowLeft');
  await stepUntil(harness, 'approach Left Wall', (s) => s.x <= 260, 80);
  await harness.keyTap('Space'); // jump into left wall
  await stepUntil(harness, 'enter wall slide on Left Wall', (s) => (s.mode === 'wall-slide' || s.mode === 'wall-stick') && s.wallSide === -1, 120);

  // Clamped slide velocity check
  await harness.stepFrames(5);
  const slidingSnap = await state(harness);
  evidence.slidingSnap = slidingSnap;
  const wallSlideOk = slidingSnap.wallSlideLeftDemonstrated && slidingSnap.vy <= 75;

  // 3. Wall jump off Left Wall toward Right Wall (wall-to-wall movement)
  await harness.keyUp('ArrowLeft');
  await harness.keyTap('Space'); // wall jump away from left wall (vx > 0)
  await harness.keyDown('ArrowRight'); // guide toward right wall

  const wallToWallState = await stepUntil(
    harness,
    'catch Right Wall (wall-to-wall)',
    (s) => s.wallSide === 1 && (s.mode === 'wall-slide' || s.mode === 'wall-stick' || s.wallToWallDemonstrated),
    150,
  );
  evidence.wallToWallState = wallToWallState;
  const wallToWallOk = wallToWallState.wallToWallDemonstrated || wallToWallState.wallSide === 1;

  // 4. Wall jump off Right Wall back toward Left Wall
  await harness.keyUp('ArrowRight');
  await harness.keyTap('Space'); // wall jump away from right wall (vx < 0)
  await harness.keyDown('ArrowLeft'); // guide toward left wall

  await stepUntil(
    harness,
    'catch Left Wall on rebound',
    (s) => s.wallSide === -1 && (s.mode === 'wall-slide' || s.mode === 'wall-stick'),
    150,
  );

  // 5. Wall jump off Left Wall toward top platform ledge at (360, 240)
  await harness.keyUp('ArrowLeft');
  await harness.keyTap('Space'); // wall jump away from left wall (vx > 0)
  await harness.keyDown('ArrowRight'); // hold right towards ledge corner

  const ledgeHangState = await stepUntil(
    harness,
    'grab ledge at top of Right Wall',
    (s) => s.mode === 'ledge-hang' || s.ledgeGrabDemonstrated,
    150,
  );
  evidence.ledgeHangState = ledgeHangState;
  const ledgeGrabOk = ledgeHangState.ledgeGrabDemonstrated && (ledgeHangState.ledgeDetected || ledgeHangState.ledgeX !== null);

  // 6. Ledge drop (press Down to release and drop) -> failed attempt & recovery
  await harness.keyUp('ArrowRight');
  await harness.keyDown('ArrowDown');
  await harness.stepFrames(6);
  await harness.keyUp('ArrowDown');

  const dropState = await stepUntil(
    harness,
    'drop from ledge down to ground/air',
    (s) => s.ledgeDropDemonstrated || s.mode === 'ground',
    100,
  );
  evidence.dropState = dropState;
  const ledgeDropOk = dropState.ledgeDropDemonstrated;

  // Recover safely on ground
  const recoveredState = await stepUntil(
    harness,
    'recover safely after drop',
    (s) => s.mode === 'ground',
    120,
  );
  evidence.recoveredState = recoveredState;
  const recoveryOk = recoveredState.recoveryDemonstrated || recoveredState.mode === 'ground';

  // 7. Jump back up shaft to grab ledge again
  await harness.keyDown('ArrowLeft');
  await harness.keyTap('Space');
  await stepUntil(
    harness,
    're-enter Left Wall',
    (s) => s.wallSide === -1 && (s.mode === 'wall-slide' || s.mode === 'wall-stick'),
    100,
  );
  await harness.keyUp('ArrowLeft');
  await harness.keyTap('Space');
  await harness.keyDown('ArrowRight');
  await stepUntil(
    harness,
    're-catch Right Wall',
    (s) => s.wallSide === 1 && (s.mode === 'wall-slide' || s.mode === 'wall-stick'),
    100,
  );
  await harness.keyUp('ArrowRight');
  await harness.keyTap('Space');
  await harness.keyDown('ArrowLeft');
  await stepUntil(
    harness,
    're-catch Left Wall higher up',
    (s) => s.wallSide === -1 && (s.mode === 'wall-slide' || s.mode === 'wall-stick'),
    100,
  );
  await harness.keyUp('ArrowLeft');
  await harness.keyTap('Space');
  await harness.keyDown('ArrowRight');

  await stepUntil(
    harness,
    'grab ledge second time',
    (s) => s.mode === 'ledge-hang',
    150,
  );

  // 8. Ledge climb (press Up to vault up onto the top platform)
  await harness.keyDown('ArrowUp');
  await harness.stepFrames(10);
  await harness.keyUp('ArrowUp');

  const climbedState = await stepUntil(
    harness,
    'climb up onto top platform',
    (s) => s.ledgeClimbDemonstrated || s.y <= 240,
    100,
  );
  evidence.climbedState = climbedState;
  const ledgeClimbOk = climbedState.ledgeClimbDemonstrated || climbedState.y <= 240;

  // 9. Walk across platform to exit
  await harness.keyDown('ArrowRight');
  const exitState = await stepUntil(
    harness,
    'reach exit objective',
    (s) => s.objectiveReached || s.x >= 700,
    150,
  );
  await harness.keyUp('ArrowRight');
  evidence.exitState = exitState;
  const objectiveOk = exitState.objectiveReached || exitState.x >= 700;

  // 9. Restart scene (KeyP, KeyK) to verify clean teardown without duplicate resources
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(14);
  const restartedSnap = await readSnapshot(harness);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    restartedSnap.scene === 'sw2d.play' &&
    restartedSnap.installedPacks.includes('sw2d.climbing') &&
    afterRestart.mode === 'ground';

  const passed =
    startedOk &&
    wallSlideOk &&
    wallToWallOk &&
    ledgeGrabOk &&
    ledgeDropOk &&
    recoveryOk &&
    ledgeClimbOk &&
    objectiveOk &&
    restartOk;

  return {
    passed,
    details: {
      startedOk,
      wallSlideOk,
      wallToWallOk,
      ledgeGrabOk,
      ledgeDropOk,
      recoveryOk,
      ledgeClimbOk,
      objectiveOk,
      restartOk,
      evidence,
    },
  };
}
