/**
 * Rail-path camera and framing capture (Category-C Wave 35).
 *
 * Renderer-neutral camera machine. Two bounded modes:
 *   - `rail`  — t advances along authored points; camera origin follows.
 *   - `frame` — a capture rect scores when a subject is contained.
 *
 * Not stage-scroll band clamp and not a photo-export pipeline.
 */

export const CAMERA_CAPABILITY_ID = 'world.camera';

export type CameraMode = 'rail' | 'frame';
export type CameraOutcome = 'playing' | 'complete';

export interface CameraPointDef {
  readonly x: number;
  readonly y: number;
}

export interface CameraSubjectDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface CameraCatalog {
  readonly schemaVersion: number;
  readonly mode: CameraMode;
  readonly points: readonly CameraPointDef[];
  readonly speed: number;
  readonly frame: { readonly width: number; readonly height: number };
  readonly subjects: readonly CameraSubjectDef[];
  readonly shotsToWin: number;
}

export interface CameraService {
  mode(): CameraMode;
  active(): boolean;
  tick(deltaMs: number): void;
  setFrame(cx: number, cy: number): void;
  capture(): boolean;
  originX(): number;
  originY(): number;
  progress(): number;
  shots(): number;
  captured(): readonly string[];
  lastResult(): string | null;
  outcome(): CameraOutcome;
  reset(): void;
}
