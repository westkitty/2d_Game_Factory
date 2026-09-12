import type { VehicleService, VehicleState } from '@sw2d/contracts';
import { VEHICLE_MOTION_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated vehicle shell to endless-road vs boat/flight
 * presentation (Category-C Wave 23).
 *
 * Inert unless the generated packConfig names a road or craft starter and
 * `vehicle.motion` is installed. This file is presentation — not a kart
 * item-fire pack. Kart / time-trial keep racing. Overlay vehicle kits stay
 * local.
 */

const ARCADE_CAPABILITY_ID = 'arcade.score';

export type VehicleStarterMode = 'road' | 'craft';

export interface StarterVehicleSnapshot {
  readonly active: boolean;
  readonly mode: VehicleStarterMode | null;
  readonly profile: string | null;
  readonly x: number;
  readonly y: number;
  readonly speed: number;
  readonly altitude: number;
  readonly score: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterVehicleBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  switchCraft(): 'flight' | 'already' | 'no-flight';
  setVehicle(state: VehicleState): void;
  tick(_deltaMs: number): void;
  snapshot(): StarterVehicleSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterVehicleBinding = {
  active: false,
  startX: () => 0,
  startY: () => 0,
  switchCraft: () => 'no-flight',
  setVehicle: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    profile: null,
    x: 0,
    y: 0,
    speed: 0,
    altitude: 0,
    score: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface ArcadeLedger {
  score(): number;
  addScore(delta: number): number;
}

const START = { x: 160, y: 270 };
const SCORE_UNIT = 8;
const ROAD_SCORE = 80;
const ALTITUDE_WIN = 80;
const FLAG_COLOR = 0xb98af0;
const CLEAR_COLOR = 0x65d0a8;

export function bindStarterVehicle(
  context: SceneContext,
  options?: { readonly mode?: VehicleStarterMode | null; readonly hud?: boolean },
): StarterVehicleBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'road' && mode !== 'craft') return INERT;
  if (!context.capabilities.has(VEHICLE_MOTION_CAPABILITY_ID)) return INERT;
  const vehicles = context.capabilities.require<VehicleService>(VEHICLE_MOTION_CAPABILITY_ID);
  const arcade = context.capabilities.has(ARCADE_CAPABILITY_ID)
    ? context.capabilities.require<ArcadeLedger>(ARCADE_CAPABILITY_ID)
    : null;
  if (mode === 'road' && !arcade) return INERT;

  if (arcade) {
    const existing = arcade.score();
    if (existing !== 0) arcade.addScore(-existing);
  }

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const marker =
    hud && mode === 'craft'
      ? scene.add.rectangle(width * 0.5, 96, 48, 12, FLAG_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;

  let x = START.x;
  let y = START.y;
  let speed = 0;
  let altitude = 0;
  let profile: string | null = mode === 'craft' ? 'boat' : 'car';
  let scoredX = START.x;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;

  function snapshot(): StarterVehicleSnapshot {
    return {
      active: true,
      mode,
      profile,
      x: Math.round(x),
      y: Math.round(y),
      speed: Math.round(speed),
      altitude: Math.round(altitude),
      score: arcade ? arcade.score() : 0,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (marker) {
      marker.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : FLAG_COLOR, 0.95);
      marker.setPosition(width * 0.5, 96 - Math.min(40, snap.altitude * 0.2));
    }
    if (!title || !status || !hint) return;
    if (mode === 'road') {
      title.setText(snap.outcome === 'complete' ? 'DISTANCE' : 'ROAD');
      status.setText(
        `score ${snap.score}/${ROAD_SCORE}  ·  x ${snap.x}  ·  spd ${snap.speed}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }${snap.outcome !== 'playing' ? `  ·  ${snap.outcome}` : ''}`,
      );
      hint.setText(snap.outcome === 'playing' ? 'HOLD UP TO DRIVE   BANK DISTANCE' : 'DISTANCE');
    } else {
      title.setText(snap.outcome === 'complete' ? 'AIRBORNE' : snap.profile === 'flight' ? 'FLIGHT' : 'BOAT');
      status.setText(
        `alt ${snap.altitude}/${ALTITUDE_WIN}  ·  ${snap.profile ?? 'boat'}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }${snap.outcome !== 'playing' ? `  ·  ${snap.outcome}` : ''}`,
      );
      hint.setText(
        snap.outcome === 'playing'
          ? snap.profile === 'flight'
            ? 'HOLD UP + SHIFT TO CLIMB'
            : 'J SWITCHES TO FLIGHT'
          : 'AIRBORNE',
      );
    }
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (mode === 'road' && arcade && arcade.score() >= ROAD_SCORE) {
      outcome = 'complete';
      lastResult = 'distance';
      context.audio.playCue('ui.confirm');
      return;
    }
    if (mode === 'craft' && altitude >= ALTITUDE_WIN && profile === 'flight') {
      outcome = 'complete';
      lastResult = 'airborne';
      context.audio.playCue('ui.confirm');
    }
  }

  paint();

  return {
    active: true,
    startX: () => START.x,
    startY: () => START.y,
    switchCraft() {
      if (disposed || mode !== 'craft' || outcome !== 'playing') return 'already';
      if (profile === 'flight') {
        lastResult = 'already';
        paint();
        return 'already';
      }
      if (!vehicles.definitionIds().includes('starter-flight')) {
        lastResult = 'no-flight';
        paint();
        return 'no-flight';
      }
      vehicles.load('starter-flight', { x, y, heading: 0 });
      profile = 'flight';
      lastResult = 'flight';
      context.audio.playCue('ui.confirm');
      paint();
      return 'flight';
    },
    setVehicle(state: VehicleState): void {
      if (disposed) return;
      x = state.x;
      y = state.y;
      speed = state.speed;
      altitude = state.altitude;
    },
    tick(_deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      if (mode === 'road' && arcade) {
        const gained = Math.floor((x - scoredX) / SCORE_UNIT);
        if (gained > 0) {
          arcade.addScore(gained);
          scoredX += gained * SCORE_UNIT;
          lastResult = 'drive';
        }
      }
      finish();
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        marker?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
