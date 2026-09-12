import { LOCAL_PLAY_CAPABILITY_ID, type LocalPlayService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated shell to `sw2d.local-play` (Category-C Wave 7).
 *
 * Inert unless the game installed the pack with at least two seats.
 * `{ hud: false }` lets expanded kits keep their own presentation.
 * Window key listeners feed versus axes without rewriting ActionInputHost
 * (WASD and arrows already share MOVE_*).
 */

export interface StarterLocalPlaySnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly currentPlayer: number;
  readonly scores: readonly number[];
  readonly turns: number;
  readonly winner: number | null;
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly axis0: number;
  readonly axis1: number;
  readonly axes: readonly number[];
  readonly gamepads: readonly { readonly seat: number; readonly index: number; readonly id: string; readonly connected: boolean }[];
  readonly views: readonly { readonly seat: number; readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
  readonly netplay: { readonly enabled: boolean; readonly role: 'host' | 'guest' | null; readonly room: string | null; readonly connected: boolean; readonly peerCount: number; readonly transport: 'broadcast-channel' | null; readonly authority: 'host' };
}

export interface StarterLocalPlayBinding {
  readonly active: boolean;
  pump(): void;
  act(): void;
  axis(playerIndex: number): number;
  snapshot(): StarterLocalPlaySnapshot;
  render(): void;
  mode(): string | null;
  dispose(): void;
}

const INERT: StarterLocalPlayBinding = {
  active: false,
  pump: () => undefined,
  act: () => undefined,
  axis: () => 0,
  snapshot: () => ({
    active: false,
    mode: null,
    currentPlayer: 0,
    scores: [],
    turns: 0,
    winner: null,
    lastResult: null,
    outcome: 'playing',
    axis0: 0,
    axis1: 0,
    axes: [],
    gamepads: [],
    views: [],
    netplay: { enabled: false, role: null, room: null, connected: false, peerCount: 0, transport: null, authority: 'host' },
  }),
  render: () => undefined,
  mode: () => null,
  dispose: () => undefined,
};

export function bindStarterLocalPlay(context: SceneContext, options?: { readonly hud?: boolean }): StarterLocalPlayBinding {
  if (!context.capabilities.has(LOCAL_PLAY_CAPABILITY_ID)) return INERT;
  const seats = context.capabilities.require<LocalPlayService>(LOCAL_PLAY_CAPABILITY_ID);
  if (!seats.active()) return INERT;
  seats.reset();
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const views = seats.mode() === 'hotseat'
    ? seats.scores().map((_, seat) => ({ seat, x: (seat % 2) * width * 0.5, y: Math.floor(seat / 2) * height * 0.5, width: width * 0.5, height: height * 0.5 }))
    : [];
  const viewPanels = hud ? views.map((view) => scene.add.rectangle(view.x + view.width * 0.5, view.y + view.height * 0.5, view.width - 8, view.height - 8, 0x17233d, 0.16).setStrokeStyle(2, 0x8a93a6, 0.7).setDepth(5)) : [];

  const held = new Set<string>();
  const onDown = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.repeat) return;
    held.add(keyboardEvent.code);
  };
  const onUp = (event: Event): void => {
    held.delete((event as KeyboardEvent).code);
  };
  const onBlur = (): void => {
    held.clear();
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  const query = new URLSearchParams(window.location.search);
  const role = query.get('netplay') === 'host' ? 'host' : query.get('netplay') === 'guest' ? 'guest' : null;
  const room = role ? (query.get('room') || 'local') : null;
  const channel = role && room && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`sw2d-netplay:${context.definition.id}:${room}`) : null;
  let connected = false;
  let peerCount = 0;
  let remote: { scores: readonly number[]; turns: number; winner: number | null; outcome: string; currentPlayer: number; lastResult: string | null } | null = null;
  const publishState = (): void => {
    if (role !== 'host' || !channel) return;
    channel.postMessage({ type: 'state', scores: seats.scores(), turns: seats.turns(), winner: seats.winner(), outcome: seats.outcome(), currentPlayer: seats.currentPlayer(), lastResult: seats.lastResult() });
  };
  if (channel) {
    channel.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
      const message = event.data;
      if (role === 'host' && message.type === 'hello') { connected = true; peerCount = 1; channel.postMessage({ type: 'welcome' }); publishState(); }
      else if (role === 'host' && message.type === 'act') { seats.act(); publishState(); render(); }
      else if (role === 'host' && message.type === 'bye') { connected = false; peerCount = 0; }
      else if (role === 'guest' && message.type === 'welcome') { connected = true; peerCount = 1; }
      else if (role === 'guest' && message.type === 'state') {
        connected = true; peerCount = 1;
        remote = { scores: message.scores as readonly number[], turns: Number(message.turns), winner: message.winner as number | null, outcome: String(message.outcome), currentPlayer: Number(message.currentPlayer), lastResult: message.lastResult as string | null };
        render();
      }
    };
    if (role === 'guest') channel.postMessage({ type: 'hello' });
  }

  function snapshot(): StarterLocalPlaySnapshot {
    const axes = seats.scores().map((_, seat) => seats.axis(seat));
    const networkState = role === 'guest' ? remote : null;
    return {
      active: true,
      mode: seats.mode(),
      currentPlayer: networkState?.currentPlayer ?? seats.currentPlayer(),
      scores: networkState?.scores ?? seats.scores(),
      turns: networkState?.turns ?? seats.turns(),
      winner: networkState?.winner ?? seats.winner(),
      lastResult: networkState?.lastResult ?? seats.lastResult(),
      outcome: networkState?.outcome ?? seats.outcome(),
      axis0: seats.axis(0),
      axis1: seats.axis(1),
      axes,
      gamepads: context.input.gamepadSeats?.().map(({ seat, index, id, connected }) => ({ seat, index, id, connected })) ?? [],
      views,
      netplay: { enabled: role !== null, role, room, connected, peerCount, transport: channel ? 'broadcast-channel' : null, authority: 'host' },
    };
  }

  function render(): void {
    if (!title || !status || !hint) return;
    const snap = snapshot();
    if (seats.mode() === 'versus') {
      title.setText('VERSUS');
      status.setText(`P1 ${snap.axis0}  ·  P2 ${snap.axis1}`);
      hint.setText('P1 ARROWS   P2 WASD');
      return;
    }
    title.setText(`PLAYER ${snap.currentPlayer + 1}`);
    status.setText(
      `P1 ${snap.scores[0] ?? 0}  ·  P2 ${snap.scores[1] ?? 0}  ·  turn ${snap.turns}${snap.winner !== null ? `  ·  winner P${snap.winner + 1}` : ''}`,
    );
    hint.setText('J/ENTER ACTS   PASS THE KEYBOARD');
  }

  render();

  let disposed = false;
  return {
    active: true,
    pump(): void {
      seats.setHeld([...held]);
      seats.setGamepadAxes(seats.scores().map((_, seat) => context.input.gamepadAxis?.(seat, 'vertical') ?? 0));
      render();
    },
    act(): void {
      if (role === 'guest' && channel) channel.postMessage({ type: 'act' });
      else { seats.act(); publishState(); }
      render();
    },
    axis(playerIndex: number): number {
      return seats.axis(playerIndex);
    },
    snapshot,
    render,
    mode: () => seats.mode(),
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      channel?.postMessage({ type: 'bye' });
      channel?.close();
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        for (const panel of viewPanels) panel.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
