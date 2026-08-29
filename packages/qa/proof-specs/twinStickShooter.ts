import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Proof B - twin-stick-shooter (see proofs/twin-stick-shooter/PROOF_CONTRACT.md).
 *
 * Every enemy sits on the player's spawn row (y=270) so a pure horizontal
 * aim (AIM_RIGHT) reaches all of them in turn - see the contract's note on
 * why aim independence is proven by holding perpendicular movement and aim
 * keys simultaneously, not by a diagonal shot.
 */

interface EnemyState {
  readonly alive: boolean;
  readonly health: number;
}

interface ShellSnap {
  readonly x: number;
  readonly y: number;
  readonly playerHealth: { readonly current: number; readonly max: number };
  readonly wave: 1 | 2;
  readonly wave1Cleared: boolean;
  readonly wave2Cleared: boolean;
  readonly score: number;
  readonly projectilesLive: number;
  readonly projectilesSpawned: number;
  readonly projectilesExpired: number;
  readonly pointerAimActive: boolean;
  readonly lastAimX: number;
  readonly lastAimY: number;
  readonly enemies: Readonly<Record<string, EnemyState>>;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.top-down-shell');
}

class ConditionNotReachedError extends Error {
  constructor(label: string, frames: number) {
    super(`condition "${label}" not reached within ${frames} frames`);
    this.name = 'ConditionNotReachedError';
  }
}

async function stepUntil(harness: Harness, label: string, predicate: (s: ShellSnap) => boolean, maxFrames: number): Promise<ShellSnap> {
  for (let i = 0; i < maxFrames; i++) {
    const snap = await state(harness);
    if (predicate(snap)) return snap;
    await harness.stepFrames(1);
  }
  const last = await state(harness);
  if (predicate(last)) return last;
  throw new ConditionNotReachedError(label, maxFrames);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  // 1. Launch/start.
  await harness.keyTap('Space');
  await harness.stepFrames(10);
  const spawnState = await state(harness);

  // 1b. Phase 1 (ADR-0018): with no digital AIM_* held, the mouse position is
  // an optional aim source. Moving the pointer up and to the right of the
  // player yields aimX > 0, aimY < 0 - without firing, and without touching the
  // digital axis the rest of this spec relies on.
  await harness.page.evaluate(() => {
    const canvas = (window as unknown as { __SW2D__: { phaser: { canvas: HTMLCanvasElement } } }).__SW2D__.phaser.canvas;
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: r.left + (900 / canvas.width) * r.width,
        clientY: r.top + (80 / canvas.height) * r.height,
        bubbles: true,
        pointerType: 'mouse',
      }),
    );
  });
  await harness.stepFrames(3);
  const pointerAiming = await state(harness);
  evidence.pointerAiming = pointerAiming;
  const pointerAimOk = pointerAiming.pointerAimActive === true && pointerAiming.lastAimX > 0 && pointerAiming.lastAimY < 0;

  // 2. Movement (down then back up) held simultaneously with independent aim (right) -
  // proves aim is not derived from movement by construction, not by inspection.
  await harness.keyDown('Numpad6'); // AIM_RIGHT
  await harness.keyDown('ArrowDown');
  await harness.stepFrames(10);
  const afterMoveDown = await state(harness);
  await harness.keyUp('ArrowDown');
  await harness.keyDown('ArrowUp');
  await harness.stepFrames(10);
  await harness.keyUp('ArrowUp');
  const afterMoveUp = await state(harness);
  evidence.spawnState = spawnState;
  evidence.afterMoveDown = afterMoveDown;
  evidence.afterMoveUp = afterMoveUp;
  const movementOk = afterMoveDown.y > spawnState.y && afterMoveUp.y < afterMoveDown.y;

  // 3/4/5. Fire repeatedly (aim held right throughout) - two hits kill enemy-1a, two more
  // kill enemy-1b, completing wave 1 and activating wave 2 (a projectile already in flight
  // at that moment goes on to also damage the newly-activated enemy-2a, which is real
  // projectile-lifecycle behavior, not a bug to work around).
  let wave1Cleared = false;
  for (let shot = 0; shot < 8 && !wave1Cleared; shot++) {
    await harness.keyTap('KeyX'); // PRIMARY_ACTION
    await harness.stepFrames(30);
    wave1Cleared = (await state(harness)).wave1Cleared;
  }
  await harness.keyUp('Numpad6');
  const afterWave1 = await state(harness);
  evidence.afterWave1 = afterWave1;
  const wave1Ok =
    afterWave1.wave1Cleared === true &&
    afterWave1.wave === 2 &&
    !afterWave1.enemies['enemy-1a']?.alive &&
    !afterWave1.enemies['enemy-1b']?.alive &&
    afterWave1.score >= 20;
  const projectileFiredOk = afterWave1.projectilesSpawned > 0;
  const projectileLifecycleOk = afterWave1.projectilesExpired + afterWave1.projectilesLive === afterWave1.projectilesSpawned;

  // 6. Walk into a live wave-2 enemy for real contact damage.
  const aliveWave2Id = Object.entries(afterWave1.enemies).find(([id, s]) => id.startsWith('enemy-2') && s.alive)?.[0];
  await harness.keyDown('ArrowRight');
  const afterContact = await stepUntil(harness, 'took contact damage from a wave-2 enemy', (s) => s.playerHealth.current < s.playerHealth.max, 400);
  await harness.keyUp('ArrowRight');
  evidence.aliveWave2Id = aliveWave2Id;
  evidence.afterContact = afterContact;
  const contactDamageOk = afterContact.playerHealth.current === afterContact.playerHealth.max - 10;

  // 7. Pause: score, projectile-live-count and position must not change while paused.
  await harness.keyTap('KeyP'); // PAUSE
  const pausedFirst = await state(harness);
  await harness.stepFrames(90);
  const pausedSecond = await state(harness);
  const pausedHoldsOk =
    pausedSecond.score === pausedFirst.score &&
    pausedSecond.projectilesLive === pausedFirst.projectilesLive &&
    pausedSecond.x === pausedFirst.x &&
    pausedSecond.y === pausedFirst.y;

  // Resume, then prove the scene is interactive again with one more real action.
  await harness.keyTap('Space'); // CONFIRM -> resume
  await harness.stepFrames(5);
  await harness.keyDown('Numpad4'); // AIM_LEFT - any independent aim direction proves interactivity resumed
  await harness.keyTap('KeyX');
  await harness.stepFrames(10);
  await harness.keyUp('Numpad4');
  const afterResume = await state(harness);
  evidence.pausedFirst = pausedFirst;
  evidence.pausedSecond = pausedSecond;
  evidence.afterResume = afterResume;
  const resumesAfterUnpauseOk = afterResume.projectilesSpawned > pausedSecond.projectilesSpawned;

  // 8. Restart: pause, then SECONDARY_ACTION. The whole play scene stops and reinstalls,
  // so a fresh ProjectilePool proves this is a real reinstall, not a game-specific reset flag.
  await harness.keyTap('KeyP'); // PAUSE
  await harness.stepFrames(5);
  await harness.keyTap('KeyK'); // SECONDARY_ACTION -> restart
  await harness.stepFrames(15);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    afterRestart.score === 0 &&
    afterRestart.playerHealth.current === afterRestart.playerHealth.max &&
    afterRestart.wave === 1 &&
    afterRestart.wave1Cleared === false &&
    afterRestart.projectilesSpawned === 0 &&
    afterRestart.projectilesLive === 0 &&
    afterRestart.projectilesExpired === 0 &&
    Object.values(afterRestart.enemies).every((e) => e.alive && e.health === 20);

  const passed =
    pointerAimOk &&
    movementOk &&
    wave1Ok &&
    projectileFiredOk &&
    projectileLifecycleOk &&
    contactDamageOk &&
    pausedHoldsOk &&
    resumesAfterUnpauseOk &&
    restartOk;

  return {
    passed,
    details: {
      ...evidence,
      pointerAimOk,
      movementOk,
      wave1Ok,
      projectileFiredOk,
      projectileLifecycleOk,
      contactDamageOk,
      pausedHoldsOk,
      resumesAfterUnpauseOk,
      restartOk,
    },
  };
}
