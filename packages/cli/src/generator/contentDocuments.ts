/**
 * Deterministic JSON content generators.
 *
 * Every function here is a pure `(inputs) => JSON-serializable value` -
 * same preset in, byte-identical document out, every time (MASTER_PROJECT.md
 * section 10's determinism requirement). No timestamps, no random ids.
 */

export interface GameManifestInput {
  readonly gameId: string;
  readonly displayName: string;
  readonly systemPackIds: readonly string[];
  readonly shellPackId: string;
}

/** content/game.json - a GameDefinition. Only the recipe's *required* packs are enabled by default, plus the generated shell pack. */
export function generateGameManifest(input: GameManifestInput): Record<string, unknown> {
  return {
    id: input.gameId,
    displayName: input.displayName,
    version: '0.1.0',
    schemaVersion: 1,
    viewport: { width: 960, height: 540 },
    bindings: {},
    // `config: {}`, not omitted: a pack with a real configSchemaId (e.g.
    // sw2d.progression) has a schema requiring an object, and an omitted
    // config resolves to `undefined`, which fails that schema - the same
    // reason content/game.json's own systemPacks entries always carry
    // `config: {}` (see starter/content/game.json).
    systemPacks: [...input.systemPackIds.map((packId) => ({ packId, config: {} })), { packId: input.shellPackId, config: {} }],
    defaultSettings: { masterVolume: 0.7 },
  };
}

/**
 * content/items.json - an ItemCatalog (capability program Phase 2). Always
 * emitted (like content/levels/main.json) so content.ts can always load and
 * validate it; a preset whose requiredContentRoles include 'items' gets a
 * one-item starter catalog whose `coin-1` matches the universal proof
 * level's Collectible, so its pickups grant a real canonical item and apply
 * its effect through the reusable `sw2d.items` service. Other presets get an
 * empty catalog.
 */
export function generateItemCatalog(hasItemsRole: boolean): Record<string, unknown> {
  if (!hasItemsRole) return { schemaVersion: 1, items: [] };
  return {
    schemaVersion: 1,
    items: [
      {
        id: 'coin-1',
        displayName: 'Coin',
        category: 'collectible',
        tags: ['currency'],
        assetRole: 'pickup',
        stackable: true,
        consumable: false,
        quantityPerGrant: 1,
        effects: [{ kind: 'arcade.score', amount: 5 }],
      },
    ],
  };
}

/** content/tuning.json - the one content document @sw2d/schemas validates for every game today. */
export function generateTuning(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    player: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  };
}

/** content/themes/<themeId>/theme.json - a ThemeManifest. Colours vary slightly by themeId so add-theme's second theme is visually distinguishable, without claiming any real design system. */
export function generateTheme(themeId: string, displayName: string): Record<string, unknown> {
  const palette = paletteFor(themeId);
  return {
    schemaVersion: 1,
    id: themeId,
    displayName,
    assets: [
      { role: 'player', key: `theme/${themeId}/player`, spec: { kind: 'generated', width: 28, height: 44, fill: palette.player, stroke: '#0b0d13', strokeWidth: 2, cornerRadius: 6 } },
      { role: 'enemy', key: `theme/${themeId}/enemy`, spec: { kind: 'generated', width: 26, height: 26, fill: palette.enemy, stroke: '#3a0010', strokeWidth: 2 } },
      { role: 'platform', key: `theme/${themeId}/platform`, spec: { kind: 'generated', width: 64, height: 16, fill: palette.platform, stroke: '#5a678f', strokeWidth: 1 } },
      { role: 'pickup', key: `theme/${themeId}/pickup`, spec: { kind: 'generated', width: 14, height: 14, fill: palette.pickup, cornerRadius: 7 } },
      { role: 'hazard', key: `theme/${themeId}/hazard`, spec: { kind: 'generated', width: 20, height: 18, fill: palette.hazard, stroke: '#7a1f1a', strokeWidth: 1 } },
      { role: 'checkpoint', key: `theme/${themeId}/checkpoint`, spec: { kind: 'generated', width: 20, height: 24, fill: palette.checkpoint, stroke: '#173a5c', strokeWidth: 1 } },
      { role: 'exit', key: `theme/${themeId}/exit`, spec: { kind: 'generated', width: 22, height: 44, fill: palette.exit, stroke: '#3a2159', strokeWidth: 1 } },
    ],
    tokens: {
      background: '#0b0d13',
      panel: '#1a1f2b',
      panelActive: '#2b3446',
      text: '#e8ecf4',
      accent: palette.player,
      border: '#384054',
    },
    fonts: { ui: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
    highContrastTokens: {
      background: '#000000',
      panel: '#000000',
      panelActive: '#1a1a1a',
      text: '#ffffff',
      accent: '#ffe14d',
      border: '#ffffff',
    },
  };
}

interface Palette {
  readonly player: string;
  readonly enemy: string;
  readonly platform: string;
  readonly pickup: string;
  readonly hazard: string;
  readonly checkpoint: string;
  readonly exit: string;
}

const DEFAULT_PALETTE: Palette = {
  player: '#65d0a8',
  enemy: '#e05fa0',
  platform: '#39415a',
  pickup: '#f0c274',
  hazard: '#e0574f',
  checkpoint: '#4f9ee0',
  exit: '#b98af0',
};

const ALTERNATE_PALETTE: Palette = {
  player: '#ff5ad1',
  enemy: '#ffb454',
  platform: '#1c1240',
  pickup: '#5affe0',
  hazard: '#ff3860',
  checkpoint: '#5ac8ff',
  exit: '#c9ff5a',
};

/** Deterministic, not random: 'default' (and any id starting with it) gets the default palette; every other id gets the alternate one. */
function paletteFor(themeId: string): Palette {
  return themeId === 'default' ? DEFAULT_PALETTE : ALTERNATE_PALETTE;
}

/** The same 7 roles generateTheme() always emits for a game's default theme - see that function above. */
const THEME_ROLES = ['player', 'enemy', 'platform', 'pickup', 'hazard', 'checkpoint', 'exit'] as const;

/**
 * resources/RESOURCE_MANIFEST.json - a per-game ResourceManifest (@sw2d/contracts,
 * validated by @sw2d/schemas' validateResourceManifest) recording that every
 * asset a generated game ships is project-owned/generated placeholder
 * content, not silently-unrecorded third-party material. Phase 11 section 6:
 * "generated placeholder resources are honestly recorded", and `pack`
 * validates this file before producing a release candidate. Mirrors the
 * existing repo-level docs/resources/VISUAL_ASSET_MANIFEST.json convention
 * (one record per theme role) rather than inventing a second shape.
 */
export function generateResourceManifest(gameId: string): Record<string, unknown> {
  return {
    manifestVersion: 1,
    updated: 'generated-at-scaffold',
    category: 'visual',
    records: THEME_ROLES.map((role) => ({
      id: `${gameId}.default.${role}`,
      category: 'visual',
      sourceKind: 'project-owned',
      license: 'project-owned',
      attributionRequired: false,
      modificationStatus: 'generated',
      localPath: 'content/themes/default/theme.json',
      status: 'approved',
    })),
  };
}

/**
 * content/levels/<levelId>.json - a small, universal proof level using
 * exactly the Phase 6 object-class subset (ADR-0014): one Solid ground
 * strip, PlayerSpawn, Checkpoint, Collectible, Hazard, Exit. The same
 * fixture every time, by design - it exists to prove the Tiled pipeline is
 * real for every generated game, not to be a designed level.
 */
export function generateTiledLevel(): Record<string, unknown> {
  return {
    type: 'map',
    orientation: 'orthogonal',
    infinite: false,
    width: 30,
    height: 17,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      { type: 'tilelayer', name: 'Background', width: 30, height: 17 },
      {
        type: 'objectgroup',
        name: 'Solids',
        objects: [{ id: 1, class: 'Solid', name: 'Ground', x: 0, y: 500, width: 960, height: 40 }],
      },
      {
        type: 'objectgroup',
        name: 'Entities',
        objects: [
          {
            id: 2,
            class: 'PlayerSpawn',
            name: 'Start',
            x: 60,
            y: 440,
            width: 0,
            height: 0,
            properties: [{ name: 'facing', type: 'string', value: 'right' }],
          },
          {
            id: 3,
            class: 'Checkpoint',
            name: 'Checkpoint A',
            x: 180,
            y: 470,
            width: 24,
            height: 24,
            properties: [{ name: 'checkpointId', type: 'string', value: 'checkpoint-1' }],
          },
          {
            id: 4,
            class: 'Collectible',
            name: 'Coin',
            x: 300,
            y: 474,
            width: 16,
            height: 16,
            properties: [
              { name: 'itemId', type: 'string', value: 'coin-1' },
              { name: 'value', type: 'int', value: 5 },
            ],
          },
          {
            id: 5,
            class: 'Hazard',
            name: 'Spikes',
            x: 450,
            y: 482,
            width: 60,
            height: 18,
            properties: [{ name: 'damage', type: 'int', value: 10 }],
          },
          {
            id: 6,
            class: 'Exit',
            name: 'Level Exit',
            x: 900,
            y: 440,
            width: 24,
            height: 48,
            properties: [{ name: 'exitId', type: 'string', value: 'exit-1' }],
          },
        ],
      },
    ],
  };
}
