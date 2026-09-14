/**
 * Scrolling-stage pack (Category-C capability program, Wave 8).
 *
 * Renderer-neutral shmup stage progress. The ship stays in a screen-space
 * band while the stage streams past. Overlay-matching constants live in
 * generated `content/stage-scroll.json`.
 *
 * Bounded modes: horizontal (stream left, fire +X) and vertical (stream
 * down, fire -Y). Empty catalogs (length or speed not positive) stay inert.
 * Deliberately not folded into `sw2d.world`: that pack is flags/checkpoints,
 * not a camera. Not a rail-path camera and not a second combat authority.
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  StageScrollCatalog,
  StageScrollHazardState,
  StageScrollLayerState,
  StageScrollMode,
  StageScrollOutcome,
  StageScrollService,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { DuplicateStageScrollIdError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

function assertUniqueIds(catalog: StageScrollCatalog): void {
  const seen = new Set<string>();
  for (const hazard of catalog.hazards) {
    if (seen.has(hazard.id)) throw new DuplicateStageScrollIdError(hazard.id);
    seen.add(hazard.id);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const EMPTY_CATALOG: StageScrollCatalog = {
  schemaVersion: 1,
  mode: 'horizontal',
  speed: 0,
  length: 0,
  viewport: { width: 960, height: 540 },
  player: { x: 120, y: 270, radius: 16, speed: 0, minX: 0, maxX: 960, minY: 0, maxY: 540 },
  hazards: [],
};

class StageScrollServiceImpl implements StageScrollService {
  private scrolled = 0;
  private cross = 0;
  private px: number;
  private py: number;
  private mx = 0;
  private my = 0;
  private hit: string | null = null;
  private current: StageScrollOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly catalog: StageScrollCatalog,
  ) {
    assertUniqueIds(catalog);
    this.px = catalog.player.x;
    this.py = catalog.player.y;
  }

  mode(): StageScrollMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.length > 0 && this.catalog.speed > 0;
  }

  setMove(x: number, y: number): void {
    this.mx = clamp(x, -1, 1);
    this.my = clamp(y, -1, 1);
  }

  tick(deltaMs: number): void {
    this.hit = null;
    if (!this.active() || this.current !== 'playing') return;
    const dt = Math.max(0, deltaMs);
    const { player, length } = this.catalog;
    this.px = clamp(this.px + this.mx * player.speed * (dt / 1000), player.minX, player.maxX);
    this.py = clamp(this.py + this.my * player.speed * (dt / 1000), player.minY, player.maxY);
    const leg = this.activeLeg();
    const speed = leg?.speed ?? this.catalog.speed;
    this.scrolled = Math.min(length, this.scrolled + speed * (dt / 1000));
    if (leg) this.cross += leg.crossDrift * (dt / 1000);
    for (const hazard of this.hazards()) {
      if (!hazard.visible) continue;
      if (Math.hypot(this.px - hazard.x, this.py - hazard.y) < player.radius + hazard.radius) {
        this.hit = hazard.id;
        this.events.emit('stageScroll:hit', { hazardId: hazard.id });
        break;
      }
    }
    if (this.scrolled >= length) {
      this.current = 'complete';
      this.events.emit('stageScroll:completed', { mode: this.catalog.mode });
    }
  }

  offset(): number {
    return this.scrolled;
  }

  layers(): readonly StageScrollLayerState[] {
    return (this.catalog.layers ?? []).map((layer) => ({
      id: layer.id,
      offset: this.scrolled * layer.speedFactor,
      speedFactor: layer.speedFactor,
      spacing: layer.spacing,
      size: layer.size,
      alpha: layer.alpha,
      cross: layer.cross - this.cross * layer.speedFactor,
    }));
  }

  currentSpeed(): number {
    return this.activeLeg()?.speed ?? this.catalog.speed;
  }

  crossOffset(): number {
    return this.cross;
  }

  railLeg(): number {
    const rail = this.catalog.rail ?? [];
    let index = -1;
    for (let i = 0; i < rail.length; i++) if (this.scrolled >= rail[i]!.from) index = i;
    return index;
  }

  private activeLeg(): { speed: number; crossDrift: number } | null {
    const index = this.railLeg();
    return index >= 0 ? this.catalog.rail![index]! : null;
  }

  progress(): number {
    if (this.catalog.length <= 0) return 0;
    return Math.min(1, this.scrolled / this.catalog.length);
  }

  player() {
    return { x: this.px, y: this.py, radius: this.catalog.player.radius };
  }

  fireDir() {
    return this.catalog.mode === 'vertical' ? { x: 0, y: -1 } : { x: 1, y: 0 };
  }

  hazards(): readonly StageScrollHazardState[] {
    return this.catalog.hazards.map((hazard) => {
      const { x, y } = this.hazardScreen(hazard.along, hazard.cross);
      const pad = hazard.radius + 8;
      const visible =
        x >= -pad &&
        x <= this.catalog.viewport.width + pad &&
        y >= -pad &&
        y <= this.catalog.viewport.height + pad;
      return { id: hazard.id, x, y, radius: hazard.radius, visible };
    });
  }

  lastHit(): string | null {
    return this.hit;
  }

  outcome(): StageScrollOutcome {
    return this.current;
  }

  reset(): void {
    this.scrolled = 0;
    this.cross = 0;
    this.px = this.catalog.player.x;
    this.py = this.catalog.player.y;
    this.mx = 0;
    this.my = 0;
    this.hit = null;
    this.current = 'playing';
  }

  private hazardScreen(along: number, cross: number): { x: number; y: number } {
    if (this.catalog.mode === 'vertical') {
      return { x: cross - this.cross, y: this.scrolled - along };
    }
    return { x: this.catalog.viewport.width - (this.scrolled - along), y: cross - this.cross };
  }
}

export const stageScrollPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.stageScroll,
  version: '0.2.0',
  provides: [CAPABILITY_IDS.stageScroll],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['stage-scroll']?.value as StageScrollCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new StageScrollServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.stageScroll, service);
    return {
      id: PACK_IDS.stageScroll,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { StageScrollService };
