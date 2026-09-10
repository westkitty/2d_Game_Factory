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
export function generateWeaponCatalog(hasWeaponsPack: boolean, hasEncountersPack = false): Record<string, unknown> {
  if (!hasWeaponsPack) return { schemaVersion: 1, weapons: [] };
  const weapons: Record<string, unknown>[] = [
    {
      id: 'sidearm',
      displayName: 'Sidearm',
      team: 'player',
      cooldownMs: 220,
      fireMode: 'single',
      muzzleOffset: 18,
      projectile: { assetRole: 'pickup', speed: 460, lifetimeMs: 1200, size: 8, damage: 10 },
    },
  ];
  if (hasEncountersPack) {
    // The starter encounter's enemies fire this (content/encounters.json
    // references it by id). Slower and weaker than the player's weapon so the
    // out-of-the-box fight is winnable.
    weapons.push({
      id: 'enemy-blaster',
      displayName: 'Enemy Blaster',
      team: 'enemy',
      cooldownMs: 900,
      fireMode: 'single',
      muzzleOffset: 14,
      projectile: { assetRole: 'hazard', speed: 220, lifetimeMs: 2400, size: 8, damage: 6 },
    });
  }
  return { schemaVersion: 1, weapons };
}

/**
 * content/encounters.json - an EncounterCatalog (capability program Phase 4).
 * Always emitted; empty unless the preset installs `sw2d.encounters`.
 */
export function generateEncounterCatalog(hasEncountersPack: boolean): Record<string, unknown> {
  if (!hasEncountersPack) return { schemaVersion: 1, encounters: [] };
  // A real two-phase starter fight, not a placeholder: wave 1 is three
  // chasing grunts, wave 2 adds shooters carrying the enemy-blaster emitter
  // (generateWeaponCatalog ships that weapon whenever encounters are on).
  // The generated shell's bindStarterEncounters loops the encounter as
  // survival waves once both phases clear.
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
          {
            id: 'wave-2',
            spawns: [
              { archetype: 'grunt', count: 2, at: { kind: 'edge', edge: 'left' }, intervalMs: 600, health: 20 },
              {
                archetype: 'shooter',
                count: 2,
                at: { kind: 'edge', edge: 'top' },
                intervalMs: 900,
                health: 30,
                emitterIds: ['aimed-shot'],
              },
            ],
            emitters: [
              { id: 'aimed-shot', weaponId: 'enemy-blaster', pattern: { kind: 'aimed' }, everyMs: 1400, startDelayMs: 800 },
            ],
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
 * kind (sokoban, switch-sequence, match, falling-block), so its generated
 * shell loads an entire ruleset - moves, undo, reset, solved-detection -
 * from serialized data with no `createInitialState` / `isSolved` callback.
 */
export function generatePuzzleRulesDoc(
  kind: 'sokoban' | 'switch-sequence' | 'match' | 'falling-block' | 'none',
): Record<string, unknown> {
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
  if (kind === 'match') {
    // One adjacent swap (1,0)<->(1,1) makes column 0 three 0s.
    return {
      schemaVersion: 1,
      puzzles: [
        {
          id: 'starter',
          kind: 'match',
          width: 3,
          height: 3,
          pieceTypes: 3,
          matchLength: 3,
          objectiveClears: 3,
          board: [
            [0, 1, 2],
            [1, 0, 2],
            [0, 1, 2],
          ],
        },
      ],
    };
  }
  if (kind === 'falling-block') {
    // 3-wide bar in a 6-wide well: park the first piece on the right, drop
    // the second on the left, one line clears.
    return {
      schemaVersion: 1,
      puzzles: [
        {
          id: 'starter',
          kind: 'falling-block',
          width: 6,
          height: 10,
          pieces: [{ cells: [[0, 0], [1, 0], [2, 0]], spawnCol: 0 }],
          sequence: [0, 0, 0, 0],
          objectiveLines: 1,
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
 * content/economy.json - an EconomyCatalog (Category-C Wave 1). Always
 * emitted; empty/inert unless the preset installs `sw2d.economy`. Three
 * bounded starter modes match the three management consumers: shop
 * (serve from stock), kitchen (cook then serve), factory (produce, auto-sell).
 */
export function generateEconomyCatalog(kind: 'shop' | 'kitchen' | 'factory' | 'none'): Record<string, unknown> {
  const empty = {
    schemaVersion: 1,
    mode: 'shop',
    cash: 0,
    goods: [],
    demand: [],
    spawn: { firstDelayMs: 0, intervalMs: 1000, maxQueue: 0 },
  };
  if (kind === 'none') return empty;
  if (kind === 'shop') {
    return {
      schemaVersion: 1,
      mode: 'shop',
      cash: 12,
      goods: [
        { id: 'apple', displayName: 'Apple', price: 5, restockCost: 2, stock: 2 },
        { id: 'bread', displayName: 'Bread', price: 8, restockCost: 4, stock: 1 },
      ],
      demand: [
        { id: 'pat', displayName: 'Pat', goodId: 'apple', patienceMs: 12000 },
        { id: 'sam', displayName: 'Sam', goodId: 'bread', patienceMs: 12000 },
      ],
      spawn: { firstDelayMs: 250, intervalMs: 2200, maxQueue: 2 },
    };
  }
  if (kind === 'kitchen') {
    return {
      schemaVersion: 1,
      mode: 'kitchen',
      cash: 0,
      goods: [
        { id: 'soup', displayName: 'Soup', price: 12, stock: 0 },
        { id: 'salad', displayName: 'Salad', price: 9, stock: 0 },
      ],
      recipes: [
        { id: 'cook-soup', displayName: 'Cook soup', outputGoodId: 'soup', outputCount: 1, durationMs: 700 },
        { id: 'cook-salad', displayName: 'Toss salad', outputGoodId: 'salad', outputCount: 1, durationMs: 500 },
      ],
      demand: [
        { id: 'diner-a', displayName: 'Diner', goodId: 'soup', patienceMs: 14000 },
        { id: 'diner-b', displayName: 'Guest', goodId: 'salad', patienceMs: 14000 },
      ],
      spawn: { firstDelayMs: 250, intervalMs: 2400, maxQueue: 2 },
    };
  }
  return {
    schemaVersion: 1,
    mode: 'factory',
    cash: 8,
    autoSell: true,
    goods: [{ id: 'widget', displayName: 'Widget', price: 6, stock: 0 }],
    recipes: [{ id: 'make-widget', displayName: 'Stamp widget', outputGoodId: 'widget', outputCount: 1, durationMs: 600 }],
    demand: [
      { id: 'buyer-a', displayName: 'Buyer', goodId: 'widget', patienceMs: 16000 },
      { id: 'buyer-b', displayName: 'Client', goodId: 'widget', patienceMs: 16000 },
    ],
    spawn: { firstDelayMs: 400, intervalMs: 1800, maxQueue: 3 },
  };
}

/**
 * content/needs.json - a NeedsCatalog (Category-C Wave 2). Always emitted;
 * empty/inert unless the preset installs `sw2d.needs`. Three bounded starter
 * modes match the three care consumers: creature (hunger/mood hold-to-win),
 * habitat (water/food longer hold, fail-below), companion (instant win, no fail).
 */
export function generateNeedsCatalog(kind: 'creature' | 'habitat' | 'companion' | 'none'): Record<string, unknown> {
  const empty = {
    schemaVersion: 1,
    mode: 'creature',
    subject: { id: 'none', displayName: 'None' },
    needs: [],
    actions: [],
    win: { minValue: 100, holdMs: 0, minActions: 0 },
  };
  if (kind === 'none') return empty;
  if (kind === 'creature') {
    return {
      schemaVersion: 1,
      mode: 'creature',
      subject: { id: 'pet', displayName: 'Pico' },
      needs: [
        { id: 'hunger', displayName: 'Hunger', value: 72, min: 0, max: 100, decayPerSecond: 2.8 },
        { id: 'mood', displayName: 'Mood', value: 72, min: 0, max: 100, decayPerSecond: 2.2 },
      ],
      actions: [
        { id: 'feed', displayName: 'Feed', effects: [{ needId: 'hunger', delta: 22 }], affinityDelta: 1 },
        { id: 'play', displayName: 'Play', effects: [{ needId: 'mood', delta: 24 }], affinityDelta: 1 },
      ],
      win: { minValue: 82, holdMs: 1600, minActions: 2 },
      loseBelow: 0,
      affinity: 0,
    };
  }
  if (kind === 'habitat') {
    return {
      schemaVersion: 1,
      mode: 'habitat',
      subject: { id: 'tank', displayName: 'Tank' },
      needs: [
        { id: 'water', displayName: 'Water', value: 78, min: 0, max: 100, decayPerSecond: 3 },
        { id: 'food', displayName: 'Food', value: 78, min: 0, max: 100, decayPerSecond: 3.5 },
      ],
      actions: [
        { id: 'feed', displayName: 'Feed', effects: [{ needId: 'food', delta: 24 }] },
        { id: 'refresh', displayName: 'Refresh', effects: [{ needId: 'water', delta: 24 }] },
      ],
      win: { minValue: 55, holdMs: 7000, minActions: 2 },
      loseBelow: 10,
    };
  }
  return {
    schemaVersion: 1,
    mode: 'companion',
    subject: { id: 'buddy', displayName: 'Buddy' },
    needs: [
      { id: 'hunger', displayName: 'Hunger', value: 70, min: 0, max: 100, decayPerSecond: 3 },
      { id: 'happiness', displayName: 'Happiness', value: 70, min: 0, max: 100, decayPerSecond: 2.5 },
    ],
    actions: [
      { id: 'feed', displayName: 'Feed', effects: [{ needId: 'hunger', delta: 25 }], affinityDelta: 2 },
      { id: 'play', displayName: 'Play', effects: [{ needId: 'happiness', delta: 25 }], affinityDelta: 2 },
    ],
    win: { minValue: 85, holdMs: 0, minActions: 2 },
    affinity: 0,
  };
}

/**
 * content/dialogue.json - a DialogueCatalog (Category-C Wave 3). Always
 * emitted; empty/inert unless the preset installs `sw2d.dialogue`. Two
 * bounded starter modes match the two consumers: novel (auto-start, choice,
 * two endings) and adventure (hotspot start, gated exit).
 */
export function generateDialogueCatalog(kind: 'novel' | 'adventure' | 'none'): Record<string, unknown> {
  const empty = {
    schemaVersion: 1,
    mode: 'novel',
    conversations: [],
  };
  if (kind === 'none') return empty;
  if (kind === 'novel') {
    return {
      schemaVersion: 1,
      mode: 'novel',
      startConversationId: 'station',
      conversations: [
        {
          id: 'station',
          startNodeId: 'n0',
          nodes: [
            { id: 'n0', kind: 'line', speaker: 'Narrator', text: 'A stranger arrives at the old station.', next: 'n1' },
            { id: 'n1', kind: 'line', speaker: 'Stranger', text: 'They ask you to choose what happens next.', next: 'n2' },
            {
              id: 'n2',
              kind: 'choice',
              speaker: 'Stranger',
              text: 'What do you do?',
              choices: [
                { id: 'help', text: 'Help the stranger', next: 'n3', branchId: 'help-the-stranger', setFlag: 'helped' },
                { id: 'secret', text: 'Keep the secret', next: 'n4', branchId: 'keep-the-secret', setFlag: 'secret' },
              ],
            },
            { id: 'n3', kind: 'end', speaker: 'Narrator', text: 'Your choice changes the final scene.', ending: 'dawn-ending' },
            { id: 'n4', kind: 'end', speaker: 'Narrator', text: 'Your choice changes the final scene.', ending: 'midnight-ending' },
          ],
        },
      ],
    };
  }
  return {
    schemaVersion: 1,
    mode: 'adventure',
    conversations: [
      {
        id: 'note',
        startNodeId: 'n',
        nodes: [{ id: 'n', kind: 'end', speaker: 'You', text: 'A crumpled note: the clock is lying.', setFlag: 'saw-note' }],
      },
      {
        id: 'clock',
        startNodeId: 'c',
        nodes: [{ id: 'c', kind: 'end', speaker: 'You', text: 'The clock hides a small brass key.', setFlag: 'saw-clock' }],
      },
      {
        id: 'door',
        startNodeId: 'd',
        nodes: [{ id: 'd', kind: 'end', speaker: 'You', text: 'The door swings open.', ending: 'escaped' }],
      },
    ],
    hotspots: [
      { id: 'note', conversationId: 'note', x: 240, y: 280 },
      { id: 'clock', conversationId: 'clock', x: 480, y: 280 },
      { id: 'door', conversationId: 'door', x: 720, y: 280, requireFlags: ['saw-note', 'saw-clock'] },
    ],
  };
}

/**
 * content/perception.json - a PerceptionCatalog (Category-C Wave 4). Always
 * emitted; empty/inert unless the preset installs `sw2d.perception`. Two
 * bounded starter modes match the two consumers: infiltrate (fail on sight)
 * and heist (loot makes noise; alarm does not fail).
 */
export function generatePerceptionCatalog(kind: 'infiltrate' | 'heist' | 'none'): Record<string, unknown> {
  const empty = {
    schemaVersion: 1,
    mode: 'infiltrate',
    start: { x: 0, y: 0 },
    playerRadius: 14,
    hiddenMultiplier: 0.2,
    observers: [],
  };
  if (kind === 'none') return empty;
  const shared = {
    schemaVersion: 1,
    start: { x: 120, y: 270 },
    playerRadius: 14,
    hiddenMultiplier: 0.15,
    observers: [
      {
        id: 'guard',
        x: 520,
        y: 270,
        facingDeg: 180,
        fovDeg: 50,
        range: 220,
        suspicionRisePerSecond: 2,
        suspicionDecayPerSecond: 0.5,
      },
    ],
    cover: [{ id: 'crate', x: 400, y: 180, radius: 36 }],
    objectives: [{ id: 'intel', x: 790, y: 140, radius: 42 }],
    exits: [{ id: 'vent', x: 110, y: 90, radius: 48 }],
  };
  return { ...shared, mode: kind === 'heist' ? 'heist' : 'infiltrate' };
}

/**
 * content/ball-paddle.json - a BallPaddleCatalog (Category-C Wave 5). Always
 * emitted; empty/inert unless the preset installs `sw2d.ball-paddle`. Two
 * bounded starter modes match the two consumers: breakout (bricks + lives)
 * and pong (chasing opponent, first-to-3). Constants match the expanded
 * overlay shells so factory and overlay stay aligned.
 */
export function generateBallPaddleCatalog(kind: 'breakout' | 'pong' | 'none'): Record<string, unknown> {
  const empty = {
    schemaVersion: 1,
    mode: 'breakout',
    court: { width: 960, height: 540 },
    paddle: { x: 480, y: 485, width: 150, height: 22, speed: 0, axis: 'x', min: 85, max: 875, hitHalf: 86 },
    ball: { x: 480, y: 270, vx: 0, vy: 0, radius: 18 },
    walls: { insetX: 12, top: 50, bottom: 522 },
    bricks: [] as const,
    lives: 0,
  };
  if (kind === 'none') return empty;
  if (kind === 'breakout') {
    const bricks = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) {
        bricks.push({
          id: `brick-${row}-${col}`,
          x: 260 + col * 82,
          y: 105 + row * 38,
          halfWidth: 42,
          halfHeight: 22,
        });
      }
    }
    return {
      schemaVersion: 1,
      mode: 'breakout',
      court: { width: 960, height: 540 },
      paddle: { x: 480, y: 485, width: 150, height: 22, speed: 340, axis: 'x', min: 85, max: 875, hitHalf: 86 },
      ball: { x: 480, y: 270, vx: 180, vy: -180, radius: 18 },
      walls: { insetX: 12, top: 50, bottom: 522 },
      bricks,
      lives: 3,
      breakout: {
        contactDivisor: 65,
        contactScale: 72,
        moveScale: 24,
        minSpeedX: 105,
        maxSpeedX: 220,
        parkOffset: 24,
        serveSpeed: 180,
        contactNear: 25,
        contactFar: 12,
        brickScore: 10,
      },
    };
  }
  return {
    schemaVersion: 1,
    mode: 'pong',
    court: { width: 960, height: 540 },
    paddle: { x: 55, y: 270, width: 22, height: 110, speed: 260, axis: 'y', min: 70, max: 470, hitHalf: 70 },
    ball: { x: 480, y: 270, vx: 210, vy: 145, radius: 18 },
    walls: { insetX: 0, top: 18, bottom: 522 },
    bricks: [],
    lives: 0,
    pong: {
      opponentX: 905,
      opponentY: 270,
      opponentWidth: 22,
      opponentHeight: 110,
      opponentHitHalf: 70,
      lerpMs: 300,
      playerMinX: 35,
      playerMaxX: 75,
      opponentMinX: 885,
      opponentMaxX: 925,
      speedBump: 8,
      serveSpeed: 210,
      scorePast: 20,
      winScore: 3,
    },
  };
}

/**
 * content/local-play.json - a LocalPlayCatalog (Category-C Wave 7). Always
 * emitted; empty/inert unless the preset installs `sw2d.local-play`. Two
 * bounded starter modes match the two consumers: hotseat (pass-and-play
 * turns) and versus (disjoint axes for pong).
 */
export function generateLocalPlayCatalog(kind: 'hotseat' | 'versus' | 'none'): Record<string, unknown> {
  const empty = {
    schemaVersion: 1,
    mode: 'hotseat',
    players: [] as const,
  };
  if (kind === 'none') return empty;
  if (kind === 'hotseat') {
    return {
      schemaVersion: 1,
      mode: 'hotseat',
      players: [
        { id: 'p1', label: 'P1' },
        { id: 'p2', label: 'P2' },
      ],
      hotseat: { turns: 6, pointsCycle: [1, 2, 3] },
    };
  }
  return {
    schemaVersion: 1,
    mode: 'versus',
    players: [
      { id: 'p1', label: 'P1', negative: ['ArrowUp'], positive: ['ArrowDown'] },
      { id: 'p2', label: 'P2', negative: ['KeyW'], positive: ['KeyS'] },
    ],
  };
}

/**
 * content/stage-scroll.json - a StageScrollCatalog (Category-C Wave 8). Always
 * emitted; empty/inert unless the preset installs `sw2d.stage-scroll`. Two
 * bounded starter modes match the two consumers: horizontal (stream left,
 * fire +X) and vertical (stream down, fire -Y).
 */
export function generateStageScrollCatalog(kind: 'horizontal' | 'vertical' | 'none'): Record<string, unknown> {
  const empty = {
    schemaVersion: 1,
    mode: 'horizontal',
    speed: 0,
    length: 0,
    viewport: { width: 960, height: 540 },
    player: { x: 120, y: 270, radius: 16, speed: 0, minX: 0, maxX: 960, minY: 0, maxY: 540 },
    hazards: [] as const,
  };
  if (kind === 'none') return empty;
  if (kind === 'horizontal') {
    return {
      schemaVersion: 1,
      mode: 'horizontal',
      speed: 180,
      length: 720,
      viewport: { width: 960, height: 540 },
      player: { x: 120, y: 270, radius: 16, speed: 210, minX: 40, maxX: 420, minY: 40, maxY: 500 },
      hazards: [
        { id: 'rock-a', along: 280, cross: 90, radius: 18 },
        { id: 'rock-b', along: 480, cross: 450, radius: 18 },
        { id: 'rock-c', along: 640, cross: 90, radius: 18 },
      ],
    };
  }
  return {
    schemaVersion: 1,
    mode: 'vertical',
    speed: 180,
    length: 720,
    viewport: { width: 960, height: 540 },
    player: { x: 480, y: 440, radius: 16, speed: 210, minX: 40, maxX: 920, minY: 260, maxY: 510 },
    hazards: [
      { id: 'rock-a', along: 280, cross: 120, radius: 18 },
      { id: 'rock-b', along: 480, cross: 840, radius: 18 },
      { id: 'rock-c', along: 640, cross: 120, radius: 18 },
    ],
  };
}

/**
 * content/timing.json - a TimingCatalog (Category-C Wave 10). Always
 * emitted; empty/inert unless the preset installs `sw2d.timing`. Two
 * bounded starter modes match the two consumers: reaction (deterministic
 * delay, too-early miss) and rhythm (periodic visual beats). Not audio-sync.
 */
export function generateTimingCatalog(kind: 'reaction' | 'rhythm' | 'none'): Record<string, unknown> {
  const empty = {
    schemaVersion: 1,
    mode: 'reaction',
    windowMs: 0,
    hitsToWin: 0,
    missesToFail: 0,
    reaction: { delaysMs: [] as const, maxWaitMs: 0 },
  };
  if (kind === 'none') return empty;
  if (kind === 'reaction') {
    return {
      schemaVersion: 1,
      mode: 'reaction',
      windowMs: 400,
      hitsToWin: 2,
      missesToFail: 3,
      reaction: { delaysMs: [700, 700], maxWaitMs: 900 },
    };
  }
  return {
    schemaVersion: 1,
    mode: 'rhythm',
    windowMs: 120,
    hitsToWin: 3,
    missesToFail: 4,
    rhythm: { periodMs: 500, offsetMs: 700, beats: 8 },
  };
}

/**
 * content/melee.json - a MeleeCatalog (Category-C Wave 6). Always
 * emitted; empty/inert unless the preset installs `sw2d.melee`. Two
 * bounded starter modes match the two consumers: skirmish (one elite
 * foe) and arena (three fodder). Constants match the expanded overlay
 * shells so factory and overlay stay aligned.
 */
export function generateMeleeCatalog(kind: 'skirmish' | 'arena' | 'none'): Record<string, unknown> {
  const empty = {
    schemaVersion: 1,
    mode: 'skirmish',
    player: { id: 'player', x: 120, y: 270, radius: 16, health: 5 },
    foes: [] as const,
    strike: { range: 145, damage: 1, cooldownMs: 0, knockback: 8, stunMs: 80 },
    contact: { range: 34, damage: 1, cooldownMs: 650 },
  };
  if (kind === 'none') return empty;
  if (kind === 'skirmish') {
    return {
      schemaVersion: 1,
      mode: 'skirmish',
      player: { id: 'player', x: 120, y: 270, radius: 16, health: 5 },
      foes: [{ id: 'foe-0', x: 470, y: 270, radius: 17, health: 3 }],
      strike: { range: 145, damage: 1, cooldownMs: 0, knockback: 8, stunMs: 80 },
      contact: { range: 34, damage: 1, cooldownMs: 650 },
    };
  }
  return {
    schemaVersion: 1,
    mode: 'arena',
    player: { id: 'player', x: 120, y: 270, radius: 16, health: 5 },
    foes: [
      { id: 'foe-0', x: 420, y: 160, radius: 17, health: 2 },
      { id: 'foe-1', x: 560, y: 270, radius: 17, health: 2 },
      { id: 'foe-2', x: 420, y: 380, radius: 17, health: 2 },
    ],
    strike: { range: 145, damage: 1, cooldownMs: 0, knockback: 8, stunMs: 80 },
    contact: { range: 34, damage: 1, cooldownMs: 650 },
  };
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

/**
 * Genre-appropriate UiCopy for a generated game (Arena finish program, Wave
 * 2). Before this, every generated game's title screen said "foundation
 * slice" and its HUD said "MOVE / JUMP" - a bullet-hell told the player to
 * jump. Derived from the same two facts the generator already keys
 * everything else on (primary controller family + required pack ids), so it
 * stays deterministic and honest: the hint names only controls the shell
 * actually reads.
 */
export function generateUiCopy(options: {
  readonly displayName: string;
  readonly presetDisplayName: string;
  readonly primaryControllerFamily: string;
  readonly requiredPackIds: readonly string[];
  readonly presetId?: string;
}): Record<string, string> {
  const { displayName, presetDisplayName, primaryControllerFamily, requiredPackIds, presetId } = options;
  const has = (id: string) => requiredPackIds.includes(id);
  let playHint = 'MOVE  -  PAUSE TO STOP';
  switch (primaryControllerFamily) {
    case 'platform':
      playHint = has('sw2d.weapons') ? 'MOVE / JUMP  -  FIRE J/X  -  PAUSE TO STOP' : 'MOVE / JUMP  -  PAUSE TO STOP';
      break;
    case 'top-down':
      playHint = has('sw2d.local-play') && has('sw2d.ball-paddle')
        ? 'P1 ARROWS  -  P2 WASD  -  FIRST TO 3'
        : has('sw2d.ball-paddle')
        ? 'MOVE WASD/ARROWS  -  RETURN THE BALL'
        : has('sw2d.perception')
        ? 'MOVE WASD/ARROWS  -  AVOID THE CONE  -  HIDE IN COVER'
        : has('sw2d.melee')
          ? 'MOVE WASD/ARROWS  -  STRIKE J/X'
          : has('sw2d.stage-scroll')
            ? 'MOVE WASD/ARROWS  -  FIRE J/X  -  CLEAR THE STAGE'
            : has('sw2d.encounters')
              ? 'MOVE WASD/ARROWS  -  AIM WITH MOUSE  -  FIRE J/X  -  SURVIVE THE WAVES'
              : has('sw2d.weapons')
                ? 'MOVE WASD/ARROWS  -  AIM WITH MOUSE  -  FIRE J/X'
                : presetId === 'investigation-game'
                  ? 'MOVE WASD/ARROWS  -  J INSPECTS CLUES'
                  : presetId === 'action-roguelite'
                    ? 'MOVE WASD/ARROWS  -  J TAKES RELICS'
                    : 'MOVE WASD/ARROWS  -  PAUSE TO STOP';
      break;
    case 'vehicle':
      playHint = has('sw2d.racing')
        ? 'STEER / THROTTLE WASD/ARROWS  -  ENTER STARTS THE RACE'
        : has('sw2d.weapons')
          ? 'STEER / THROTTLE WASD/ARROWS  -  FIRE J/X'
          : 'STEER / THROTTLE WASD/ARROWS  -  PAUSE TO STOP';
      break;
    case 'grid':
      playHint = presetId === 'match-puzzle'
        ? 'MOVE WASD/ARROWS  -  ENTER SELECTS OR SWAPS  -  UNDO BACKSPACE'
        : presetId === 'falling-block-puzzle'
          ? 'MOVE WASD/ARROWS  -  ENTER ROTATES  -  DROP K'
          : has('sw2d.puzzle-rules')
            ? 'MOVE / PUSH WASD/ARROWS  -  UNDO BACKSPACE  -  RESET K'
            : 'MOVE WASD/ARROWS  -  PAUSE TO STOP';
      break;
    case 'pointer':
      playHint = has('sw2d.dialogue')
        ? 'CLICK HOTSPOTS  -  ENTER ADVANCES'
        : has('sw2d.weapons')
          ? 'AIM WITH MOUSE  -  FIRE J/X'
          : has('sw2d.puzzle')
            ? presetId === 'escape-room'
              ? 'CLICK THE NOTE  -  THEN THE KEY'
              : 'CLICK TO NUDGE  -  LAND IN THE GOAL'
            : presetId === 'drawing-game'
              ? 'DRAW TWO STROKES ON THE PAGE'
              : presetId === 'dress-up-character-toy'
                ? 'DRAG HAT AND SHIRT ONTO THE FIGURE'
                : 'POINT AT THINGS  -  CLICK TO ACT  -  PAUSE TO STOP';
      break;
    case 'ui-simulation':
      playHint = has('sw2d.economy')
        ? 'ARROWS PICK  -  ENTER SERVES  -  K RESTOCKS OR COOKS'
        : has('sw2d.needs')
          ? 'J FEEDS  -  K PLAYS OR REFRESHES  -  KEEP NEEDS UP'
          : has('sw2d.dialogue')
            ? 'ENTER ADVANCES  -  ARROWS CHOOSE'
            : has('sw2d.local-play')
              ? 'J ACTS  -  PASS THE KEYBOARD  -  SIX TURNS'
              : has('sw2d.timing')
                ? presetId === 'rhythm-action'
                  ? 'ENTER ON THE BEAT'
                  : 'WAIT FOR THE GO  -  ENTER HITS'
                : presetId === 'farming-lite'
                  ? 'ARROWS PICK A PLOT  -  ENTER PLANTS OR HARVESTS'
                  : presetId === 'colony-lite'
                    ? 'ARROWS PICK A JOB  -  ENTER ASSIGNS OR BUILDS'
                    : presetId === 'interactive-fiction-hybrid'
                      ? 'ARROWS PICK A VERB  -  ENTER ACTS'
                      : presetId === 'fishing-game'
                        ? 'ENTER CASTS AND LANDS'
                        : presetId === 'cooking-game'
                          ? 'ARROWS PICK  -  ENTER ADDS TO THE DISH'
                          : 'ARROWS CHANGE THE SELECTION  -  ENTER CONFIRMS  -  PAUSE TO STOP';
      break;
    default:
      break;
  }
  return {
    title: displayName.toUpperCase(),
    subtitle: presetDisplayName,
    playHint,
  };
}

/** content/themes/<themeId>/theme.json - a ThemeManifest. Colours vary slightly by themeId so add-theme's second theme is visually distinguishable, without claiming any real design system. Pass `ui` (generateUiCopy) so the generated game announces its own genre instead of the runtime's neutral fallback copy. */
export function generateTheme(themeId: string, displayName: string, ui?: Record<string, string>): Record<string, unknown> {
  const palette = paletteFor(themeId);
  return {
    schemaVersion: 1,
    id: themeId,
    displayName,
    ...(ui !== undefined ? { ui } : {}),
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
