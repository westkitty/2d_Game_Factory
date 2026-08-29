import { describe, expect, it } from 'vitest';
import { ClimbingServiceImpl, DEFAULT_CLIMBING_CONFIG } from '@sw2d/packs';
import { createClimbingRuntime } from '../src/game-support/climbingRuntime.ts';

describe('climbingRuntime', () => {
  it('bridges body collision contacts to ClimbingService', () => {
    let vx = 0;
    let vy = 150;
    const mockBody = {
      x: 100,
      y: 200,
      center: { x: 116, y: 216 },
      velocity: { x: vx, y: vy },
      blocked: { down: false, left: false, right: true },
      touching: { down: false, left: false, right: false },
      setVelocityX(val: number) {
        vx = val;
      },
      setVelocityY(val: number) {
        vy = val;
      },
    } as any;

    const service = new ClimbingServiceImpl({
      ...DEFAULT_CLIMBING_CONFIG,
      wallSlideMaxSpeed: 50,
      wallFriction: 0.2,
      wallStickMs: 0,
    });

    const runtime = createClimbingRuntime({
      body: mockBody,
      service,
    });

    // Move into right wall
    const res = runtime.update(16, { moveAxis: 1, climbAxis: 0, jumpPressed: false });
    expect(res.state.mode).toBe('wall-slide');
    expect(res.state.wallSide).toBe(1);
    expect(vy).toBe(50); // Clamped via setVelocityY
  });

  it('supports ledge registration and queries', () => {
    let vx = 0;
    let vy = 0;
    const mockBody = {
      x: 100,
      y: 100,
      center: { x: 110, y: 116 },
      velocity: { x: vx, y: vy },
      blocked: { down: false, left: false, right: false },
      touching: { down: false, left: false, right: false },
      setVelocityX(val: number) {
        vx = val;
      },
      setVelocityY(val: number) {
        vy = val;
      },
    } as any;

    const service = new ClimbingServiceImpl();
    const runtime = createClimbingRuntime({
      body: mockBody,
      service,
    });

    runtime.registerLedge(110, 100);
    const res = runtime.update(16, { moveAxis: 0, climbAxis: 0, jumpPressed: false });
    expect(res.state.mode).toBe('ledge-hang');
    expect(runtime.state().mode).toBe('ledge-hang');
  });
});
