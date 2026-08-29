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
  /** Capability program Phase 9: when 'matter', the game opts into the Matter backend. */
  readonly physicsProfile?: 'matter';
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
    ...(input.physicsProfile ? { physicsProfile: input.physicsProfile } : {}),
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

/**
 * content/weapons.json - a WeaponCatalog (capability program Phase 3). Always
 * emitted (like content/items.json); a preset that installs `sw2d.weapons`
 * gets a one-weapon starter catalog so its generated shell equips and fires a
 * real projectile through the reusable runtime, others get an empty catalog.
 */
export function generateWeaponCatalog(hasWeaponsPack: boolean): Record<string, unknown> {
  if (!hasWeaponsPack) return { schemaVersion: 1, weapons: [] };
  return {
    schemaVersion: 1,
    weapons: [
      {
        id: 'sidearm',
        displayName: 'Sidearm',
        team: 'player',
        cooldownMs: 220,
        fireMode: 'single',
        muzzleOffset: 18,
        projectile: { assetRole: 'pickup', speed: 460, lifetimeMs: 1200, size: 8, damage: 10 },
      },
    ],
  };
}

/**
 * content/encounters.json - an EncounterCatalog (capability program Phase 4).
 * Always emitted; empty unless the preset installs `sw2d.encounters`.
 */
export function generateEncounterCatalog(hasEncountersPack: boolean): Record<string, unknown> {
  if (!hasEncountersPack) return { schemaVersion: 1, encounters: [] };
  return {
    schemaVersion: 1,
    encounters: [
      {
        id: 'starter-skirmish',
        phases: [
          {
            id: 'wave-1',
            spawns: [{ archetype: 'grunt', count: 3, at: { kind: 'edge', edge: 'top' }, intervalMs: 500, health: 20 }],
            completeWhen: { kind: 'spawns-cleared' },
          },
        ],
      },
    ],
  };
}

/**
 * content/puzzles.json - a PuzzleRulesDoc (capability program Phase 6).
 * Always emitted; empty unless the preset installs `sw2d.puzzle-rules`. A
 * puzzle-family preset gets one built-in starter definition matching its
 * kind, so its generated shell loads an entire ruleset - moves, undo, reset,
 * solved-detection - from serialized data with no `createInitialState` /
 * `isSolved` callback.
 */
export function generatePuzzleRulesDoc(kind: 'sokoban' | 'switch-sequence' | 'none'): Record<string, unknown> {
  if (kind === 'sokoban') {
    return {
      schemaVersion: 1,
      puzzles: [
        {
          id: 'starter',
          kind: 'sokoban',
          width: 7,
          height: 5,
          walls: [
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
            [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
            [0, 1], [0, 2], [0, 3], [6, 1], [6, 2], [6, 3],
          ],
          boxes: [[3, 2]],
          goals: [[5, 2]],
          player: [1, 2],
        },
      ],
    };
  }
  if (kind === 'switch-sequence') {
    return {
      schemaVersion: 1,
      puzzles: [
        {
          id: 'starter',
          kind: 'switch-sequence',
          switches: ['a', 'b', 'c'],
          completeWhen: { kind: 'all-on' },
        },
      ],
    };
  }
  return { schemaVersion: 1, puzzles: [] };
}

/**
 * content/generation.json - a GenerationDoc (capability program Phase 7).
 * Always emitted; empty unless the preset installs `sw2d.generation`. A
 * preset that does gets a bounded starter generator of the family matching
 * its controller (segment-chain for runners, room-graph for top-down
 * dungeons, road-chain for driving), so its generated shell builds the
 * playable world from a deterministic seed - same seed, identical layout.
 */
export function generateGenerationDoc(kind: 'segment-chain' | 'room-graph' | 'road-chain' | 'none'): Record<string, unknown> {
  if (kind === 'segment-chain') {
    return {
      schemaVersion: 1,
      seed: 1337,
      generators: [
        {
          id: 'main',
          kind: 'segment-chain',
          count: 10,
          startTags: ['start'],
          maxImmediateRepeat: 2,
          templates: [
            { id: 'start-flat', entrySocket: 'ground', exitSocket: 'ground', weight: 1, difficulty: 0, tags: ['start'], length: 320, groundY: 480 },
            { id: 'flat', entrySocket: 'ground', exitSocket: 'ground', weight: 3, difficulty: 0, tags: ['run'], length: 288, groundY: 480, collectibles: [96, 192] },
            { id: 'gap', entrySocket: 'ground', exitSocket: 'ground', weight: 2, difficulty: 1, tags: ['run'], length: 320, groundY: 480, gapStart: 128, gapWidth: 96 },
            { id: 'hazard', entrySocket: 'ground', exitSocket: 'ground', weight: 2, difficulty: 1, tags: ['run'], length: 288, groundY: 480, hazards: [144] },
          ],
        },
      ],
    };
  }
  if (kind === 'room-graph') {
    return {
      schemaVersion: 1,
      seed: 4242,
      generators: [
        {
          id: 'main',
          kind: 'room-graph',
          roomCount: 6,
          criticalPathLength: 4,
          maxBranches: 2,
          startTags: ['start'],
          exitTags: ['exit'],
          templates: [
            { id: 'start-room', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 1, tags: ['start'] },
            { id: 'hall', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 3, tags: ['path'], enemies: 2 },
            { id: 'chamber', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 2, tags: ['path'], enemies: 3 },
            { id: 'exit-room', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 1, tags: ['exit'] },
          ],
        },
      ],
    };
  }
  if (kind === 'road-chain') {
    return {
      schemaVersion: 1,
      seed: 909,
      generators: [
        {
          id: 'main',
          kind: 'road-chain',
          count: 12,
          templates: [
            { id: 'straight', entryHeading: 0, exitHeading: 0, length: 240, width: 200, weight: 4, difficulty: 0, tags: ['road'] },
            { id: 'straight-obstacle', entryHeading: 0, exitHeading: 0, length: 240, width: 200, weight: 2, difficulty: 1, tags: ['road'], obstacles: [70, 130] },
          ],
        },
      ],
    };
  }
  return { schemaVersion: 1, seed: 0, generators: [] };
}

/**
 * content/world-graph.json - a WorldGraphDefinition (capability program Phase 8).
 * Always emitted; a single inert node unless the preset installs
 * `sw2d.world-graph`, in which case a 3-node starter graph (hub -> east, and a
 * west room gated behind a world flag) whose nodes all reference the one
 * generated level via distinct entrances - enough for the generated shell to
 * exercise transitions, discovery and the map.
 */
export function generateWorldGraphDoc(hasWorldGraphPack: boolean): Record<string, unknown> {
  if (!hasWorldGraphPack) {
    return {
      schemaVersion: 1,
      id: 'inert',
      startNodeId: 'root',
      nodes: [
        { id: 'root', displayName: 'Root', level: 'levels/main', mapX: 0, mapY: 0, entrances: [{ id: 'start', x: 60, y: 440 }], connections: [] },
      ],
    };
  }
  return {
    schemaVersion: 1,
    id: 'starter-world',
    displayName: 'Starter World',
    startNodeId: 'hub',
    nodes: [
      {
        id: 'hub',
        displayName: 'Hub',
        level: 'levels/main',
        mapX: 1,
        mapY: 0,
        entrances: [
          { id: 'start', x: 60, y: 440, facing: 'right' },
          { id: 'from-east', x: 840, y: 440, facing: 'left' },
          { id: 'from-west', x: 120, y: 440, facing: 'right' },
        ],
        connections: [
          { id: 'hub-east', destinationNodeId: 'east', destinationEntranceId: 'from-hub', mapLabel: 'east' },
          { id: 'hub-west', destinationNodeId: 'west', destinationEntranceId: 'from-hub', conditions: [{ kind: 'flag', flag: 'west-gate-open', value: true }], mapLabel: 'west (locked)' },
        ],
      },
      {
        id: 'east',
        displayName: 'East Room',
        level: 'levels/main',
        mapX: 2,
        mapY: 0,
        entrances: [{ id: 'from-hub', x: 60, y: 440, facing: 'right' }],
        connections: [{ id: 'east-hub', destinationNodeId: 'hub', destinationEntranceId: 'from-east', mapLabel: 'hub' }],
      },
      {
        id: 'west',
        displayName: 'West Room',
        level: 'levels/main',
        mapX: 0,
        mapY: 0,
        entrances: [{ id: 'from-hub', x: 840, y: 440, facing: 'left' }],
        connections: [{ id: 'west-hub', destinationNodeId: 'hub', destinationEntranceId: 'from-west', mapLabel: 'hub' }],
      },
    ],
  };
}

/**
 * content/vehicles.json - a VehicleCatalog (capability program Phase 10).
 * Always emitted; a single inert car unless the preset installs
 * `sw2d.vehicles`, in which case a starter vehicle of the preset's profile
 * (plus a flight vehicle when the profile is 'boat', so the boat/flight
 * recipe can show both). Values come from VEHICLE_PROFILE_DEFAULTS, expressed
 * inline so the document is real, editable tuning.
 */
export function generateVehicleCatalog(profile: 'car' | 'kart' | 'boat' | 'flight' | 'none'): Record<string, unknown> {
  const car = {
    id: 'starter-car',
    profile: 'car',
    acceleration: 520,
    braking: 780,
    reverseAcceleration: 260,
    maxForwardSpeed: 340,
    maxReverseSpeed: 120,
    steeringRate: 2.6,
    speedSensitiveSteering: 0.5,
    drag: 0.7,
    lateralGrip: 0.9,
    traction: 0.85,
    driftFactor: 0.15,
    boostForce: 320,
    boostDurationMs: 900,
    boostCooldownMs: 2600,
    surfaceModifiers: { dirt: { traction: 0.7, maxSpeed: 0.9 }, ice: { traction: 0.35, steering: 0.8 } },
  };
  if (profile === 'none') return { schemaVersion: 1, vehicles: [car] };
  const kart = { ...car, id: 'starter-kart', profile: 'kart', steeringRate: 3.6, speedSensitiveSteering: 0.3, lateralGrip: 0.72, traction: 0.7, driftFactor: 0.55, boostCooldownMs: 2000 };
  const boat = { ...car, id: 'starter-boat', profile: 'boat', acceleration: 300, braking: 180, maxForwardSpeed: 260, steeringRate: 1.5, drag: 0.9, lateralGrip: 0.35, traction: 0.4, surfaceModifiers: { water: { drag: 0.95 } } };
  const flight = {
    id: 'starter-flight',
    profile: 'flight',
    acceleration: 420,
    braking: 260,
    reverseAcceleration: 0,
    maxForwardSpeed: 400,
    maxReverseSpeed: 0,
    steeringRate: 2.0,
    speedSensitiveSteering: 0.1,
    drag: 0.92,
    lateralGrip: 0.55,
    traction: 0.5,
    driftFactor: 0.1,
    boostForce: 300,
    boostDurationMs: 1000,
    boostCooldownMs: 2600,
    altitudeRate: 90,
    minAltitude: 0,
    maxAltitude: 240,
  };
  if (profile === 'kart') return { schemaVersion: 1, vehicles: [kart] };
  if (profile === 'boat') return { schemaVersion: 1, vehicles: [boat, flight] };
  if (profile === 'flight') return { schemaVersion: 1, vehicles: [flight] };
  return { schemaVersion: 1, vehicles: [car] };
}

/**
 * content/races.json - a RaceCatalog (capability program Phase 10). Always
 * emitted; empty unless the preset installs `sw2d.racing`, then one starter
 * race: a small four-corner track, `time-trial` mode for the time-trial
 * preset and `race` (two laps) otherwise.
 */
export function generateRaceCatalog(kind: 'race' | 'time-trial' | 'none'): Record<string, unknown> {
  if (kind === 'none') return { schemaVersion: 1, races: [] };
  return {
    schemaVersion: 1,
    races: [
      {
        schemaVersion: 1,
        id: 'main',
        mode: kind,
        countdownMs: kind === 'time-trial' ? 1500 : 3000,
        laps: kind === 'time-trial' ? 1 : 2,
        startPositions: [{ x: 160, y: 440, heading: 0 }],
        checkpoints: [
          { id: 'cp-1', x: 760, y: 440, radius: 70 },
          { id: 'cp-2', x: 760, y: 120, radius: 70 },
          { id: 'cp-3', x: 200, y: 120, radius: 70 },
          { id: 'cp-4', x: 160, y: 440, radius: 70 },
        ],
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
