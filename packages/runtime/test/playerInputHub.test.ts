import { describe, expect, it } from 'vitest';
import type { GamepadSnapshot, GamepadSource, PlayerRosterConfig } from '@sw2d/contracts';
import { ActionInputHost } from '../src/input/ActionInputHost.ts';
import { GamepadAdapter } from '../src/input/GamepadAdapter.ts';
import { PlayerInputHub } from '../src/input/PlayerInputHub.ts';
import { DEFAULT_BINDINGS } from '../src/input/defaultBindings.ts';
import { KeyboardAdapter } from '../src/input/KeyboardAdapter.ts';
import {
  DEFAULT_KEYBOARD_PROFILES,
  KEYBOARD_PROFILE_LEFT,
  keyboardProfileConflicts,
  mergeKeyboardProfiles,
} from '../src/input/keyboardProfiles.ts';

/**
 * A keyboard event good enough for the adapter, built without a DOM: the adapter
 * reads `code` and `repeat` and calls `preventDefault`, all of which a plain
 * `Event` carries or tolerates. Using the real `EventTarget` keeps the
 * listener-attachment behaviour under test rather than mocked away.
 */
function keyEvent(type: 'keydown' | 'keyup', code: string): Event {
  return Object.assign(new Event(type), { code, repeat: false });
}

function pad(index: number, overrides: Partial<GamepadSnapshot> = {}): GamepadSnapshot {
  return {
    index,
    connected: true,
    id: `test-pad-${index}`,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: new Array(17).fill(0),
    ...overrides,
  };
}

/** A scripted gamepad source. `set(null)` models an unplugged slot. */
function scriptedPads(initial: (GamepadSnapshot | null)[] = []) {
  let pads: (GamepadSnapshot | null)[] = initial;
  const source: GamepadSource = () => pads;
  return {
    source,
    set(next: (GamepadSnapshot | null)[]): void {
      pads = next;
    },
  };
}

const ROSTER: PlayerRosterConfig = { minPlayers: 2, maxPlayers: 2, requireReady: true };

function hub(config: Partial<PlayerRosterConfig> = {}, source?: GamepadSource) {
  const target = new EventTarget();
  const instance = new PlayerInputHub(
    { ...ROSTER, ...config },
    { keyboardTarget: target, ...(source ? { gamepadSource: source } : {}) },
  );
  return { instance, target };
}

describe('keyboard profiles', () => {
  it('ships two profiles that share no physical key', () => {
    expect(DEFAULT_KEYBOARD_PROFILES.map((p) => p.id)).toEqual(['keyboard-left', 'keyboard-right']);
    expect(keyboardProfileConflicts(DEFAULT_KEYBOARD_PROFILES)).toEqual([]);
  });

  it('reports a conflict when authored profiles overlap', () => {
    const clash = { id: 'clash', displayName: 'Clash', bindings: { MOVE_LEFT: { keyboard: ['KeyA'] } } };
    expect(keyboardProfileConflicts([KEYBOARD_PROFILE_LEFT, clash])).toEqual(['KeyA']);
  });

  it('leaves PAUSE unbound so two players cannot fight over one pause edge', () => {
    for (const profile of DEFAULT_KEYBOARD_PROFILES) {
      expect(profile.bindings.PAUSE).toBeUndefined();
    }
    // It is still bound globally, which is where a system action belongs.
    expect(DEFAULT_BINDINGS.PAUSE?.keyboard).toContain('Escape');
  });

  it('merges overrides by id, keeping default order and appending new profiles', () => {
    const replaced = { ...KEYBOARD_PROFILE_LEFT, displayName: 'Custom left' };
    const extra = { id: 'third', displayName: 'Third', bindings: {} };
    const merged = mergeKeyboardProfiles([extra, replaced]);
    expect(merged.map((p) => p.id)).toEqual(['keyboard-left', 'keyboard-right', 'third']);
    expect(merged[0]!.displayName).toBe('Custom left');
    expect(mergeKeyboardProfiles(undefined)).toBe(DEFAULT_KEYBOARD_PROFILES);
  });
});

describe('PlayerInputHub roster', () => {
  it('builds slots in a stable order, generating ids when none are authored', () => {
    const { instance } = hub({ maxPlayers: 3, minPlayers: 1 });
    expect(instance.players().map((s) => s.playerId)).toEqual(['p1', 'p2', 'p3']);
    expect(instance.players().map((s) => s.index)).toEqual([0, 1, 2]);
    expect(instance.players().every((s) => s.state === 'empty')).toBe(true);
    instance.dispose();
  });

  it('honours authored slot ids', () => {
    const { instance } = hub({ maxPlayers: 2, playerIds: ['red', 'blue'] });
    expect(instance.players().map((s) => s.playerId)).toEqual(['red', 'blue']);
    instance.dispose();
  });

  it('joins, readies and leaves, tracking the derived join state', () => {
    const { instance } = hub();
    expect(instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' }).ok).toBe(true);
    expect(instance.slot('p1')?.state).toBe('joined');
    expect(instance.setReady('p1', true)).toBe(true);
    expect(instance.slot('p1')?.state).toBe('ready');
    expect(instance.readyPlayers().map((s) => s.playerId)).toEqual(['p1']);

    expect(instance.leave('p1')).toBe(true);
    expect(instance.slot('p1')?.state).toBe('empty');
    expect(instance.slot('p1')?.device).toBeNull();
    expect(instance.leave('p1')).toBe(false);
    instance.dispose();
  });

  it('rejects unknown players, double joins and unknown devices', () => {
    const { instance } = hub();
    expect(instance.join('nobody', { kind: 'keyboard-profile', profileId: 'keyboard-left' })).toMatchObject({
      ok: false,
      reason: 'unknown-player',
    });
    expect(instance.join('p1', { kind: 'keyboard-profile', profileId: 'does-not-exist' })).toMatchObject({
      ok: false,
      reason: 'unknown-device',
    });
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    expect(instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-right' })).toMatchObject({
      ok: false,
      reason: 'already-joined',
    });
    expect(instance.setReady('p2', true)).toBe(false); // not joined
    instance.dispose();
  });

  it('enforces exclusive device ownership by default', () => {
    const { instance } = hub();
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    expect(instance.join('p2', { kind: 'keyboard-profile', profileId: 'keyboard-left' })).toMatchObject({
      ok: false,
      reason: 'device-taken',
    });
    expect(instance.join('p2', { kind: 'keyboard-profile', profileId: 'keyboard-right' }).ok).toBe(true);
    instance.dispose();
  });

  it('frees a device when its owner leaves or releases it', () => {
    const { instance } = hub();
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    expect(instance.availableDevices().map((d) => (d.kind === 'keyboard-profile' ? d.profileId : d.kind))).toEqual([
      'keyboard-right',
    ]);

    expect(instance.releaseDevice('p1')).toBe(true);
    expect(instance.inputForPlayer('p1')).toBeUndefined();
    expect(instance.availableDevices()).toHaveLength(2);
    expect(instance.releaseDevice('p1')).toBe(false);

    instance.join('p2', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    expect(instance.slot('p2')?.device).toEqual({ kind: 'keyboard-profile', profileId: 'keyboard-left' });
    instance.dispose();
  });

  it('reassigns a device to a joined player and rebuilds that channel', () => {
    const { instance, target } = hub();
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    target.dispatchEvent(keyEvent('keydown', 'KeyD'));
    instance.update();
    expect(instance.inputForPlayer('p1')!.isDown('MOVE_RIGHT')).toBe(true);

    expect(instance.assignDevice('p1', { kind: 'keyboard-profile', profileId: 'keyboard-right' }).ok).toBe(true);
    instance.update();
    // The old channel is gone; the held KeyD no longer reaches the player.
    expect(instance.inputForPlayer('p1')!.isDown('MOVE_RIGHT')).toBe(false);

    target.dispatchEvent(keyEvent('keydown', 'ArrowRight'));
    instance.update();
    expect(instance.inputForPlayer('p1')!.isDown('MOVE_RIGHT')).toBe(true);

    // A slot that has not joined has no channel to reassign.
    expect(instance.assignDevice('p2', { kind: 'keyboard-profile', profileId: 'keyboard-left' })).toMatchObject({
      ok: false,
      reason: 'not-joined',
    });
    expect(instance.assignDevice('nobody', { kind: 'keyboard-profile', profileId: 'keyboard-left' })).toMatchObject({
      ok: false,
      reason: 'unknown-player',
    });
    // Reassigning to the device already held is a no-op success, not a conflict.
    expect(instance.assignDevice('p1', { kind: 'keyboard-profile', profileId: 'keyboard-right' }).ok).toBe(true);
    expect(instance.inputForPlayer('p1')!.isDown('MOVE_RIGHT')).toBe(true);
    instance.dispose();
  });

  it('keeps exactly one adapter per seated player across rejoins', () => {
    const { instance } = hub();
    expect(instance.adapterCount).toBe(0);
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    instance.join('p2', { kind: 'keyboard-profile', profileId: 'keyboard-right' });
    expect(instance.adapterCount).toBe(2);

    instance.leave('p1');
    expect(instance.adapterCount).toBe(1);
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    expect(instance.adapterCount).toBe(2);

    // Reassignment rebuilds a channel; it must not leave the old one attached.
    instance.assignDevice('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    expect(instance.adapterCount).toBe(2);
    instance.dispose();
    expect(instance.adapterCount).toBe(0);
  });

  it('reports canStart against minPlayers and requireReady', () => {
    const { instance } = hub({ minPlayers: 2, maxPlayers: 2, requireReady: true });
    expect(instance.canStart()).toBe(false);
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    expect(instance.canStart()).toBe(false); // below minPlayers
    instance.join('p2', { kind: 'keyboard-profile', profileId: 'keyboard-right' });
    expect(instance.canStart()).toBe(false); // not ready
    instance.setReady('p1', true);
    instance.setReady('p2', true);
    expect(instance.canStart()).toBe(true);
    instance.setReady('p2', false);
    expect(instance.canStart()).toBe(false);
    instance.dispose();
  });

  it('ignores readiness when requireReady is off', () => {
    const { instance } = hub({ minPlayers: 1, maxPlayers: 2, requireReady: false });
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    expect(instance.canStart()).toBe(true);
    instance.dispose();
  });
});

describe('PlayerInputHub keyboard isolation', () => {
  it('routes each profile only to its own player', () => {
    const { instance, target } = hub();
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    instance.join('p2', { kind: 'keyboard-profile', profileId: 'keyboard-right' });
    const one = instance.inputForPlayer('p1')!;
    const two = instance.inputForPlayer('p2')!;

    // Player one presses left; player two must see nothing.
    target.dispatchEvent(keyEvent('keydown', 'KeyA'));
    instance.update();
    expect(one.isDown('MOVE_LEFT')).toBe(true);
    expect(two.isDown('MOVE_LEFT')).toBe(false);
    // Nothing at all reached player two's channel - not a filtered edge, an empty one.
    expect(Object.values(two.values()).every((v) => v === 0)).toBe(true);

    // Player two presses right at the same time; both are simultaneously true
    // on their own channels and false on the other's.
    target.dispatchEvent(keyEvent('keydown', 'ArrowRight'));
    instance.update();
    expect(one.isDown('MOVE_LEFT')).toBe(true);
    expect(one.isDown('MOVE_RIGHT')).toBe(false);
    expect(two.isDown('MOVE_RIGHT')).toBe(true);
    expect(two.isDown('MOVE_LEFT')).toBe(false);

    // Opposite paddle intent in one frame - the Pong foundation.
    expect(one.axis('MOVE_LEFT', 'MOVE_RIGHT')).toBe(-1);
    expect(two.axis('MOVE_LEFT', 'MOVE_RIGHT')).toBe(1);

    target.dispatchEvent(keyEvent('keyup', 'KeyA'));
    instance.update();
    expect(one.isDown('MOVE_LEFT')).toBe(false);
    expect(one.justReleased('MOVE_LEFT')).toBe(true);
    expect(two.isDown('MOVE_RIGHT')).toBe(true);
    instance.dispose();
  });

  it('advances edges once per update, exactly like the single-player host', () => {
    const { instance, target } = hub();
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    const one = instance.inputForPlayer('p1')!;

    target.dispatchEvent(keyEvent('keydown', 'KeyV'));
    instance.update();
    expect(one.justPressed('JUMP')).toBe(true);
    instance.update();
    expect(one.justPressed('JUMP')).toBe(false);
    expect(one.isDown('JUMP')).toBe(true);
    instance.dispose();
  });

  it('clear() zeroes every player channel', () => {
    const { instance, target } = hub();
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    instance.join('p2', { kind: 'keyboard-profile', profileId: 'keyboard-right' });
    target.dispatchEvent(keyEvent('keydown', 'KeyA'));
    target.dispatchEvent(keyEvent('keydown', 'ArrowLeft'));
    instance.update();
    expect(instance.inputForPlayer('p1')!.isDown('MOVE_LEFT')).toBe(true);
    expect(instance.inputForPlayer('p2')!.isDown('MOVE_LEFT')).toBe(true);

    instance.clear();
    instance.update();
    expect(instance.inputForPlayer('p1')!.isDown('MOVE_LEFT')).toBe(false);
    expect(instance.inputForPlayer('p2')!.isDown('MOVE_LEFT')).toBe(false);
    instance.dispose();
  });

  it('dispose() tears down every channel and detaches its listeners', () => {
    const { instance, target } = hub();
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    const one = instance.inputForPlayer('p1')!;
    instance.dispose();

    expect(instance.inputForPlayer('p1')).toBeUndefined();
    expect(instance.players().every((s) => s.state === 'empty')).toBe(true);
    // A key arriving after disposal reaches nothing.
    target.dispatchEvent(keyEvent('keydown', 'KeyA'));
    instance.update();
    expect(one.isDown('MOVE_LEFT')).toBe(false);
  });

  it('leaves the single-player global input untouched', () => {
    // The global host is an independent object; a hub existing changes nothing
    // about how a normal game reads input.
    const target = new EventTarget();
    const global = new ActionInputHost(DEFAULT_BINDINGS);
    global.addAdapter(new KeyboardAdapter(global, target));
    const { instance } = hub();
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });

    target.dispatchEvent(keyEvent('keydown', 'KeyA'));
    global.update();
    expect(global.isDown('MOVE_LEFT')).toBe(true);
    global.dispose();
    instance.dispose();
  });
});

describe('GamepadAdapter', () => {
  function adapterFor(pads: ReturnType<typeof scriptedPads>, index = 0) {
    const host = new ActionInputHost({});
    const adapter = new GamepadAdapter(host, pads.source, index, {
      deadzone: { stick: 0.25, trigger: 0.1 },
    });
    host.addAdapter(adapter);
    return { host, adapter };
  }

  it('maps the left stick and d-pad to movement', () => {
    const pads = scriptedPads([pad(0, { axes: [-1, 0, 0, 0] })]);
    const { host } = adapterFor(pads);
    host.update();
    expect(host.isDown('MOVE_LEFT')).toBe(true);
    expect(host.value('MOVE_LEFT')).toBeCloseTo(1, 6);
    expect(host.isDown('MOVE_RIGHT')).toBe(false);

    const dpad = new Array(17).fill(0);
    dpad[15] = 1; // d-pad right
    pads.set([pad(0, { buttons: dpad })]);
    host.update();
    expect(host.isDown('MOVE_RIGHT')).toBe(true);
    expect(host.isDown('MOVE_LEFT')).toBe(false);
    host.dispose();
  });

  it('applies the stick deadzone radially', () => {
    const pads = scriptedPads([pad(0, { axes: [0.1, 0.1, 0, 0] })]);
    const { host } = adapterFor(pads);
    host.update();
    expect(host.isDown('MOVE_RIGHT')).toBe(false);
    expect(host.isDown('MOVE_DOWN')).toBe(false);

    pads.set([pad(0, { axes: [0.24, 0.24, 0, 0] })]); // magnitude 0.339 > 0.25
    host.update();
    expect(host.isDown('MOVE_RIGHT')).toBe(true);
    expect(host.isDown('MOVE_DOWN')).toBe(true);
    host.dispose();
  });

  it('maps face buttons and analog triggers', () => {
    const buttons = new Array(17).fill(0);
    buttons[0] = 1; // bottom face
    buttons[7] = 0.5; // analog trigger
    const pads = scriptedPads([pad(0, { buttons })]);
    const { host } = adapterFor(pads);
    host.update();
    expect(host.justPressed('JUMP')).toBe(true);
    expect(host.isDown('CONFIRM')).toBe(true);
    expect(host.value('DASH')).toBeCloseTo((0.5 - 0.1) / 0.9, 6);
    host.dispose();
  });

  it('reports release edges when a button is let go', () => {
    const held = new Array(17).fill(0);
    held[0] = 1;
    const pads = scriptedPads([pad(0, { buttons: held })]);
    const { host } = adapterFor(pads);
    host.update();
    host.update();
    expect(host.isDown('JUMP')).toBe(true);

    pads.set([pad(0)]);
    host.update();
    expect(host.justReleased('JUMP')).toBe(true);
    expect(host.isDown('JUMP')).toBe(false);
    host.dispose();
  });

  it('clears held actions on disconnect and does not fire a phantom press on reconnect', () => {
    const held = new Array(17).fill(0);
    held[0] = 1;
    const pads = scriptedPads([pad(0, { buttons: held, axes: [-1, 0, 0, 0] })]);
    const { host, adapter } = adapterFor(pads);
    host.update();
    expect(host.isDown('JUMP')).toBe(true);
    expect(host.isDown('MOVE_LEFT')).toBe(true);
    expect(adapter.connected).toBe(true);

    pads.set([null]); // unplugged mid-hold
    host.update();
    expect(adapter.connected).toBe(false);
    expect(host.isDown('JUMP')).toBe(false);
    expect(host.isDown('MOVE_LEFT')).toBe(false);

    // Reconnect with nothing pressed: no phantom edge.
    pads.set([pad(0)]);
    host.update();
    expect(adapter.connected).toBe(true);
    expect(host.justPressed('JUMP')).toBe(false);
    expect(host.isDown('JUMP')).toBe(false);

    // A genuine press after reconnect still produces an edge.
    pads.set([pad(0, { buttons: held })]);
    host.update();
    expect(host.justPressed('JUMP')).toBe(true);
    host.dispose();
  });

  it('treats a disconnected-but-present pad as absent', () => {
    const pads = scriptedPads([pad(0, { connected: false })]);
    const { host, adapter } = adapterFor(pads);
    host.update();
    expect(adapter.connected).toBe(false);
    host.dispose();
  });

  it('follows the pad by its reported index, not its array position', () => {
    const buttons = new Array(17).fill(0);
    buttons[0] = 1;
    const pads = scriptedPads([null, pad(3, { buttons })]);
    const { host } = adapterFor(pads, 3);
    host.update();
    expect(host.isDown('JUMP')).toBe(true);
    host.dispose();
  });

  it('can be pointed at a different pad, clearing the old one first', () => {
    const buttons = new Array(17).fill(0);
    buttons[0] = 1;
    const pads = scriptedPads([pad(0, { buttons }), pad(1)]);
    const { host, adapter } = adapterFor(pads);
    host.update();
    expect(host.isDown('JUMP')).toBe(true);

    adapter.setGamepadIndex(1);
    host.update();
    expect(host.isDown('JUMP')).toBe(false);
    host.dispose();
  });

  it('zeroes its actions on dispose', () => {
    const buttons = new Array(17).fill(0);
    buttons[0] = 1;
    const pads = scriptedPads([pad(0, { buttons })]);
    const { host, adapter } = adapterFor(pads);
    host.update();
    expect(host.isDown('JUMP')).toBe(true);
    adapter.dispose();
    host.update();
    expect(host.isDown('JUMP')).toBe(false);
    host.dispose();
  });
});

describe('PlayerInputHub gamepad routing', () => {
  it('refuses to seat a player on a disconnected pad', () => {
    const pads = scriptedPads([null]);
    const { instance } = hub({}, pads.source);
    expect(instance.join('p1', { kind: 'gamepad-index', index: 0 })).toMatchObject({
      ok: false,
      reason: 'device-disconnected',
    });
    instance.dispose();
  });

  it('routes a pad to its player and isolates it from the keyboard player', () => {
    const buttons = new Array(17).fill(0);
    buttons[0] = 1;
    const pads = scriptedPads([pad(0, { buttons })]);
    const { instance, target } = hub({}, pads.source);
    instance.join('p1', { kind: 'keyboard-profile', profileId: 'keyboard-left' });
    expect(instance.join('p2', { kind: 'gamepad-index', index: 0 }).ok).toBe(true);
    expect(instance.slot('p2')?.connected).toBe(true);

    instance.update();
    expect(instance.inputForPlayer('p2')!.isDown('JUMP')).toBe(true);
    expect(instance.inputForPlayer('p1')!.isDown('JUMP')).toBe(false);

    target.dispatchEvent(keyEvent('keydown', 'KeyV'));
    instance.update();
    expect(instance.inputForPlayer('p1')!.isDown('JUMP')).toBe(true);
    instance.dispose();
  });

  it('clears the player channel and reports disconnected when the pad is unplugged', () => {
    const held = new Array(17).fill(0);
    held[0] = 1;
    const pads = scriptedPads([pad(0, { buttons: held })]);
    const { instance } = hub({ minPlayers: 1 }, pads.source);
    instance.join('p1', { kind: 'gamepad-index', index: 0 });
    instance.update();
    expect(instance.inputForPlayer('p1')!.isDown('JUMP')).toBe(true);

    pads.set([null]);
    instance.update();
    expect(instance.inputForPlayer('p1')!.isDown('JUMP')).toBe(false);
    expect(instance.slot('p1')?.connected).toBe(false);
    expect(instance.connectedPlayers()).toHaveLength(0);
    // The slot is still joined - a dropped controller is not a departed player.
    expect(instance.slot('p1')?.joined).toBe(true);

    pads.set([pad(0)]);
    instance.update();
    expect(instance.slot('p1')?.connected).toBe(true);
    instance.dispose();
  });

  it('offers only connected, unowned pads as available devices', () => {
    const pads = scriptedPads([pad(0), pad(1, { connected: false }), pad(2)]);
    const { instance } = hub({ maxPlayers: 3, minPlayers: 1 }, pads.source);
    const before = instance.availableDevices();
    expect(before.filter((d) => d.kind === 'gamepad-index')).toEqual([
      { kind: 'gamepad-index', index: 0 },
      { kind: 'gamepad-index', index: 2 },
    ]);

    instance.join('p1', { kind: 'gamepad-index', index: 0 });
    expect(instance.availableDevices().filter((d) => d.kind === 'gamepad-index')).toEqual([
      { kind: 'gamepad-index', index: 2 },
    ]);
    expect(instance.join('p2', { kind: 'gamepad-index', index: 0 })).toMatchObject({
      ok: false,
      reason: 'device-taken',
    });
    instance.dispose();
  });
});
