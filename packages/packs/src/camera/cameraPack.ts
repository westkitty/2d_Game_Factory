/**
 * Rail-path camera and framing capture (Category-C Wave 30).
 *
 * Renderer-neutral camera machine. Overlay kits stay local. Empty catalogs
 * stay inert.
 *
 * Bounded modes: rail (t advances along authored points) and frame (a
 * capture rect scores when a subject is contained). Not stage-scroll.
 */

import type {
  CameraCatalog,
  CameraMode,
  CameraOutcome,
  CameraService,
  EventBus,
  GameContext,
  InstalledSystemPack,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const EMPTY_CATALOG: CameraCatalog = {
  schemaVersion: 1,
  mode: 'rail',
  points: [{ x: 0, y: 0 }],
  speed: 0,
  frame: { width: 1, height: 1 },
  subjects: [],
  shotsToWin: 0,
};

class CameraServiceImpl implements CameraService {
  private t = 0;
  private cx: number;
  private cy: number;
  private readonly capturedSet = new Set<string>();
  private last: string | null = null;
  private current: CameraOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly catalog: CameraCatalog,
  ) {
    this.cx = catalog.points[0]?.x ?? 0;
    this.cy = catalog.points[0]?.y ?? 0;
  }

  mode(): CameraMode {
    return this.catalog.mode;
  }

  active(): boolean {
    if (this.catalog.mode === 'rail') return this.catalog.speed > 0 && this.catalog.points.length >= 2;
    return this.catalog.shotsToWin > 0 && this.catalog.subjects.length > 0;
  }

  tick(deltaMs: number): void {
    if (!this.active() || this.current !== 'playing' || this.catalog.mode !== 'rail') return;
    this.t = Math.min(1, this.t + this.catalog.speed * (deltaMs / 1000));
    if (this.t >= 1) this.last = 'rail-end';
  }

  setFrame(nx: number, ny: number): void {
    if (!this.active()) return;
    this.cx = nx;
    this.cy = ny;
  }

  capture(): boolean {
    if (!this.active() || this.current !== 'playing' || this.catalog.mode !== 'frame') {
      this.last = 'no-shot';
      return false;
    }
    const hw = this.catalog.frame.width * 0.5;
    const hh = this.catalog.frame.height * 0.5;
    let hit: string | null = null;
    for (const subject of this.catalog.subjects) {
      if (this.capturedSet.has(subject.id)) continue;
      if (Math.abs(subject.x - this.cx) <= hw && Math.abs(subject.y - this.cy) <= hh) {
        hit = subject.id;
        break;
      }
    }
    if (hit === null) {
      this.last = 'miss';
      return false;
    }
    this.capturedSet.add(hit);
    this.last = `shot-${hit}`;
    this.events.emit('camera:shot', { subjectId: hit, shots: this.capturedSet.size });
    if (this.capturedSet.size >= this.catalog.shotsToWin) {
      this.current = 'complete';
      this.last = 'album';
      this.events.emit('camera:completed', { mode: this.catalog.mode });
    }
    return true;
  }

  originX(): number {
    return this.catalog.mode === 'rail' ? this.originAt(this.t).x : this.cx;
  }

  originY(): number {
    return this.catalog.mode === 'rail' ? this.originAt(this.t).y : this.cy;
  }

  progress(): number {
    return this.t;
  }

  shots(): number {
    return this.capturedSet.size;
  }

  captured(): readonly string[] {
    return [...this.capturedSet];
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): CameraOutcome {
    return this.current;
  }

  reset(): void {
    this.t = 0;
    this.cx = this.catalog.points[0]?.x ?? 0;
    this.cy = this.catalog.points[0]?.y ?? 0;
    this.capturedSet.clear();
    this.last = null;
    this.current = 'playing';
  }

  private originAt(progress: number): { x: number; y: number } {
    const pts = this.catalog.points;
    if (pts.length === 0) return { x: 0, y: 0 };
    if (pts.length === 1) return { x: pts[0]!.x, y: pts[0]!.y };
    const clamped = Math.max(0, Math.min(1, progress));
    const scaled = clamped * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(scaled));
    const u = scaled - i;
    const a = pts[i]!;
    const b = pts[i + 1]!;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  }
}

export const cameraPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.camera,
  version: '1.0.0',
  provides: [CAPABILITY_IDS.camera],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['camera']?.value as CameraCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new CameraServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.camera, service);
    return {
      id: PACK_IDS.camera,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { CameraService };
