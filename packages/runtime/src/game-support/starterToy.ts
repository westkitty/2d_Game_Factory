import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind generated shells to `context.interaction` (Category-C Wave 20).
 *
 * Inert unless the generated packConfig names a photo or sandbox starter.
 * The reusable machine stays ADR-0018 (world cursor, hover, click) — this
 * file is presentation, not a camera/framing pack or a generalized
 * authoring sandbox. Overlay photography / sandbox kits stay local (P3-H).
 */

export type ToyStarterMode = 'photo' | 'sandbox';

export interface StarterToySnapshot {
  readonly active: boolean;
  readonly mode: ToyStarterMode | null;
  readonly shots: number;
  readonly captured: readonly string[];
  readonly selected: 'block' | 'ball';
  readonly blocks: number;
  readonly balls: number;
  readonly stamps: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterToyBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  setPlayer(x: number, y: number): void;
  select(delta: number): void;
  act(): void;
  snapshot(): StarterToySnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterToyBinding = {
  active: false,
  startX: () => 0,
  startY: () => 0,
  setPlayer: () => undefined,
  select: () => undefined,
  act: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    shots: 0,
    captured: [],
    selected: 'block',
    blocks: 0,
    balls: 0,
    stamps: 0,
    nearId: null,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const START_X = 120;
const START_Y = 270;
const SUBJECTS = [
  { id: 'bird', label: 'BIRD', x: 280, y: 270, radius: 64 },
  { id: 'tree', label: 'TREE', x: 700, y: 270, radius: 64 },
] as const;
const PALETTE = [
  { id: 'pick-block', kind: 'block' as const, label: 'BLOCK', x: 200, y: 72 },
  { id: 'pick-ball', kind: 'ball' as const, label: 'BALL', x: 360, y: 72 },
] as const;
const STAGE = { x: 80, y: 140, width: 800, height: 340 } as const;
const MAX_STAMPS = 6;
const MARK_COLOR = 0xf0c274;
const SHOT_COLOR = 0x65d0a8;
const BLOCK_COLOR = 0x4f9ee0;
const BALL_COLOR = 0xb98af0;
const STAGE_COLOR = 0x1a1f2b;

interface Stamp {
  readonly id: string;
  readonly kind: 'block' | 'ball';
  readonly x: number;
  readonly y: number;
  readonly handle: { dispose(): void };
  readonly sprite: { setFillStyle(color: number, alpha?: number): unknown; destroy(): void };
  readonly label: { destroy(): void };
}

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function bindStarterToy(
  context: SceneContext,
  options?: { readonly mode?: ToyStarterMode | null; readonly hud?: boolean },
): StarterToyBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'photo' && mode !== 'sandbox') return INERT;

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const markers: { setFillStyle(color: number, alpha?: number): unknown; destroy(): void }[] = [];
  const labels: { setText(value: string): unknown; destroy(): void }[] = [];
  const handles: { dispose(): void }[] = [];
  const stamps: Stamp[] = [];
  const captured = new Set<string>();
  let selectedIndex = 0;
  let playerX = START_X;
  let playerY = START_Y;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;
  let nextStamp = 0;

  if (hud && mode === 'photo') {
    for (const subject of SUBJECTS) {
      markers.push(scene.add.rectangle(subject.x, subject.y, 44, 44, MARK_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20));
      labels.push(scene.add.text(subject.x, subject.y - 36, subject.label, mutedStyle(12)).setOrigin(0.5).setDepth(21));
    }
  }

  const stageRect =
    hud && mode === 'sandbox'
      ? scene.add
          .rectangle(STAGE.x + STAGE.width * 0.5, STAGE.y + STAGE.height * 0.5, STAGE.width, STAGE.height, STAGE_COLOR, 0.95)
          .setStrokeStyle(2, 0x8a93a6, 0.9)
          .setDepth(10)
      : null;
  const paletteRects: { setFillStyle(color: number, alpha?: number): unknown; destroy(): void }[] = [];
  const paletteLabels: { destroy(): void }[] = [];
  if (hud && mode === 'sandbox') {
    for (const slot of PALETTE) {
      paletteRects.push(
        scene.add.rectangle(slot.x, slot.y, 96, 44, slot.kind === 'block' ? BLOCK_COLOR : BALL_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20),
      );
      paletteLabels.push(scene.add.text(slot.x, slot.y, slot.label, mutedStyle(14)).setOrigin(0.5).setDepth(21));
    }
  }

  function nearId(): string | null {
    if (mode !== 'photo') return null;
    for (const subject of SUBJECTS) {
      if (dist(playerX, playerY, subject.x, subject.y) <= subject.radius) return subject.id;
    }
    return null;
  }

  function selectedKind(): 'block' | 'ball' {
    return PALETTE[selectedIndex]?.kind ?? 'block';
  }

  function snapshot(): StarterToySnapshot {
    let blocks = 0;
    let balls = 0;
    for (const stamp of stamps) {
      if (stamp.kind === 'block') blocks += 1;
      else balls += 1;
    }
    return {
      active: true,
      mode,
      shots: captured.size,
      captured: [...captured],
      selected: selectedKind(),
      blocks,
      balls,
      stamps: stamps.length,
      nearId: nearId(),
      lastResult,
      outcome,
    };
  }

  function finishIfReady(): void {
    if (mode === 'photo' && captured.size >= SUBJECTS.length) outcome = 'complete';
    if (mode === 'sandbox') {
      const snap = snapshot();
      if (snap.blocks >= 1 && snap.balls >= 1) outcome = 'complete';
    }
  }

  function paint(): void {
    const snap = snapshot();
    if (mode === 'photo') {
      for (let i = 0; i < SUBJECTS.length; i++) {
        const subject = SUBJECTS[i]!;
        const shot = captured.has(subject.id);
        markers[i]?.setFillStyle(shot ? SHOT_COLOR : MARK_COLOR, 0.95);
        labels[i]?.setText(shot ? `${subject.label} SHOT` : subject.label);
      }
    } else {
      for (let i = 0; i < PALETTE.length; i++) {
        const slot = PALETTE[i]!;
        const on = snap.selected === slot.kind;
        paletteRects[i]?.setFillStyle(slot.kind === 'block' ? BLOCK_COLOR : BALL_COLOR, on ? 0.95 : 0.45);
      }
      stageRect?.setFillStyle(snap.outcome === 'complete' ? SHOT_COLOR : STAGE_COLOR, 0.95);
    }
    if (!title || !status || !hint) return;
    if (mode === 'photo') {
      title.setText(snap.outcome === 'complete' ? 'CAPTURED' : 'PHOTO');
      status.setText(
        `shots ${snap.shots}/${SUBJECTS.length}${snap.nearId ? `  ·  near ${snap.nearId}` : ''}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }${snap.outcome === 'complete' ? '  ·  complete' : ''}`,
      );
      hint.setText(
        snap.outcome === 'complete' ? 'CAPTURED' : 'WALK TO A SUBJECT   J SHOOTS',
      );
    } else {
      title.setText(snap.outcome === 'complete' ? 'BUILT' : 'SANDBOX');
      status.setText(
        `block ${snap.blocks}  ·  ball ${snap.balls}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText(snap.outcome === 'complete' ? 'BUILT' : 'CLICK STAMPS   ARROWS PICK BLOCK OR BALL');
    }
  }

  function shoot(id: string | null): void {
    if (id === null) {
      lastResult = 'too-far';
      return;
    }
    if (captured.has(id)) {
      lastResult = 'already';
      return;
    }
    captured.add(id);
    lastResult = `shot-${id}`;
    finishIfReady();
    if (captured.size >= SUBJECTS.length) context.audio.playCue('ui.confirm');
  }

  function placeStamp(kind: 'block' | 'ball', x: number, y: number): void {
    if (stamps.length >= MAX_STAMPS) {
      lastResult = 'full';
      return;
    }
    const id = `${kind}-${nextStamp++}`;
    const sprite = scene.add
      .rectangle(x, y, kind === 'block' ? 48 : 40, kind === 'block' ? 48 : 40, kind === 'block' ? BLOCK_COLOR : BALL_COLOR, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setDepth(15);
    const label = scene.add.text(x, y, kind === 'block' ? 'B' : 'O', mutedStyle(12)).setOrigin(0.5).setDepth(16);
    const handle = context.interaction.register({
      id,
      priority: 1,
      shape: { kind: 'circle', x, y, radius: 28 },
      onClick: () => {
        if (disposed || outcome !== 'playing') return;
        const index = stamps.findIndex((stamp) => stamp.id === id);
        if (index < 0) return;
        const stamp = stamps[index]!;
        stamp.handle.dispose();
        try {
          stamp.sprite.destroy();
          stamp.label.destroy();
        } catch {
          /* scene already tearing down */
        }
        stamps.splice(index, 1);
        lastResult = `remove-${kind}`;
        paint();
      },
    });
    stamps.push({ id, kind, x, y, handle, sprite, label });
    lastResult = `stamp-${kind}`;
    finishIfReady();
    if (outcome === 'complete') context.audio.playCue('ui.confirm');
  }

  if (mode === 'photo') {
    for (const subject of SUBJECTS) {
      handles.push(
        context.interaction.register({
          id: subject.id,
          shape: { kind: 'circle', x: subject.x, y: subject.y, radius: subject.radius },
          onClick: () => {
            if (disposed || outcome !== 'playing') return;
            const inRange = dist(playerX, playerY, subject.x, subject.y) <= subject.radius;
            shoot(inRange ? subject.id : null);
            paint();
          },
        }),
      );
    }
  } else {
    handles.push(
      context.interaction.register({
        id: 'stage',
        shape: { kind: 'rect', x: STAGE.x, y: STAGE.y, width: STAGE.width, height: STAGE.height },
        onClick: (info) => {
          if (disposed || outcome !== 'playing') return;
          placeStamp(selectedKind(), info.worldX, info.worldY);
          paint();
        },
      }),
    );
    for (let i = 0; i < PALETTE.length; i++) {
      const slot = PALETTE[i]!;
      handles.push(
        context.interaction.register({
          id: slot.id,
          priority: 2,
          shape: { kind: 'rect', x: slot.x - 48, y: slot.y - 22, width: 96, height: 44 },
          onClick: () => {
            if (disposed || outcome !== 'playing') return;
            selectedIndex = i;
            lastResult = `pick-${slot.kind}`;
            paint();
          },
        }),
      );
    }
  }

  paint();

  return {
    active: true,
    startX: () => START_X,
    startY: () => START_Y,
    setPlayer(x: number, y: number): void {
      if (disposed) return;
      playerX = x;
      playerY = y;
    },
    select(delta: number): void {
      if (disposed || mode !== 'sandbox' || outcome !== 'playing') return;
      selectedIndex = wrap(selectedIndex + delta, PALETTE.length);
      lastResult = `pick-${selectedKind()}`;
      paint();
    },
    act(): void {
      if (disposed || outcome !== 'playing' || mode !== 'photo') return;
      shoot(nearId());
      context.audio.playCue('ui.confirm');
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const handle of handles) handle.dispose();
      for (const stamp of stamps) {
        stamp.handle.dispose();
        try {
          stamp.sprite.destroy();
          stamp.label.destroy();
        } catch {
          /* scene already tearing down */
        }
      }
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        stageRect?.destroy();
        for (const marker of markers) marker.destroy();
        for (const label of labels) label.destroy();
        for (const rect of paletteRects) rect.destroy();
        for (const label of paletteLabels) label.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
