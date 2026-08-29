import { describe, expect, it } from 'vitest';
import { ClimbingServiceImpl, climbingPack, DEFAULT_CLIMBING_CONFIG } from '../src/climbing/climbingPack.ts';
import { CAPABILITY_IDS, PACK_IDS } from '../src/ids.ts';

describe('ClimbingServiceImpl', () => {
  it('initializes with default config and ground state', () => {
    const service = new ClimbingServiceImpl();
    expect(service.state().mode).toBe('ground');
    expect(service.state().wallSide).toBe(0);
    expect(service.config()).toEqual(DEFAULT_CLIMBING_CONFIG);
  });

  it('resets back to ground state when on ground', () => {
    const service = new ClimbingServiceImpl();
    const res = service.update(
      16,
      0,
      { moveAxis: 0, climbAxis: 0, jumpPressed: false },
      { onGround: true, touchingWallLeft: false, touchingWallRight: false },
    );
    expect(res.state.mode).toBe('ground');
    expect(res.state.canWallJump).toBe(false);
  });

  it('handles ladder climbing when on ladder with vertical input', () => {
    const service = new ClimbingServiceImpl({
      ...DEFAULT_CLIMBING_CONFIG,
      ladderClimbSpeed: 150,
    });
    const res = service.update(
      16,
      0,
      { moveAxis: 0, climbAxis: 1, jumpPressed: false },
      { onGround: false, touchingWallLeft: false, touchingWallRight: false, onLadder: true },
    );
    expect(res.state.mode).toBe('ladder-climb');
    expect(res.velocityY).toBe(-150);
  });

  it('grabs ledge when airborne within tolerances', () => {
    const service = new ClimbingServiceImpl();
    // Airborne near ledge
    const res = service.update(
      16,
      50,
      { moveAxis: 0, climbAxis: 0, jumpPressed: false },
      {
        onGround: false,
        touchingWallLeft: false,
        touchingWallRight: false,
        nearbyLedge: { x: 5, y: 10 },
      },
    );
    expect(res.state.mode).toBe('ledge-hang');
    expect(res.velocityX).toBe(0);
    expect(res.velocityY).toBe(0);
    expect(res.state.canWallJump).toBe(true);

    // Jump from ledge
    const jumpRes = service.update(
      16,
      0,
      { moveAxis: 1, climbAxis: 0, jumpPressed: true },
      {
        onGround: false,
        touchingWallLeft: false,
        touchingWallRight: false,
        nearbyLedge: { x: 5, y: 10 },
      },
    );
    expect(jumpRes.state.mode).toBe('air');
    expect(jumpRes.velocityY).toBe(-DEFAULT_CLIMBING_CONFIG.wallJumpVelocityY);
    expect(jumpRes.velocityX).toBe(100);
  });

  it('enters wall-stick and then transitions to wall-slide', () => {
    const service = new ClimbingServiceImpl({
      ...DEFAULT_CLIMBING_CONFIG,
      wallStickMs: 100,
      wallSlideMaxSpeed: 60,
      wallFriction: 0.2,
    });

    // Airborne touching right wall, moving right
    const stickRes = service.update(
      16,
      100,
      { moveAxis: 1, climbAxis: 0, jumpPressed: false },
      { onGround: false, touchingWallLeft: false, touchingWallRight: true },
    );
    expect(stickRes.state.mode).toBe('wall-stick');
    expect(stickRes.state.wallSide).toBe(1);
    expect(stickRes.velocityY).toBe(0);

    // Advance 120ms to exhaust stick timer
    const slideRes = service.update(
      120,
      200,
      { moveAxis: 1, climbAxis: 0, jumpPressed: false },
      { onGround: false, touchingWallLeft: false, touchingWallRight: true },
    );
    expect(slideRes.state.mode).toBe('wall-slide');
    expect(slideRes.velocityY).toBe(60); // Clamped to wallSlideMaxSpeed
  });

  it('executes wall jump turning direction away from wall', () => {
    const service = new ClimbingServiceImpl({
      ...DEFAULT_CLIMBING_CONFIG,
      wallJumpVelocityX: 250,
      wallJumpVelocityY: 300,
    });

    // Airborne touching left wall
    service.update(
      16,
      10,
      { moveAxis: -1, climbAxis: 0, jumpPressed: false },
      { onGround: false, touchingWallLeft: true, touchingWallRight: false },
    );

    // Press jump on wall
    const jumpRes = service.update(
      16,
      10,
      { moveAxis: 0, climbAxis: 0, jumpPressed: true },
      { onGround: false, touchingWallLeft: true, touchingWallRight: false },
    );

    expect(jumpRes.state.mode).toBe('air');
    // Away from left wall (wallSide = -1) -> vx = -(-1) * 250 = 250 (positive X)
    expect(jumpRes.velocityX).toBe(250);
    expect(jumpRes.velocityY).toBe(-300);
  });
});

describe('climbingPack', () => {
  it('provides movement.climbing capability', () => {
    expect(climbingPack.id).toBe(PACK_IDS.climbing);
    expect(climbingPack.provides).toEqual([CAPABILITY_IDS.climbing]);

    let providedService: unknown = null;
    const mockContext = {
      content: { data: {} },
      capabilities: {
        provide: (_id: string, svc: unknown) => {
          providedService = svc;
          return { dispose: () => {} };
        },
      },
    } as any;

    const installed = climbingPack.install(mockContext, {});
    expect(providedService).toBeInstanceOf(ClimbingServiceImpl);
    expect(() => installed.dispose()).not.toThrow();
  });
});
