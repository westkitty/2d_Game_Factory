import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAMEPAD_DEADZONE,
  InvalidPlayerRosterError,
  PLAYER_INPUT_CAPABILITY_ID,
  STANDARD_GAMEPAD_BINDINGS,
  STANDARD_GAMEPAD_STICKS,
  applyDeadzone,
  applyRadialDeadzone,
  deviceKey,
  sameDevice,
  validatePlayerRosterDocument,
  type PlayerRosterDocument,
} from '../src/index.ts';

describe('player input contract', () => {
  it('publishes the Phase 15 capability id', () => {
    expect(PLAYER_INPUT_CAPABILITY_ID).toBe('input.players');
  });

  it('keys devices stably and compares them by identity, not object reference', () => {
    expect(deviceKey({ kind: 'keyboard-profile', profileId: 'keyboard-left' })).toBe('keyboard-profile:keyboard-left');
    expect(deviceKey({ kind: 'gamepad-index', index: 2 })).toBe('gamepad-index:2');
    expect(sameDevice({ kind: 'gamepad-index', index: 2 }, { kind: 'gamepad-index', index: 2 })).toBe(true);
    expect(sameDevice({ kind: 'gamepad-index', index: 2 }, { kind: 'gamepad-index', index: 3 })).toBe(false);
    expect(
      sameDevice({ kind: 'keyboard-profile', profileId: 'a' }, { kind: 'gamepad-index', index: 0 }),
    ).toBe(false);
  });

  it('maps the standard gamepad layout by index, and never by vendor label', () => {
    // Movement is left stick OR d-pad; aim is the right stick (ADR-0016's digital AIM_*).
    expect(STANDARD_GAMEPAD_BINDINGS.MOVE_LEFT?.axes).toEqual([{ index: 0, direction: -1 }]);
    expect(STANDARD_GAMEPAD_BINDINGS.MOVE_LEFT?.buttons).toEqual([14]);
    expect(STANDARD_GAMEPAD_BINDINGS.AIM_UP?.axes).toEqual([{ index: 3, direction: -1 }]);
    // The bottom face button is jump and confirm, mirroring Space on the keyboard.
    expect(STANDARD_GAMEPAD_BINDINGS.JUMP?.buttons).toEqual([0]);
    expect(STANDARD_GAMEPAD_BINDINGS.CONFIRM?.buttons).toEqual([0]);
    expect(STANDARD_GAMEPAD_STICKS).toEqual([
      { id: 'left', xAxis: 0, yAxis: 1 },
      { id: 'right', xAxis: 2, yAxis: 3 },
    ]);
  });
});

describe('applyDeadzone', () => {
  const d = 0.25;

  it('zeroes a value inside the deadzone', () => {
    expect(applyDeadzone(0, d)).toBe(0);
    expect(applyDeadzone(0.1, d)).toBe(0);
    expect(applyDeadzone(-0.1, d)).toBe(0);
  });

  it('zeroes a value exactly at the boundary', () => {
    expect(applyDeadzone(0.25, d)).toBe(0);
    expect(applyDeadzone(-0.25, d)).toBe(0);
  });

  it('rescales a value above the boundary so motion starts from zero', () => {
    // (0.5 - 0.25) / (1 - 0.25) = 1/3
    expect(applyDeadzone(0.5, d)).toBeCloseTo(1 / 3, 10);
    expect(applyDeadzone(-0.5, d)).toBeCloseTo(-1 / 3, 10);
    // Just past the boundary is near zero, not a jump to 0.25.
    expect(applyDeadzone(0.26, d)).toBeCloseTo(0.013333, 5);
  });

  it('returns full deflection at the extremes', () => {
    expect(applyDeadzone(1, d)).toBe(1);
    expect(applyDeadzone(-1, d)).toBe(-1);
  });

  it('clamps beyond-range and non-finite input', () => {
    expect(applyDeadzone(1.5, d)).toBe(1);
    expect(applyDeadzone(-1.5, d)).toBe(-1);
    expect(applyDeadzone(Number.NaN, d)).toBe(0);
  });

  it('is a pass-through at deadzone 0', () => {
    expect(applyDeadzone(0.4, 0)).toBeCloseTo(0.4, 10);
    expect(applyDeadzone(0, 0)).toBe(0);
  });
});

describe('applyRadialDeadzone', () => {
  it('zeroes a diagonal push whose magnitude is inside the deadzone', () => {
    // magnitude 0.2828 < 0.3
    expect(applyRadialDeadzone(0.2, 0.2, 0.3)).toEqual({ x: 0, y: 0 });
  });

  it('keeps a diagonal push whose magnitude clears the deadzone', () => {
    // A per-axis deadzone of 0.25 would zero both components here; radial does not.
    const out = applyRadialDeadzone(0.24, 0.24, 0.25);
    expect(out.x).toBeGreaterThan(0);
    expect(out.y).toBeGreaterThan(0);
    expect(out.x).toBeCloseTo(out.y, 10);
  });

  it('preserves direction and reaches full magnitude at full deflection', () => {
    const out = applyRadialDeadzone(1, 0, 0.25);
    expect(out.x).toBeCloseTo(1, 10);
    expect(out.y).toBe(0);
    const diagonal = applyRadialDeadzone(-0.6, 0.8, 0.25); // magnitude exactly 1
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 10);
    expect(diagonal.x).toBeLessThan(0);
    expect(diagonal.y).toBeGreaterThan(0);
  });

  it('handles the origin and non-finite input', () => {
    expect(applyRadialDeadzone(0, 0, 0.25)).toEqual({ x: 0, y: 0 });
    expect(applyRadialDeadzone(Number.NaN, Number.NaN, 0.25)).toEqual({ x: 0, y: 0 });
  });
});

describe('validatePlayerRosterDocument', () => {
  const ok: PlayerRosterDocument = { schemaVersion: 1, minPlayers: 2, maxPlayers: 4, requireReady: true };

  it('accepts a well-formed roster', () => {
    expect(() => validatePlayerRosterDocument(ok)).not.toThrow();
    expect(() =>
      validatePlayerRosterDocument({ ...ok, maxPlayers: 2, playerIds: ['red', 'blue'] }),
    ).not.toThrow();
  });

  it('rejects a min above the max', () => {
    expect(() => validatePlayerRosterDocument({ ...ok, minPlayers: 5 })).toThrow(InvalidPlayerRosterError);
  });

  it('rejects non-integer or zero counts', () => {
    expect(() => validatePlayerRosterDocument({ ...ok, minPlayers: 0 })).toThrow(/minPlayers/);
    expect(() => validatePlayerRosterDocument({ ...ok, maxPlayers: 2.5 })).toThrow(/maxPlayers/);
  });

  it('rejects a playerIds list that disagrees with maxPlayers, or repeats an id', () => {
    expect(() => validatePlayerRosterDocument({ ...ok, playerIds: ['a', 'b'] })).toThrow(/maxPlayers is 4/);
    expect(() =>
      validatePlayerRosterDocument({ ...ok, maxPlayers: 2, minPlayers: 1, playerIds: ['a', 'a'] }),
    ).toThrow(/Duplicate playerId/);
  });

  it('rejects an out-of-range deadzone', () => {
    expect(() => validatePlayerRosterDocument({ ...ok, deadzone: { stick: 1, trigger: 0.1 } })).toThrow(/stick/);
    expect(() => validatePlayerRosterDocument({ ...ok, deadzone: { stick: 0.2, trigger: -0.1 } })).toThrow(/trigger/);
    expect(() => validatePlayerRosterDocument({ ...ok, deadzone: DEFAULT_GAMEPAD_DEADZONE })).not.toThrow();
  });
});
