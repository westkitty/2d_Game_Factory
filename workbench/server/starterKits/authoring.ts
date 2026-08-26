/**
 * Shared authoring helpers for the expanded starter-kit programme.
 *
 * These helpers deliberately build only the normal game-side overlay shape.
 * They do not register kits, change preset maturity, or touch the shared
 * runtime. Sonnet can use them to avoid copy/paste drift while each genre's
 * actual mechanic policy stays in that kit's game-specific shell.
 */

import { PRESENTATION_MODULE } from './presentation.ts';

export interface StarterSystemPackSelection {
  readonly packId: string;
  readonly config?: Readonly<Record<string, unknown>>;
}

export interface StarterLevelSpec {
  readonly entities?: readonly Readonly<Record<string, unknown>>[];
  readonly solids?: readonly Readonly<Record<string, unknown>>[];
  readonly width?: number;
  readonly height?: number;
  readonly tileWidth?: number;
  readonly tileHeight?: number;
}

export interface StarterTuningSpec {
  readonly moveSpeed?: number;
  readonly jumpVelocity?: number;
  readonly gravity?: number;
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface StarterOverlaySpec {
  readonly gameId: string;
  readonly displayName: string;
  readonly shellPackId: string;
  readonly shellSource: string;
  readonly systemPacks: readonly StarterSystemPackSelection[];
  readonly level?: StarterLevelSpec;
  readonly tuning?: StarterTuningSpec;
  readonly extraFiles?: ReadonlyMap<string, string>;
  readonly includePresentation?: boolean;
}

export function starterManifest(
  gameId: string,
  displayName: string,
  shellPackId: string,
  systemPacks: readonly StarterSystemPackSelection[],
): string {
  const selections = [
    ...systemPacks.map((selection) => ({ packId: selection.packId, config: selection.config ?? {} })),
    { packId: shellPackId, config: {} },
  ];
  return `${JSON.stringify({
    id: gameId,
    displayName,
    version: '0.1.0',
    schemaVersion: 1,
    viewport: { width: 960, height: 540 },
    bindings: {},
    systemPacks: selections,
    defaultSettings: { masterVolume: 0.7 },
  }, null, 2)}\n`;
}

export function starterLevel(spec: StarterLevelSpec = {}): string {
  const width = spec.width ?? 30;
  const height = spec.height ?? 17;
  const tileWidth = spec.tileWidth ?? 32;
  const tileHeight = spec.tileHeight ?? 32;
  return `${JSON.stringify({
    type: 'map',
    orientation: 'orthogonal',
    infinite: false,
    width,
    height,
    tilewidth: tileWidth,
    tileheight: tileHeight,
    layers: [
      { type: 'tilelayer', name: 'Background', width, height },
      { type: 'objectgroup', name: 'Solids', objects: spec.solids ?? [] },
      { type: 'objectgroup', name: 'Entities', objects: spec.entities ?? [] },
    ],
  }, null, 2)}\n`;
}

/** The tuning schema requires all three player numbers to stay positive. */
export function starterTuning(spec: StarterTuningSpec = {}): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    player: {
      moveSpeed: spec.moveSpeed ?? 220,
      jumpVelocity: spec.jumpVelocity ?? 430,
      gravity: spec.gravity ?? 1100,
    },
    ...(spec.extra ?? {}),
  }, null, 2)}\n`;
}

export function buildStarterKitOverlay(spec: StarterOverlaySpec): ReadonlyMap<string, string> {
  const files = new Map<string, string>([
    ['src/game-specific/shellPack.ts', spec.shellSource],
    ['content/game.json', starterManifest(spec.gameId, spec.displayName, spec.shellPackId, spec.systemPacks)],
    ['content/levels/main.json', starterLevel(spec.level)],
    ['content/tuning.json', starterTuning(spec.tuning)],
  ]);
  if (spec.includePresentation !== false) files.set('src/game-specific/presentation.ts', PRESENTATION_MODULE);
  for (const [path, contents] of spec.extraFiles ?? []) files.set(path, contents);
  return files;
}
