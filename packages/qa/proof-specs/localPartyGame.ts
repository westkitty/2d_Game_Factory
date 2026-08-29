import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { PlayerJoinResult } from '@sw2d/contracts';
import type { PartyShellState } from '../../proofs/local-party-game/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.party-shell';

const state = (h: Harness): Promise<PartyShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

/** Dispatch a real keyboard event, exactly as a player pressing that physical key would. */
function key(harness: Harness, type: 'keydown' | 'keyup', code: string): Promise<unknown> {
  return harness.evaluate(
    `window.dispatchEvent(new KeyboardEvent(${JSON.stringify(type)}, { code: ${JSON.stringify(code)}, bubbles: true }))`,
  );
}

/** Script the injected GamepadSource. `null` in a slot models an unplugged pad. */
function setPads(harness: Harness, pads: unknown[]): Promise<unknown> {
  return harness.evaluate(`window.__SW2D_TEST_PADS__ = ${JSON.stringify(pads)}`);
}

function padSnapshot(index: number, buttons: number[] = [], axes: number[] = [0, 0, 0, 0]): unknown {
  const full = new Array(17).fill(0);
  buttons.forEach((value, i) => {
    full[i] = value;
  });
  return { index, connected: true, id: `qa-pad-${index}`, mapping: 'standard', axes, buttons: full };
}

const KB_LEFT = `{ kind: 'keyboard-profile', profileId: 'keyboard-left' }`;
const KB_RIGHT = `{ kind: 'keyboard-profile', profileId: 'keyboard-right' }`;

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await setPads(harness, []);
  await harness.keyTap('Space');
  await harness.stepFrames(10);

  // 1. Boot into the lobby: the roster exists, nobody is seated, and both
  //    keyboard profiles are on offer.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = s1;
  const step1_lobby =
    snap.scene === 'sw2d.play' &&
    s1.phase === 'lobby' &&
    s1.minPlayers === 2 &&
    s1.maxPlayers === 4 &&
    s1.requireReady === true &&
    s1.slots.length === 4 &&
    s1.slots.map((slot) => slot.playerId).join(',') === 'red,blue,green,gold' &&
    s1.slots.every((slot) => slot.state === 'empty') &&
    s1.canStart === false &&
    s1.playerAdapterCount === 0 &&
    s1.availableDevices.filter((d) => d.kind === 'keyboard-profile').length === 2;

  // 2. Player one joins on keyboard profile A.
  const join1 = await evalShell<PlayerJoinResult>(harness, `(s) => s.join('red', ${KB_LEFT})`);
  const s2 = await state(harness);
  evidence.join1 = join1;
  const step2_joinOne =
    join1.ok === true &&
    s2.slots[0]!.state === 'joined' &&
    s2.slots[0]!.device?.kind === 'keyboard-profile' &&
    s2.playerAdapterCount === 1 &&
    // That profile is no longer on offer, and the roster still cannot start.
    s2.availableDevices.filter((d) => d.kind === 'keyboard-profile').length === 1 &&
    s2.canStart === false;

  // 3. Player two joins on keyboard profile B. The same profile is refused.
  const stolen = await evalShell<PlayerJoinResult>(harness, `(s) => s.join('blue', ${KB_LEFT})`);
  const join2 = await evalShell<PlayerJoinResult>(harness, `(s) => s.join('blue', ${KB_RIGHT})`);
  const s3 = await state(harness);
  evidence.stolen = stolen;
  evidence.join2 = join2;
  const step3_joinTwo =
    stolen.ok === false &&
    (stolen as { reason: string }).reason === 'device-taken' &&
    join2.ok === true &&
    s3.slots[1]!.state === 'joined' &&
    s3.playerAdapterCount === 2 &&
    Object.keys(s3.bodies).sort().join(',') === 'blue,red';

  // 4. Player one's key drives player one only.
  await key(harness, 'keydown', 'KeyA');
  await harness.stepFrames(4);
  const s4 = await state(harness);
  const held4 = await evalShell<Record<string, Record<string, boolean> | null>>(
    harness,
    `(s) => ({ red: s.held('red'), blue: s.held('blue') })`,
  );
  evidence.afterRedPress = { bodies: s4.bodies, held: held4 };
  const step4_p1DoesNotDriveP2 =
    held4.red?.MOVE_LEFT === true &&
    held4.blue?.MOVE_LEFT === false &&
    // Still in the lobby, so nothing has moved yet - isolation is visible before
    // any gameplay consumes it.
    s4.phase === 'lobby';

  // 5. Player two's key drives player two only, while player one still holds.
  await key(harness, 'keydown', 'ArrowRight');
  await harness.stepFrames(4);
  const held5 = await evalShell<Record<string, Record<string, boolean> | null>>(
    harness,
    `(s) => ({ red: s.held('red'), blue: s.held('blue') })`,
  );
  evidence.afterBluePress = held5;
  const step5_p2DoesNotDriveP1 =
    held5.blue?.MOVE_RIGHT === true &&
    held5.red?.MOVE_RIGHT === false &&
    held5.red?.MOVE_LEFT === true && // player one is still holding its own key
    held5.blue?.MOVE_LEFT === false;

  // 6/7. Ready both players and start.
  await evalShell(harness, `(s) => { s.ready('red', true); s.ready('blue', true); }`);
  const sReady = await state(harness);
  const started = await evalShell<boolean>(harness, `(s) => s.start()`);
  await harness.stepFrames(2);
  const s7 = await state(harness);
  evidence.ready = sReady.slots.map((slot) => slot.state);
  const step6_ready =
    sReady.slots[0]!.state === 'ready' && sReady.slots[1]!.state === 'ready' && sReady.canStart === true;
  const step7_start = started === true && s7.phase === 'playing' && s7.rounds === 1;

  // 8. Simultaneous movement in opposite directions, each body driven only by
  //    its own player's channel.
  const before = await state(harness);
  await harness.stepFrames(20);
  const s8 = await state(harness);
  evidence.simultaneous = { before: before.bodies, after: s8.bodies };
  const step8_simultaneous =
    s8.bodies['red']!.x < before.bodies['red']!.x && // red still holds KeyA (left)
    s8.bodies['blue']!.x > before.bodies['blue']!.x && // blue still holds ArrowRight
    s8.bodies['red']!.moveX === -1 &&
    s8.bodies['blue']!.moveX === 1 &&
    s8.bodies['green'] === undefined; // an unseated slot has no body

  await key(harness, 'keyup', 'KeyA');
  await key(harness, 'keyup', 'ArrowRight');
  await harness.stepFrames(4);

  // 9. A third player joins on a gamepad and drives its own body.
  await setPads(harness, [padSnapshot(0)]);
  await harness.stepFrames(2);
  const padJoin = await evalShell<PlayerJoinResult>(
    harness,
    `(s) => s.join('green', { kind: 'gamepad-index', index: 0 })`,
  );
  await setPads(harness, [padSnapshot(0, [1])]); // bottom face button held
  await harness.stepFrames(4);
  const s9 = await state(harness);
  const held9 = await evalShell<Record<string, Record<string, boolean> | null>>(
    harness,
    `(s) => ({ green: s.held('green'), red: s.held('red') })`,
  );
  evidence.padJoin = { padJoin, held: held9, slot: s9.slots[2] };
  const step9_gamepadJoins =
    padJoin.ok === true &&
    s9.slots[2]!.device?.kind === 'gamepad-index' &&
    s9.slots[2]!.connected === true &&
    s9.playerAdapterCount === 3 &&
    held9.green?.JUMP === true &&
    held9.red?.JUMP === false; // the pad reaches only its own player

  // 10. Unplug it mid-hold: that player's held state clears, the slot reports
  //     disconnected, and the other players are untouched.
  await setPads(harness, [null]);
  await harness.stepFrames(4);
  const s10 = await state(harness);
  const held10 = await evalShell<Record<string, Record<string, boolean> | null>>(
    harness,
    `(s) => ({ green: s.held('green'), blue: s.held('blue') })`,
  );
  evidence.disconnect = { slot: s10.slots[2], held: held10 };
  const step10_disconnectClears =
    held10.green?.JUMP === false &&
    s10.slots[2]!.connected === false &&
    s10.slots[2]!.joined === true && // a dropped pad is not a departed player
    s10.slots[1]!.connected === true &&
    s10.playerAdapterCount === 3;

  // 11. Reconnect produces no phantom press, then reassignment to a free
  //     keyboard profile works and rebuilds exactly one channel.
  await setPads(harness, [padSnapshot(0)]);
  await harness.stepFrames(4);
  const held11a = await evalShell<Record<string, Record<string, boolean> | null>>(
    harness,
    `(s) => ({ green: s.held('green') })`,
  );
  const s11a = await state(harness);
  await evalShell(harness, `(s) => s.leave('green')`);
  const reassigned = await evalShell<PlayerJoinResult>(harness, `(s) => s.join('green', ${KB_LEFT})`);
  const s11 = await state(harness);
  evidence.reconnect = { held: held11a, connected: s11a.slots[2]!.connected, reassigned };
  const step11_reconnect =
    held11a.green?.JUMP === false && // no phantom press on reconnect
    s11a.slots[2]!.connected === true &&
    reassigned.ok === false && // keyboard-left still belongs to red
    (reassigned as { reason: string }).reason === 'device-taken' &&
    s11.playerAdapterCount === 2;

  // 12. Restart the round. The roster survives (a new round is not a new game),
  //     bodies are rebuilt, and the channels still work.
  await evalShell(harness, `(s) => s.endRound()`);
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(14);
  const s12 = await state(harness);
  await evalShell(harness, `(s) => s.start()`);
  await key(harness, 'keydown', 'KeyD');
  await harness.stepFrames(12);
  const s12b = await state(harness);
  evidence.afterRestart = { slots: s12.slots.map((s) => s.state), bodies: s12b.bodies, adapters: s12b.playerAdapterCount };
  const step12_restart =
    s12.slots[0]!.state === 'ready' &&
    s12.slots[1]!.state === 'ready' &&
    s12b.phase === 'playing' &&
    s12b.bodies['red']!.moveX === 1 &&
    s12b.bodies['blue']!.moveX === 0;

  // 13. No leaked hubs or adapters across the restart.
  const finalSnap = await readSnapshot(harness);
  evidence.listeners = finalSnap.listeners;
  const step13_noLeaks =
    s12b.playerAdapterCount === 2 && // still exactly one channel per seated player
    (finalSnap.listeners as Record<string, number>)['input.adapters'] === 2 && // global keyboard + pointer only
    finalSnap.capabilities.filter((id) => id === 'input.players').length === 1;

  await key(harness, 'keyup', 'KeyD');

  const passed =
    step1_lobby &&
    step2_joinOne &&
    step3_joinTwo &&
    step4_p1DoesNotDriveP2 &&
    step5_p2DoesNotDriveP1 &&
    step6_ready &&
    step7_start &&
    step8_simultaneous &&
    step9_gamepadJoins &&
    step10_disconnectClears &&
    step11_reconnect &&
    step12_restart &&
    step13_noLeaks;

  return {
    passed,
    details: {
      ...evidence,
      step1_lobby,
      step2_joinOne,
      step3_joinTwo,
      step4_p1DoesNotDriveP2,
      step5_p2DoesNotDriveP1,
      step6_ready,
      step7_start,
      step8_simultaneous,
      step9_gamepadJoins,
      step10_disconnectClears,
      step11_reconnect,
      step12_restart,
      step13_noLeaks,
    },
  };
}
