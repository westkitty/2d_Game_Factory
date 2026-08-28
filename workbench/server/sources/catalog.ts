/**
 * The curated free-pack catalogue.
 *
 * This is data, not a crawler. Each entry was checked by hand against the
 * provider's current licence statement and its pack page; the URL, licence id,
 * evidence URL and the date it was checked are recorded so the UI can show
 * exact provenance before anything is downloaded. Adding a pack means checking
 * it and adding a row here - there is no code path that discovers arbitrary
 * packs from the open web.
 *
 * Kenney packs ship individual PNG sprites/tiles plus a `Vector/` folder of
 * SVGs. Only the PNGs are ever used; SVG is recorded (`containsSvgAlongsidePng`)
 * and skipped (architectural law 12).
 */

import type { SourceCandidate } from './types.ts';

/** Date the licence evidence in this file was last checked by hand. */
export const CATALOG_VERIFIED_AT = '2026-08-28';

const KENNEY_LICENSE_EVIDENCE = 'https://kenney.nl/support';

interface RawKenneyPack {
  readonly packId: string;
  readonly title: string;
  readonly sourcePage: string;
  readonly acquisitionUrl: string;
  readonly tags: readonly string[];
  readonly camera: SourceCandidate['camera'];
  readonly tileSize: SourceCandidate['tileSize'];
  readonly pixelArt: boolean;
  readonly hasAnimationFrames: boolean;
  readonly fileCount: number;
  readonly downloadBytesEstimate: number;
  readonly roleHints: SourceCandidate['roleHints'];
}

const KENNEY_PACKS: readonly RawKenneyPack[] = [
  {
    packId: 'tiny-dungeon',
    title: 'Tiny Dungeon',
    sourcePage: 'https://kenney.nl/assets/tiny-dungeon',
    acquisitionUrl: 'https://kenney.nl/media/pages/assets/tiny-dungeon/f8422efb44-1674742415/kenney_tiny-dungeon.zip',
    tags: ['pixel-art', 'roguelike', 'dungeon', 'rpg', '16x16'],
    camera: 'top-down',
    tileSize: { width: 16, height: 16 },
    pixelArt: true,
    hasAnimationFrames: false,
    fileCount: 130,
    downloadBytesEstimate: 700_000,
    roleHints: { player: 0.9, enemy: 0.9, tile: 0.95, pickup: 0.8, hazard: 0.6, exit: 0.7, background: 0.4 },
  },
  {
    packId: 'tiny-town',
    title: 'Tiny Town',
    sourcePage: 'https://kenney.nl/assets/tiny-town',
    acquisitionUrl: 'https://kenney.nl/media/pages/assets/tiny-town/a415fbeb49-1735736916/kenney_tiny-town.zip',
    tags: ['pixel-art', 'overworld', 'town', 'map', 'rpg', '16x16'],
    camera: 'top-down',
    tileSize: { width: 16, height: 16 },
    pixelArt: true,
    hasAnimationFrames: false,
    fileCount: 130,
    downloadBytesEstimate: 700_000,
    roleHints: { tile: 0.95, background: 0.8, player: 0.6, pickup: 0.5, exit: 0.4 },
  },
  {
    packId: 'pixel-platformer',
    title: 'Pixel Platformer',
    sourcePage: 'https://kenney.nl/assets/pixel-platformer',
    acquisitionUrl: 'https://kenney.nl/media/pages/assets/pixel-platformer/33bb4921eb-1696667883/kenney_pixel-platformer.zip',
    tags: ['pixel-art', 'platformer', 'side-view', 'tiles', 'characters', '18x18'],
    camera: 'side',
    tileSize: { width: 18, height: 18 },
    pixelArt: true,
    hasAnimationFrames: true,
    fileCount: 200,
    downloadBytesEstimate: 900_000,
    roleHints: { player: 0.9, enemy: 0.8, tile: 0.95, platform: 0.9, pickup: 0.85, hazard: 0.7, background: 0.7, checkpoint: 0.4 },
  },
  {
    packId: 'top-down-shooter',
    title: 'Top-down Shooter',
    sourcePage: 'https://kenney.nl/assets/top-down-shooter',
    acquisitionUrl: 'https://kenney.nl/media/pages/assets/top-down-shooter/230204340a-1677694684/kenney_top-down-shooter.zip',
    tags: ['top-down', 'shooter', 'zombie', 'tiles', 'characters', 'action'],
    camera: 'top-down',
    tileSize: { width: 64, height: 64 },
    pixelArt: false,
    hasAnimationFrames: false,
    fileCount: 260,
    downloadBytesEstimate: 3_500_000,
    roleHints: { player: 0.85, enemy: 0.85, tile: 0.8, hazard: 0.6, pickup: 0.6, particle: 0.5 },
  },
  {
    packId: '1-bit-pack',
    title: '1-Bit Pack',
    sourcePage: 'https://kenney.nl/assets/1-bit-pack',
    acquisitionUrl: 'https://kenney.nl/media/pages/assets/1-bit-pack/aa867a1f37-1677578516/kenney_1-bit-pack.zip',
    tags: ['pixel-art', 'monochrome', '1-bit', 'tiles', 'rpg', 'platformer', 'ui', '16x16'],
    camera: 'mixed',
    tileSize: { width: 16, height: 16 },
    pixelArt: true,
    hasAnimationFrames: false,
    fileCount: 1078,
    downloadBytesEstimate: 6_000_000,
    roleHints: {
      player: 0.8,
      enemy: 0.8,
      tile: 0.95,
      platform: 0.8,
      pickup: 0.8,
      hazard: 0.7,
      background: 0.6,
      exit: 0.6,
      'ui.panel': 0.5,
      'ui.button': 0.4,
    },
  },
];

/**
 * The raw catalogue rows, provider-agnostic. `rights` is filled in by the
 * provider using `evaluateRights`, so the freshness/attribution decision is
 * made once and consistently.
 */
export function kenneyCatalogRows(): readonly (Omit<SourceCandidate, 'rights'> & { readonly licenseId: string; readonly licenseName: string; readonly licenseEvidenceUrl: string })[] {
  return KENNEY_PACKS.map((pack) => ({
    providerId: 'kenney',
    packId: pack.packId,
    title: pack.title,
    creator: 'Kenney',
    sourcePage: pack.sourcePage,
    acquisitionUrl: pack.acquisitionUrl,
    rasterFormats: ['png'] as const,
    containsSvgAlongsidePng: true,
    tags: pack.tags,
    ...(pack.camera ? { camera: pack.camera } : {}),
    ...(pack.tileSize ? { tileSize: pack.tileSize } : {}),
    pixelArt: pack.pixelArt,
    hasAnimationFrames: pack.hasAnimationFrames,
    fileCount: pack.fileCount,
    downloadBytesEstimate: pack.downloadBytesEstimate,
    roleHints: pack.roleHints,
    licenseId: 'CC0-1.0',
    licenseName: 'Creative Commons Zero v1.0 Universal (CC0)',
    licenseEvidenceUrl: KENNEY_LICENSE_EVIDENCE,
  }));
}
