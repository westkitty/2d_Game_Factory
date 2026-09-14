import { PERCEPTION_CAPABILITY_ID, type PerceptionService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated top-down shell to `sw2d.perception`
 * (Category-C Wave 4; patrol routes, observer states and takedowns drawn
 * since the Final Product Completion program, Wave 2 - matrix L09).
 *
 * Inert unless the game installed the pack and the catalog has observers.
 * Presentation is a high-contrast HUD so a patrol / cone / cover / loot loop
 * is readable in the first short play session: observers move with the
 * service, their cone colour follows their state (patrol, suspicious,
 * chase, investigate, return, downed), routes are dotted, and J takes a
 * guard down from behind. `{ hud: false }` lets expanded kits keep their own
 * presentation.
 */

export interface StarterPerceptionSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly y: number;
  readonly hidden: boolean;
  readonly seen: boolean;
  readonly alarm: boolean;
  readonly suspicion: number;
  readonly objectiveCollected: boolean;
  readonly outcome: string;
  readonly lastResult: string | null;
  readonly takedowns: number;
  readonly transitions: number;
  readonly observers: readonly {
    id: string;
    x: number;
    y: number;
    facingDeg: number;
    fovDeg: number;
    range: number;
    seesPlayer: boolean;
    suspicion: number;
    alert: boolean;
    state: string;
    patrolling: boolean;
  }[];
}

export interface StarterPerceptionBinding {
  readonly active: boolean;
  setPlayer(x: number, y: number): void;
  /** J: silent takedown of a guard that cannot see the player. */
  act(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterPerceptionSnapshot;
  render(): void;
  startX(): number;
  startY(): number;
  dispose(): void;
}

const INERT: StarterPerceptionBinding = {
  active: false,
  setPlayer: () => undefined,
  act: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    x: 0,
    y: 0,
    hidden: false,
    seen: false,
    alarm: false,
    suspicion: 0,
    objectiveCollected: false,
    outcome: 'playing',
    lastResult: null,
    takedowns: 0,
    transitions: 0,
    observers: [],
  }),
  render: () => undefined,
  startX: () => 0,
  startY: () => 0,
  dispose: () => undefined,
};

export function bindStarterPerception(context: SceneContext, options?: { readonly hud?: boolean }): StarterPerceptionBinding {
  if (!context.capabilities.has(PERCEPTION_CAPABILITY_ID)) return INERT;
  const perception = context.capabilities.require<PerceptionService>(PERCEPTION_CAPABILITY_ID);
  if (!perception.active()) return INERT;
  perception.reset();
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const graphics = hud ? scene.add.graphics().setDepth(2) : null;
  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const sprites: { destroy(): void }[] = [];
  const lootSprites: { id: string; sprite: { setVisible(v: boolean): unknown; destroy(): void } }[] = [];
  const observerSprites: { id: string; sprite: { setPosition(x: number, y: number): unknown; setAlpha(a: number): unknown; setTint(t: number): unknown; destroy(): void } }[] = [];
  if (hud) {
    const enemyKey = context.assets.resolve('enemy');
    const pickupKey = context.assets.resolve('pickup');
    const exitKey = context.assets.resolve('exit');
    const hazardKey = context.assets.resolve('hazard');
    for (const observer of perception.observers()) {
      const sprite = scene.add.image(observer.x, observer.y, enemyKey).setDisplaySize(34, 34).setDepth(4);
      sprites.push(sprite);
      observerSprites.push({ id: observer.id, sprite });
    }
    for (const cover of perception.cover()) {
      sprites.push(scene.add.image(cover.x, cover.y, hazardKey).setDisplaySize(cover.radius * 2, cover.radius * 2).setAlpha(0.35).setDepth(1));
    }
    for (const objective of perception.objectives()) {
      const sprite = scene.add.image(objective.x, objective.y, pickupKey).setDisplaySize(26, 26).setDepth(3);
      lootSprites.push({ id: objective.id, sprite });
    }
    for (const exit of perception.exits()) {
      sprites.push(scene.add.image(exit.x, exit.y, exitKey).setDisplaySize(34, 60).setDepth(3));
    }
  }

  const STATE_COLORS: Record<string, number> = {
    patrol: 0xffe14d,
    suspicious: 0xf0a35a,
    chase: 0xff5a5a,
    investigate: 0xe08cff,
    return: 0x7dd3fc,
    downed: 0x6b7280,
  };

  function snapshot(): StarterPerceptionSnapshot {
    const player = perception.player();
    return {
      active: true,
      mode: perception.mode(),
      x: player.x,
      y: player.y,
      hidden: perception.hidden(),
      seen: perception.seen(),
      alarm: perception.alarm(),
      suspicion: perception.maxSuspicion(),
      objectiveCollected: perception.objectiveCollected(),
      outcome: perception.outcome(),
      lastResult: perception.lastResult(),
      takedowns: perception.takedowns(),
      transitions: perception.transitions().length,
      observers: perception.observers().map((o) => ({
        id: o.id,
        x: Math.round(o.x),
        y: Math.round(o.y),
        facingDeg: Math.round(o.facingDeg),
        fovDeg: o.fovDeg,
        range: o.range,
        seesPlayer: o.seesPlayer,
        suspicion: o.suspicion,
        alert: o.alert,
        state: o.state,
        patrolling: o.patrolling,
      })),
    };
  }

  function render(): void {
    for (const entry of lootSprites) {
      const live = perception.objectives().find((o) => o.id === entry.id);
      entry.sprite.setVisible(!(live?.collected ?? false));
    }
    if (graphics) {
      graphics.clear();
      // Patrol routes, dotted.
      for (const observer of perception.observers()) {
        const live = observerSprites.find((o) => o.id === observer.id);
        live?.sprite.setPosition(observer.x, observer.y);
        live?.sprite.setAlpha(observer.state === 'downed' ? 0.35 : 1);
        live?.sprite.setTint(STATE_COLORS[observer.state] ?? 0xffffff);
        if (observer.state === 'downed') continue;
        const facingRad = (observer.facingDeg * Math.PI) / 180;
        const half = ((observer.fovDeg / 2) * Math.PI) / 180;
        graphics.fillStyle(STATE_COLORS[observer.state] ?? 0xffe14d, observer.seesPlayer ? 0.3 : 0.14);
        graphics.beginPath();
        graphics.moveTo(observer.x, observer.y);
        graphics.lineTo(
          observer.x + Math.cos(facingRad - half) * observer.range,
          observer.y + Math.sin(facingRad - half) * observer.range,
        );
        graphics.lineTo(
          observer.x + Math.cos(facingRad + half) * observer.range,
          observer.y + Math.sin(facingRad + half) * observer.range,
        );
        graphics.closePath();
        graphics.fillPath();
      }
    }
    if (!title || !status || !hint) return;
    const modeLabel = perception.mode() === 'heist' ? 'HEIST' : 'INFILTRATE';
    title.setText(modeLabel);
    const guards = perception.observers().map((o) => `${o.id} ${o.state}`).join(', ');
    const flags = [
      perception.hidden() ? 'HIDDEN' : null,
      perception.seen() ? 'SEEN' : null,
      perception.alarm() ? 'ALARM' : null,
      perception.objectiveCollected() ? 'LOOT ✓' : null,
      perception.takedowns() > 0 ? `TAKEDOWNS ${perception.takedowns()}` : null,
      perception.outcome() !== 'playing' ? `${perception.outcome().toUpperCase()}${perception.lastResult() === 'caught' ? ' (CAUGHT)' : ''}` : null,
    ].filter(Boolean);
    status.setText(`suspicion ${Math.round(perception.maxSuspicion() * 100)}%  ·  ${guards}${flags.length ? `  ·  ${flags.join('  ·  ')}` : ''}`);
    hint.setText('SLIP PAST THE PATROL   HIDE IN COVER TO LOSE A CHASE   J TAKES A GUARD DOWN FROM BEHIND   LOOT THEN EXIT');
  }

  render();

  let disposed = false;
  return {
    active: true,
    setPlayer(x: number, y: number): void {
      perception.setPlayer(x, y);
    },
    act(): void {
      const result = perception.takedown();
      if (result.ok) context.audio.playCue('ui.confirm');
      render();
    },
    tick(deltaMs: number): void {
      perception.tick(deltaMs);
      render();
    },
    snapshot,
    render,
    startX: () => perception.start().x,
    startY: () => perception.start().y,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        graphics?.destroy();
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        for (const sprite of sprites) sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
