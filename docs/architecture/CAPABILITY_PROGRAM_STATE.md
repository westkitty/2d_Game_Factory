# Capability Completion Program — durable state

Resumable ledger for the ten-phase reusable-capability program. If this
conversation is compacted or interrupted, resume from this file plus `git log`,
not from chat memory.

## Program goal

Deeply implement the first ten reusable factory capability systems, in order,
replacing known-limitation warnings with production-grade reusable architecture
(reusable contracts/runtime/packs/content), each proven by **≥2 substantially
different generated-game consumers** through the repo's existing proof standard,
each integrated to `origin/main` before the next.

Controlling spec: the user's ten-phase program prompt (this session). Execution
model: one continuous session, sequential gated phases — a phase boundary is a
Git/validation/architecture checkpoint, not a new chat.

## Phases

| # | Capability | Branch | Status |
|---|---|---|---|
| 1 | Spatial Pointer & Interaction | `feature/capability-01-spatial-interaction` | PASS |
| 2 | Data-Driven Items / Effects / Pickups | `feature/capability-02-items-effects` | PASS |
| 3 | Weapons & Projectiles | `feature/capability-03-weapons-projectiles` | PASS |
| 4 | Combat / Encounter Orchestration | `feature/capability-04-combat-orchestration` | PASS |
| 5 | Navigation & Pathfinding | `feature/capability-05-navigation` | PASS |
| 6 | Data-Driven Puzzle Rules | `feature/capability-06-data-puzzles` | PASS |
| 7 | Procedural Generation | `feature/capability-07-procedural-generation` | PASS |
| 8 | World Graph / Rooms / Transitions / Map | `feature/capability-08-world-graph` | PASS |
| 9 | Advanced 2D Physics & Constraints | `feature/capability-09-advanced-physics` | PASS |
| 10 | Vehicle Handling & Racing | `feature/capability-10-vehicle-racing` | PASS |

Program starting `main`: `0af24cd6c2646cae84fb4be559b68c2477e63d0b`
(the Start/Confirm prerequisite; verified present before Phase 1).

Current phase: **Final Program Certification**. Phases 1–10 integrated to `origin/main`.

---

## Phase 1 — Spatial Pointer & Interaction — PASS

- **Starting SHA:** `0af24cd6c2646cae84fb4be559b68c2477e63d0b`
- **Feature branch:** `feature/capability-01-spatial-interaction`
- **Phase commit SHA:** this commit — `feat: add reusable spatial interaction` on `main` (see `git log`)
- **Main integration SHA:** same commit, fast-forwarded onto `main` (linear; no merge commit)

### Implementation summary

- `packages/contracts/src/spatial.ts` (new, renderer-neutral): `SpatialPointerState` /
  `SpatialPointerInput`; `HitShape` (`rect | circle | polygon`) + pure `hitTestPoint`;
  `AimVector` + pure `aimFromPointer`; `InteractionService` / `InteractionTargetOptions` /
  `InteractionTargetHandle` contracts. Exported from `contracts/src/index.ts`.
- `packages/runtime/src/input/SpatialPointerHost.ts` (new): single owner of world-space
  pointer state. DOM `pointer*` listeners write raw values; `update()` advances edges +
  drag tracking once per frame from the existing PRE_STEP handler, next to
  `ActionInputHost.update()`. Press+release in one frame is latched. Listeners removed on
  dispose (restart-safe).
- `packages/runtime/src/game-support/interactionService.ts` (new): `InteractionServiceImpl`
  (renderer-neutral; consumes `SpatialPointerInput` + hit shapes) with hover enter/leave,
  press/release/click, drag start/move/end with **origin-target capture**, drop-zone
  resolution, priority ordering (priority desc, then registration recency), `targetCount`
  diagnostics. `phaserBoundsShape(obj)` maps a live game object's bounds to a rect provider.
- Wiring: `createGame` constructs the host (screen→world via play-camera `getWorldPoint`,
  client→canvas via canvas rect), adds it to `rootBag`, advances it in PRE_STEP, clears it on
  tab-hide, and passes it to `PlayScene`. `SceneContext` gains `spatialPointer` +
  `interaction`; `createSceneContext` builds the interaction service, ticks it from the
  scene's UPDATE event, and disposes it with `sceneDisposables`. `GameContext` unchanged
  (world resolution needs a scene camera — ADR-0018).
- Generation: `packages/cli/src/templates/gameSpecific/pointerShellPack.ts` rewritten to
  consume `context.interaction` + `context.spatialPointer` (hover + click on a world-space
  target). Every newly generated `pointer`-primary game now demonstrates the capability. No
  other template edited.
- ADR-0018 added (spatial pointer is a scene service, not part of `ActionInput`).

### Proof consumers

- **`proofs/gallery-shooter/`** (new) — world-space click targeting: the target under the
  cursor takes the hit; an empty-space click hits nothing. Frozen `PROOF_CONTRACT.md` +
  `packages/qa/proof-specs/galleryShooter.ts`, real `PointerEvent`s.
- **`proofs/point-and-click/`** (new) — hover enter/leave, click, full drag→drop with
  pointer capture + drop-zone resolution. Frozen contract + `pointAndClick.ts` spec.
- **`proofs/twin-stick-shooter/`** (upgraded, regression consumer) — pointer aim is an
  optional source via `aimFromPointer` when no digital `AIM_*` is held; digital aim proven
  still independent and authoritative.
- Wired into `npm run qa:proof` (now 7/7). Both new proof games also carry their generated
  `tests/content.test.ts` in the main vitest suite.

### Limitation changes

- `gallery-shooter`: removed the spatial-pointer-targeting limitation (starter now consumes
  the capability). Keeps `weaponsProjectiles`.
- `rail-shooter`: removed the spatial-pointer-targeting limitation. Keeps `weaponsProjectiles`
  + rail-camera gap.
- `point-and-click`: replaced the spatial-pointer limitation with the (already-true)
  branching-dialogue-renderer limitation.
- `drawing-game`, `dress-up-character-toy`, `escape-room`: narrowed — the spatial
  pointer/drag capability now exists; each keeps only its remaining specific gap
  (canvas-stroke capture / wardrobe-attachment system / escape-room puzzle grammar).
- `LIMITATIONS.spatialPointerTargeting` constant deleted (unused). `LIMITATIONS.spatialAim`
  reworded (no longer claims spatial pointer is deferred).
- `packages/presets/test/honesty.test.ts` `cases` array + `POINTER_INPUT_MODES` doc updated
  to match. Preset `maturity` labels left unchanged (formal `proof-validated` promotion of
  the two new proof presets, with its 5/7/62 catalog-count bookkeeping, is deferred to a
  dedicated catalog pass — the proofs exist and pass regardless).
- `tower-defense` / `simple-rts` (grid-primary shell) spatial-placement limitations left
  intact — their generated starter does not consume the capability; removed by their own
  later phase.

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2114/2114 PASS (was 2078; +36)
- `npm run workbench:build`, `npm run build`, `npm run check:offline` — PASS
- `npm run qa:proof` — 7/7 PASS (incl. new `gallery-shooter`, `point-and-click`, upgraded
  `twin-stick-shooter`)
- `npm run qa:matrix` — 40/40 PASS (generated games entered play; no runtime-boundary regression)
- `npm run qa:starter-kits` — all 14 sub-suites PASS (exit 0)
- `npm run release:verify` — 6/6 controller-shell families PASS (pack + offline + real Chrome)

### Unresolved blockers

None.

### Next phase

Phase 2 — Data-Driven Items / Effects / Pickups (done, see below).

---

## Phase 2 — Data-Driven Items / Effects / Pickups — PASS

- **Starting SHA:** `b7238665558cd8b86e3b8124e706f49192e0c487` (Phase 1 on `main`)
- **Feature branch:** `feature/capability-02-items-effects`
- **Phase commit SHA:** this commit — `feat: add data-driven items and effects` on `main` (see `git log`)
- **Main integration SHA:** same commit, fast-forwarded onto `main` (linear; no merge commit)

### Implementation summary

- `packages/contracts/src/items.ts` (new): `ItemDefinition`, `ItemCatalog`, the
  bounded `EffectDefinition` union (8 leaf kinds + non-nesting `chain`),
  `EFFECT_CAPABILITY_REQUIREMENT`, `ItemsService`, `ItemEffectContext`,
  `ApplyEffectsResult` (`applied` / `skipped`), `ITEMS_CAPABILITY_ID`.
- `packages/schemas` — `item-catalog` schema (content document `items`, registered
  alongside `tuning`/`levels`); `items-config` schema (`{ persist?: boolean }`).
- `packages/packs/src/items/itemsPack.ts` (new): `sw2d.items` → `items.state`,
  `dependencies: []`. `ItemsServiceImpl`: definition registry from
  `content/items.json`, inventory (`grant`/`remove`/`count`/`inventory`, maxCount
  and zero clamps), `canConsume`/`consume`, `applyEffects` (deterministic order;
  missing capability/context → reported skip, never throw). Persistence opt-in via
  config `{ persist: true }` → `context.saves`; default in-memory.
- `packages/packs/src/events.ts` — `items:countChanged`, `items:consumed`.
- `packages/runtime/src/game-support/itemPickups.ts` (new): `bindCollectiblePickups`
  — turns `Collectible` level objects into sensor sprites that grant the named
  item on player overlap (on-pickup effects for non-consumables only). Inert when
  `sw2d.items` is not installed. Browser-proven (the `ProjectilePool` convention).
- Generator: `content/items.json` always emitted (one-item starter catalog for a
  preset with the `items` role, empty otherwise); `content.ts.template` loads and
  validates it; `main.ts.template` makes `itemsPack` available; the shared
  `platform` + `top-down` shell templates call `bindCollectiblePickups` once,
  capability-guarded, and expose inventory in their debug snapshot.

### Proof consumers

- **`proofs/collectathon-platformer/`** (new) — preset requires `sw2d.items`; the
  shared platform shell binds pickups with **no game-specific pickup code**.
  Walking collects `coin-1`×2 / `gem-1` / `star-1`; effects (`arcade.score`,
  and a `chain` of score + `world.flag`) land in the real services;
  an unknown `itemId` is skipped. Frozen contract + `collectathonPlatformer.ts`.
- **`proofs/top-down-adventure/`** (new, cross-family) — top-down preset, items +
  progression enabled by content overlay. `map-key` (`world.flag`), `gold-pouch`
  (`progression.currency`), `ration` (consumable, `progression.xp` on `consume()`
  via INTERACT). Frozen contract + `topDownAdventure.ts`.
- `npm run qa:proof` 7/7 → **9/9**.

### Limitation changes

- `collectathon-platformer`: `LIMITATIONS.itemDefinitions` removed (starter
  consumes the capability). Constant deleted (was its only user).
- Phase 1 doc debt swept in `docs/presets/PRESET_CATALOG.md` (the stale
  `twin-stick-shooter` / gallery / rail / point-and-click / drawing-game /
  dress-up / escape-room limitation rows were still the pre-Phase-1 text).

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2139/2139 PASS (was 2114; +25)
- `npm run workbench:build`, `npm run build`, `npm run check:offline` — PASS
- `npm run qa:proof` — 9/9 PASS
- `npm run qa:matrix` — 40/40 PASS
- `npm run qa:starter-kits` — all 14 sub-suites PASS (exit 0)
- `npm run release:verify` — 6/6 controller-shell families PASS

### Unresolved blockers

None.

### Next phase

Phase 3 done, see below.

---

## Phase 3 — Weapons & Projectiles — PASS

- **Starting SHA:** `251b998e7b9797687065caf099ad3b477f131973` (Phase 2 on `main`)
- **Feature branch:** `feature/capability-03-weapons-projectiles`
- **Phase commit SHA:** this commit — `feat: add reusable weapons and projectiles` on `main` (see `git log`)
- **Main integration SHA:** same commit, fast-forwarded onto `main`

### Implementation summary

- `packages/contracts/src/weapons.ts` (new): `WeaponDefinition` / `WeaponCatalog`,
  `ProjectileSpec`, `FireMode` (`single`/`auto`/`burst`), `FireRequest` /
  `ProjectileSpawn` / `FireResult`, `WeaponsService`, `CombatDamageSink`,
  `WEAPONS_CAPABILITY_ID`.
- `packages/schemas` — `weapon-catalog` schema (content document `weapons`;
  `onHitEffects` `$ref` the Phase 2 effect union); `items-config` pattern reused
  for nothing new here.
- `packages/packs/src/weapons/weaponsPack.ts` (new): `sw2d.weapons` →
  `combat.weapons`, `dependencies: ['combat.health']`. `WeaponsServiceImpl` —
  per-owner cooldown/ammo/reload, deterministic spread fan, burst queue drained
  by `update()` / `drainPendingSpawns()`. No Phaser.
- `packages/runtime/src/game-support/projectileRuntime.ts` (new):
  `createProjectileRuntime` — renders spawns, **per-projectile** overlap (an
  Arcade Group zeroes a moving sprite's velocity, so no projectile group),
  damage via `CombatDamageSink`, on-hit effects via `sw2d.items`, pierce/bounce,
  leak counters (`spawned = live + expired`).
- `packages/runtime/src/game-support/starterWeapon.ts` (new): `bindStarterWeapon`
  — capability-guarded; equips the first catalog weapon and fires through the
  bridge. Wired into the shared `platform` + `top-down` shell templates.
- Generator: `content/weapons.json` always emitted (starter `sidearm` for a
  preset that installs `sw2d.weapons`, empty otherwise); `content.ts` / `main.ts`
  templates updated.
- ADR-0020.

### Proof consumers

- **`proofs/twin-stick-shooter/`** (upgraded) — raw `ProjectilePool` + hand-wired
  overlap replaced by `sw2d.weapons` + `createProjectileRuntime`; damage through
  `combat.health`; enemy death a `combat:entityDied` reaction.
- **`proofs/run-and-gun/`** (new, cross-controller) — the same model + bridge on a
  platform shell; two `Enemy` turret targets; `hitsResolved` counter; weapon
  cooldown gates fire rate.
- `npm run qa:proof` 9/9 → **10/10**.

### Limitation changes

- `weaponsProjectiles` removed from `twin-stick-shooter`, `run-and-gun`,
  `horizontal-shmup`, `vertical-shmup`, `bullet-hell`, `action-adventure`,
  `arena-combat`, `survivor-like` — each narrowed to its real remaining gap
  (encounter orchestration / bullet-pattern choreography → Phase 4; melee).
- `gallery-shooter`, `rail-shooter`, `asteroids-shooter` keep a narrowed
  `LIMITATIONS.weaponsProjectiles` (capability exists; their pointer/vehicle shell
  does not wire it yet). Maturity split unchanged (5/7/62).

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2154/2154 PASS (was 2139; +15)
- `npm run workbench:build`, `npm run build`, `npm run check:offline` — PASS
- `npm run qa:proof` — 10/10 PASS
- `npm run qa:matrix` — 41/41 PASS (matrix auto-grew by one signature: a weapon preset now has a unique required-pack set)
- `npm run qa:starter-kits` — all 14 sub-suites PASS
- `npm run release:verify` — 6/6 PASS

### Unresolved blockers

None.

### Next phase

Phase 4 done, see below.

---

## Phase 4 — Combat / Encounter Orchestration — PASS

- **Starting SHA:** `c4d71430c72ccb8f6ddfc22cb0bae529021881dc` (Phase 3 on `main`)
- **Feature branch:** `feature/capability-04-combat-orchestration`
- **Phase commit SHA:** this commit — `feat: add reusable encounter orchestration` on `main`
- **Main integration SHA:** same commit, fast-forwarded onto `main`

### Implementation summary

- `packages/contracts/src/encounters.ts` (new): `EncounterDefinition` / phases /
  `SpawnGroupDefinition` / `SpawnPoint` (point/rect/edge) / `EmitterDefinition`;
  bounded `FirePattern` union + pure `expandFirePattern`; bounded
  `EncounterCondition` union; `EncounterTick` / `EncounterUpdateContext` /
  `EncounterService`; `ENCOUNTERS_CAPABILITY_ID`.
- `packages/schemas` — `encounter-catalog` schema (content document `encounters`).
- `packages/packs/src/encounters/encountersPack.ts` (new): `sw2d.encounters` →
  `combat.encounters`, `dependencies: []`. Deterministic `EncounterServiceImpl` -
  staggered spawn scheduling, phase-level + entity-carried emitter accumulators,
  phase transitions on bounded conditions, `reportDeath` for `spawns-cleared`.
  No Phaser, no wall clock, no RNG.
- `packages/runtime/src/game-support/encounterRuntime.ts` (new):
  `createEncounterRuntime` - builds the update context from game state,
  materialises spawns via a callback, fires patterns through
  `createProjectileRuntime` (new `spawnRaw`), applies `onEnterInvulnMs` /
  `onEnterFlag` from the definition. Browser-proven.
- Generator: `content/encounters.json` always emitted (a starter skirmish for a
  preset that installs `sw2d.encounters`, empty otherwise); `content.ts` /
  `main.ts` templates updated.
- ADR-0021.

### Proof consumers

- **`proofs/bullet-hell/`** (new) — bounded, deterministic ring + spiral emitter
  choreography (`bulletsFired === 144` exactly) + a spawn wave; player vs drones
  and enemy bullets vs player, all through `combat.health`.
- **`proofs/boss-rush/`** (new) — one boss, three mechanically distinct phases
  (aimed → aimed fan → ring), `entity-health-below` transitions, `onEnterInvulnMs`
  windows, an `onEnterFlag`, all from the encounter definition.
- `npm run qa:proof` 10/10 → **12/12**.

### Limitation changes

- `LIMITATIONS.bossOrchestration` deleted. Full orchestration limitations removed
  from `bullet-hell`, `boss-rush`; `arena-combat`, `horizontal-shmup`,
  `vertical-shmup`, `survivor-like`, `base-defense` narrowed to their real
  remaining gaps. Maturity split unchanged (5/7/62).

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2168/2168 PASS (was 2154; +14)
- `npm run workbench:build`, `npm run build`, `npm run check:offline` — PASS
- `npm run qa:proof` — 12/12 PASS
- `npm run qa:matrix` — 42/42 PASS (auto-grew one signature)
- `npm run qa:starter-kits` — all 14 sub-suites PASS
- `npm run release:verify` — 6/6 PASS

### Unresolved blockers

None. Entity-carried emitters implemented but not proof-exercised (phase-level
emitters cover both proofs) — noted, not a blocker.

### Next phase

Phase 5 done, see below.

---

## Phase 5 — Navigation & Pathfinding — PASS

- **Starting SHA:** `c21f9ad09190cbd88e58edfcdb6c73f1f23c76a2` (Phase 4 on `main`)
- **Feature branch:** `feature/capability-05-navigation`
- **Phase commit SHA:** this commit — `feat: add reusable navigation and pathfinding` on `main`
- **Main integration SHA:** same commit, fast-forwarded onto `main`

### Implementation summary

- `packages/contracts/src/navigation.ts` (new): `NavGridSpec` / `NavGrid` /
  `NavPath` / `ReachableCell` / `NavQueryOptions` / `NavService` /
  `NAV_CAPABILITY_ID`; pure `advanceAlongPath` + stateful `createRouteFollower`.
- `packages/packs/src/navigation/navigationPack.ts` (new): `sw2d.navigation` →
  `world.navigation`, `dependencies: []`. Project-owned deterministic A*
  (stable tie-break: f, h, seq; diagonal + corner-cutting options) + Dijkstra
  reachable flood; dynamic `setWalkable`/`setCost`; `defineGridFromSolids`.
  Renderer-neutral, no new dependency.
- `main.ts` template gains `navigationPack`. No content document / schema
  (grids derive from level data or game config at install time).
- ADR-0022.

### Proof consumers

- **`proofs/turn-based-tactics/`** (new) — `NavGrid.reachable` deterministic
  movement range (28 cells, identical across reads) + `RouteFollower` movement;
  an out-of-budget cell is rejected.
- **`proofs/lane-defense/`** (new) — three enemies each following a
  `RouteFollower` route to the base; a placed blocker re-paths every living
  enemy; a placement that would strand an enemy is rejected; no route is ever
  permanently invalidated.
- `npm run qa:proof` 12/12 → **14/14**.

### Limitation changes

- Pathfinding limitations removed/narrowed on `tower-defense`,
  `turn-based-tactics`, `lane-defense`, `simple-rts`, `colony-lite`;
  `LIMITATIONS.stealthAi` narrowed (patrol navigation now covered by
  `sw2d.navigation`, added optional to stealth/heist). `tower-defense`'s own
  proof keeps its hand-authored route (nav retrofit deferred). Maturity 5/7/62.

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2198/2198 PASS (was 2176; +22)
- `npm run workbench:build`, `npm run build`, `npm run check:offline` — PASS
- `npm run qa:proof` — 14/14 PASS
- `npm run qa:matrix` — 42/42 PASS
- `npm run qa:starter-kits` — all 14 sub-suites PASS
- `npm run release:verify` — 6/6 PASS

### Unresolved blockers

None. `tower-defense` proof's nav retrofit intentionally deferred (its
hand-authored route proof stays valid; `lane-defense` covers the intent).

### Next phase

Phase 6 done, see below.

---

## Phase 6 — Data-Driven Puzzle Rules — PASS

- **Starting SHA:** `1a0177774418d60e60d0120d354ea9967c1d2aa8` (Phase 5 on `main`)
- **Feature branch:** `feature/capability-06-data-puzzles`
- **Phase commit SHA:** this commit — `feat: make standard puzzle rules data-driven` on `main`
- **Main integration SHA:** same commit, fast-forwarded onto `main`

### Implementation summary

- `packages/contracts/src/puzzles.ts` (new): `PuzzleRules` bounded discriminated
  union (`sokoban` | `switch-sequence` | `match` | `falling-block` |
  `physics-goal`), fixed `PuzzleOp` vocabulary, `PuzzleRulesDoc`,
  `PuzzleRulesService`, `PUZZLE_RULES_CAPABILITY_ID = 'puzzle.rules'`.
- `packages/packs/src/puzzleRules/puzzleRulesPack.ts` (new): `sw2d.puzzle-rules`
  → `puzzle.rules`, `dependencies: []`. One small pure engine per kind
  (`load`/`apply`/`undo`/`reset`/`isSolved`/`snapshot`). Renderer-neutral, no
  new dependency. No definition loaded ⇒ `apply`/`reset` no-op.
- `packages/schemas/schemas/puzzle-rules.schema.json` (new,
  `urn:sw2d:schema:content-puzzle-rules:v1`); wired into `validator.ts` +
  `CONTENT_DOCUMENTS` as document `puzzles`.
- Generator: `generatePuzzleRulesDoc` + always-emit `content/puzzles.json`
  (starter definition when the preset installs `sw2d.puzzle-rules`, else empty).
  `content.ts` / `main.ts` templates load it and pass `puzzleRulesPack`.
  `gridShellPack` + `platformShellPack` templates consume `puzzle.rules` when
  present (grid: step→`move`, CANCEL→undo, SECONDARY_ACTION→reset; platform:
  SECONDARY_ACTION→toggle, CANCEL→undo).
- `sw2d.puzzle` (`configSource: 'code'`) retained for unique mechanics.
- ADR-0023.

### Proof consumers

- **`proofs/sokoban/`** (revised) — the entire push/goal ruleset is now the
  validated `content/puzzles.json` `sokoban` definition driven by
  `sw2d.puzzle-rules`; `packConfig.ts` is `{}`. Move / legal push / invalid push
  (snapshot unchanged, `moves` frozen, rejection counted) / second push solves /
  undo / reset / replay. Frozen `PROOF_CONTRACT.md` revised.
- **`proofs/puzzle-platformer/`** (new) — `switch-sequence` kind: switch set,
  `a`→`d` link, press-order completion rule all in `content/puzzles.json`. A
  platform shell walks the player; three `Interactable` level zones are the
  switches; INTERACT toggles, CANCEL undoes, SECONDARY_ACTION resets. Journey:
  out-of-order press, link fires the decoy, tail-match solves, undo, reset,
  clean re-solve.
- `npm run qa:proof` 14/14 → **15/15**.

### Limitation changes

- `sokoban` and `puzzle-platformer` no longer require `sw2d.puzzle`;
  `LIMITATIONS.puzzleConfigIsCode` **removed** from both (`sokoban`
  `knownLimitations: []`, stays `proof-validated`). Honesty case
  `sokoban → /not JSON-serializable data/` removed.
- `LIMITATIONS.puzzleConfigIsCode` rewritten to be accurate: standard kinds are
  now content-authorable; `match-puzzle`, `falling-block-puzzle`,
  `physics-puzzle`, `escape-room` keep it for a kind the union does not cover.
- Maturity split unchanged (5/7/62). Fifteen packs now have a preset consumer.

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2295/2295 PASS (was 2198 at Phase 5; +97)
- `npm run workbench:build`, `npm run build`, `npm run check:offline` — PASS
- `npm run qa:proof` — 15/15 PASS
- `npm run qa:matrix` — PASS
- `npm run qa:starter-kits` — all sub-suites PASS
- `npm run release:verify` — PASS

### Unresolved blockers

None. `match` / `falling-block` / `physics-goal` engines are implemented and
unit-tested but not yet consumed by a generated starter — their presets keep a
narrowed `puzzleConfigIsCode`; not a blocker.

### Next phase

Phase 7 done, see below.

---

## Phase 7 — Deterministic Procedural Generation — PASS

- **Starting SHA:** `7d3ba5cf8cdec1a7c8f4c107f0a345c3930f9672` (Phase 6 on `main`)
- **Feature branch:** `feature/capability-07-procedural-generation`
- **Phase commit SHA:** this commit — `feat: add deterministic procedural generation` on `main`
- **Main integration SHA:** same commit, fast-forwarded onto `main`

### Implementation summary

- `packages/contracts/src/generation.ts` (new): `createRng` (mulberry32, no
  `Math.random`), `normalizeSeed`; three bounded generator families
  (`segment-chain`, `room-graph`, `road-chain`) expanded by pure functions to a
  `NormalizedLevel`; `GenerationResult` = `{ output, manifest, validation }`;
  `runGenerator` / `validateGenerationResult`. `GENERATION_CAPABILITY_ID =
  'world.generation'`.
- `packages/packs/src/generation/generationPack.ts` (new): `sw2d.generation` →
  `world.generation`, `dependencies: []`. Reads `content/generation.json`;
  per-generator sub-seed derivation; `generate(id, { seed?, size?, difficulty? })`.
- `packages/schemas/schemas/generation.schema.json` (new,
  `urn:sw2d:schema:content-generation:v1`); wired into `validator.ts` +
  `CONTENT_DOCUMENTS` as document `generation`.
- `packages/runtime/src/game-support/generatedLevel.ts` (new):
  `resolveSceneLevel(context)` - prefer a validated generated level, else the
  authored one; falls back on generation failure.
- Generator: `generateGenerationDoc` + always-emit `content/generation.json`;
  `content.ts` / `main.ts` templates load `generationPack`. `platform` /
  `top-down` / `vehicle` shell templates consume `resolveSceneLevel` (top-down
  and vehicle now also build wall colliders from `solids`).
- Workbench: `POST /api/generation/preview` (`workbench/server/generationLab.ts`)
  + an inspector-pane panel (`workbench/src/views/generationLab.ts`) - pick
  generator, set seed / size / difficulty, regenerate, copy seed, read manifest.
- ADR-0024.

### Proof consumers

- **`proofs/endless-runner/`** (new) — `segment-chain`: same seed reproduces the
  exact template sequence in-run (`INTERACT`) and across a real scene reinstall;
  a different seed diverges but stays valid; the player traverses generated
  ground.
- **`proofs/dungeon-crawler/`** (new) — `room-graph`: a connected graph with a
  start node, an exit, valid edges and start→exit reachability (BFS on the
  manifest graph); same reproducibility guarantees; the player moves through
  generated rooms against generated wall collision.
- `npm run qa:proof` 15/15 → **17/17**.

### Limitation changes

- `LIMITATIONS.proceduralGeneration` **removed** (constant deleted). Removed
  from `endless-runner`, `auto-runner`, `dungeon-crawler`, `action-roguelite`,
  `endless-driving` (all now require `sw2d.generation` and consume it via the
  generated shell). `action-roguelite` keeps its permadeath/meta-progression
  limitation; `endless-driving` keeps `vehicleIntentOnly`; `dungeon-crawler`
  gains a narrow true limitation (Enemy objects placed but not yet wired to
  combat/AI). Honesty case `endless-driving → /No procedural level.../` removed.
  Maturity split unchanged (5/7/62). Sixteen packs now have a preset consumer.

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2404/2404 PASS (was 2295 at Phase 6; +109)
- `npm run validate` (build + `check:offline`) — PASS
- `npm run qa:proof` — 17/17 PASS
- `npm run qa:matrix` — 43/43 PASS
- `npm run qa:starter-kits` — all 14 sub-suites PASS
- `npm run qa:workbench` — 16/16 PASS (workbench changed)
- `npm run release:verify` — 6/6 PASS

### Unresolved blockers

None. `lane-defense` (a Phase 5 proof) showed one timing-borderline
`advanceOk` flake on the first `qa:proof` run and passed on re-run; not a
Phase 7 regression (navigation untouched) — flagged for the final
certification lifecycle sweep.

### Next phase

Phase 8 done, see below.

---

## Phase 8 — World Graph / Rooms / Transitions / Map — PASS

- **Starting SHA:** `18f585d0baf0d1dad2229c266fd2c0021f3ae616` (Phase 7 on `main`)
- **Feature branch:** `feature/capability-08-world-graph`
- **Phase commit SHA:** this commit — `feat: add reusable world graph and room transitions` on `main`
- **Main integration SHA:** same commit, fast-forwarded onto `main`

### Implementation summary

- `packages/contracts/src/worldGraph.ts` (new): `WorldGraphDefinition` (nodes →
  level doc + entrances + connections + bounded conditions), `WorldGraphService`,
  `WorldMapState`, `WorldGraphSave`, `validateWorldGraphDefinition`.
  `WORLD_GRAPH_CAPABILITY_ID = 'world.graph'`.
- `packages/packs/src/worldGraph/worldGraphPack.ts` (new): `sw2d.world-graph` →
  `world.graph`, `dependencies: []`. Conditions read `world.state` / `items` /
  `progression` via `capabilities.get`. Opt-in id-only persistence
  (`config.persist`) through `context.saves`.
- `packages/schemas/schemas/world-graph.schema.json` (new,
  `urn:sw2d:schema:content-world-graph:v1`); wired into `validator.ts` +
  `CONTENT_DOCUMENTS` as document `world-graph`.
- `packages/runtime/src/game-support/roomTransition.ts` (new):
  `createRoomTransitionRuntime` - verify → suppress input → `teardownRoom()` →
  resolve destination level → `buildRoom(level, entrance)` → graph already
  marked discovered/visited. A blocked/broken transition leaves the current
  room untouched.
- `packages/runtime/src/game-support/worldMapOverlay.ts` (new):
  `createWorldMapOverlay` - semantic-DOM map of discovered nodes, keyboard
  operable, self-disposing.
- Generator: `generateWorldGraphDoc` + always-emit `content/world-graph.json`;
  `content.ts` / `main.ts` templates load `worldGraphPack`. `platform` /
  `top-down` shell templates consume the capability (map on SECONDARY_ACTION,
  edge-triggered transition).
- Workbench: `POST /api/world-graph/inspect` (`workbench/server/worldGraphLab.ts`)
  + an inspector-pane panel (`workbench/src/views/worldGraphLab.ts`) - nodes,
  entrances, connections, conditions, validation, reachability. Read-only.
- ADR-0025. Also hardened the Phase-5 `lane-defense` proof's `advanceOk` check
  (polled window instead of a fixed 20 frames).

### Proof consumers

- **`proofs/metroidvania/`** (new) — three real rooms; a locked
  `east → treasury` connection unlocked by a lever setting a world flag; a
  return trip with the flag intact; the map; graph state persisted across a
  real scene reinstall.
- **`proofs/exploration-game/`** (new) — three areas in a loop; discovery /
  visited state; a persistent world flag surviving every transition; the map;
  **no room-sprite accumulation** after repeated back-and-forth traversal.
- `npm run qa:proof` 17/17 → **19/19**.

### Limitation changes

- `LIMITATIONS.worldGraphAndMap` **removed** (constant deleted) from
  `metroidvania` and `exploration-game` (both now require `sw2d.world-graph`
  and consume it). Maturity split unchanged (5/7/62). Seventeen packs now have
  a preset consumer.

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2496/2496 PASS (was 2404 at Phase 7; +92)
- `npm run validate` (build + `check:offline`) — PASS
- `npm run qa:proof` — 19/19 PASS
- `npm run qa:matrix` — PASS
- `npm run qa:starter-kits` — all 14 sub-suites PASS
- `npm run qa:workbench` — 16/16 PASS (workbench changed)
- `npm run release:verify` — 6/6 PASS

### Unresolved blockers

None.

### Next phase

Phase 9 done, see below.

---

## Phase 9 — Advanced 2D Physics & Constraints — PASS

- **Starting SHA:** `0b896303933318ea89ec73c32085ae3b3bb463f2` (Phase 8 on `main`)
- **Feature branch:** `feature/capability-09-advanced-physics`
- **Phase commit SHA:** this commit — `feat: add optional advanced physics and constraints` on `main`
- **Main integration SHA:** same commit, fast-forwarded onto `main`

### Implementation summary

- `packages/contracts/src/advancedPhysics.ts` (new): renderer-neutral
  `AdvancedPhysicsService` (opaque body/constraint handles, plain body
  definitions, named `CollisionCategory`, distance/spring/pin/world constraints)
  and `GrappleService`. `PHYSICS_ADVANCED_CAPABILITY_ID = 'physics.advanced'`.
- `GameDefinition.physicsProfile` / `PresetDefinition.physicsProfile`
  (`'arcade'` default, opt-in `'matter'`); `game-definition` + `preset-definition`
  schemas updated. `createGame` adds a Matter world only for `'matter'`;
  `PlayScene`'s own scene config names the Matter system so Phaser injects
  `scene.matter`.
- `packages/runtime/src/game-support/advancedPhysics.ts` (new):
  `createAdvancedPhysics(scene)` - Matter-backed, owns every body/constraint,
  maps logical handles, `dispose()` removes all of it, inert without Matter.
- `packages/runtime/src/game-support/grappleService.ts` (new):
  `createGrappleService` - a near-rigid distance constraint player↔anchor;
  range/eligibility validation, safe anchor-removal detach, bounded reeling.
- No `@sw2d/packs` pack (renderer-free by contract); the service is a runtime
  `game-support` factory, per the ADR-0020 precedent.
- Generator writes `physicsProfile` into `content/game.json`; `pointer` /
  `platform` / `ui-simulation` shell templates create a demo Matter body when
  the profile is `'matter'`.
- Workbench: `POST /api/physics/inspect` + an inspector panel (backend +
  gravity).
- ADR-0026.

### Proof consumers

- **`proofs/grappling-platformer/`** (new) — the player is a Matter body;
  attach creates a real distance constraint; the swing keeps the player near a
  fixed distance from the anchor while its position changes; detach; re-attach;
  reel shortens the rope; restart leaves no constraint and no extra bodies.
- **`proofs/physics-toy/`** (new) — several rigid bodies falling and colliding
  on a static floor; one spring; a Phase-1 spatial-pointer click shakes the
  field; restart restores fresh counts.
- `npm run qa:proof` 19/19 → **21/21**.

### Limitation changes

- `LIMITATIONS.grapplingPhysics` and `LIMITATIONS.advancedPhysics` **removed**
  (both constants deleted). Removed from `grappling-platformer`, `physics-toy`,
  `physics-puzzle` (keeps `puzzleConfigIsCode`), `pinball-lite` (keeps a narrow
  "full table is game-specific code" limitation). Maturity split unchanged
  (5/7/62). No new pack (advanced physics is a runtime service).

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2505/2505 PASS (was 2496 at Phase 8; +9)
- `npm run validate` (build + `check:offline`) — PASS
- `npm run qa:proof` — 21/21 PASS
- `npm run qa:matrix` — 44/44 PASS
- `npm run qa:starter-kits` — all 14 sub-suites PASS
- `npm run qa:workbench` — 16/16 PASS (workbench changed)
- `npm run release:verify` — 6/6 PASS

### Unresolved blockers

None.

### Next phase

Phase 10 done, see below. Then FINAL FIRST-TEN PROGRAM CERTIFICATION.

---

## Phase 10 — Vehicle Handling & Racing — PASS

- **Starting SHA:** `e39004d2b9369ebc3c25400cc2de0dfd42bac6ae` (Phase 9 on `main`)
- **Feature branch:** `feature/capability-10-vehicle-racing`
- **Phase commit SHA:** this commit — `feat: add reusable vehicle handling and racing` on `main`
- **Main integration SHA:** same commit, fast-forwarded onto `main`

### Implementation summary

- `packages/contracts/src/vehicles.ts` (new): `VehicleService` (`vehicle.motion`)
  - `load` + `update(deltaMs, VehicleIntent, surfaceTag?)`; four bounded
  profiles (car / kart / boat / flight), bounded tuning, surface modifiers,
  simulation-time boost. `VEHICLE_PROFILE_DEFAULTS`.
- `packages/contracts/src/racing.ts` (new): `RaceService` (`race.state`) -
  `startRace` / `tick(deltaMs)` / `checkpointEntered` / `expectedCheckpoint`;
  ordered checkpoints (out-of-order never advances), `race` / `time-trial`
  modes, countdown + elapsed on simulation time, opt-in best-time persistence.
- `packages/packs/src/vehicles/vehiclesPack.ts` + `racing/racingPack.ts` (new):
  `sw2d.vehicles` / `sw2d.racing`, both pure (no Phaser). The `vehicleController`
  stays intent-only.
- `packages/schemas/schemas/vehicle-catalog.schema.json` +
  `race-catalog.schema.json` (new); documents `vehicles` / `races`; wired into
  `validator.ts` + `CONTENT_DOCUMENTS`. `GameDefinition` unchanged;
  `PresetDefinition.vehicleProfile` added (+ schema).
- Generator emits `content/vehicles.json` + `content/races.json`;
  `content.ts` / `main.ts` templates load both packs; `vehicleShellPack`
  template consumes both (intent → motion → sprite; CONFIRM starts the race;
  checkpoint-circle test).
- Workbench: `POST /api/racing/inspect` + an inspector panel.
- ADR-0027.

### Proof consumers

- **`proofs/top-down-racer/`** (new) — car via `sw2d.vehicles`, race via
  `sw2d.racing` (4 ordered checkpoints, 2 laps); an out-of-order checkpoint
  never advances a lap; two valid laps finish; restart clears all race state.
- **`proofs/time-trial-racer/`** (new) — same services, `time-trial` mode: a
  countdown, a live elapsed timer, an invalid-shortcut rejection, a finish, a
  restart that resets the attempt, and a faster second attempt that updates the
  persisted best.
- `npm run qa:proof` 21/21 → **23/23**.

### Limitation changes

- `LIMITATIONS.vehicleIntentOnly` and `LIMITATIONS.raceOrchestration` **removed**
  (both constants deleted). `top-down-racer`, `time-trial-racer`,
  `endless-driving` → `knownLimitations: []`. `kart-racer` keeps a narrow
  hold/fire-a-kart-item limitation; `boat-flight-racer` keeps a narrow
  bounded-arcade-handling limitation. Maturity split unchanged (5/7/62).
  Nineteen packs now have a preset consumer.

### Validation completed

- `npm run typecheck` — PASS
- `npm test` — 2602/2602 PASS (was 2505 at Phase 9; +97)
- `npm run validate` (build + `check:offline`) — PASS
- `npm run qa:proof` — 23/23 PASS
- `npm run qa:matrix` — 45/45 PASS
- `npm run qa:starter-kits` — all 14 sub-suites PASS
- `npm run qa:workbench` — 16/16 PASS (workbench changed)
- `npm run release:verify` — 6/6 PASS

### Unresolved blockers

None.

### Next phase

FINAL FIRST-TEN PROGRAM CERTIFICATION.

---

## FINAL FIRST-TEN PROGRAM CERTIFICATION — PASS — 2026-08-29 (Sonnet 5)

The first ten reusable factory capabilities are implemented, verified, and present on
`origin/main`.

### Git

- Program starting SHA: `0af24cd6c2646cae84fb4be559b68c2477e63d0b` (`fix: make game start controls explicit`)
- Final local `main` == final `origin/main`: **`281f88018339801e4d70a72ae63aa835b7a7fca7`**
  (before this certification commit; the certification's own limitation-honesty repairs +
  this record are one further commit on `main`, pushed and verified equal).
- Working tree clean. No force pushes. Linear history.

### Ten phase implementation commits (all reachable from `main`)

| # | Capability | Commit | Proof consumers |
|---|---|---|---|
| 1 | Spatial Pointer & Interaction | `b723866` | gallery-shooter, point-and-click (+ twin-stick-shooter regression) |
| 2 | Data-Driven Items / Effects / Pickups | `251b998` | collectathon-platformer, top-down-adventure |
| 3 | Weapons & Projectiles | `c4d7143` | run-and-gun (+ twin-stick-shooter) |
| 4 | Combat / Encounter Orchestration | `c21f9ad` | bullet-hell, boss-rush |
| 5 | Navigation & Pathfinding | `1a01777` | turn-based-tactics, lane-defense |
| 6 | Data-Driven Puzzle Rules | `0ae8f1b` (+ `7d3ba5c` doc) | sokoban, puzzle-platformer |
| 7 | Deterministic Procedural Generation | `18f585d` | endless-runner, dungeon-crawler |
| 8 | World Graph / Rooms / Transitions / Map | `0b89630` | metroidvania, exploration-game |
| 9 | Optional Advanced Physics & Constraints | `e39004d` | grappling-platformer, physics-toy |
| 10 | Vehicle Handling & Racing | `281f880` | top-down-racer, time-trial-racer |

### Fresh full validation (certification run)

- `npm run typecheck` — PASS
- `npm test` — **2602 / 2602** PASS (141 files)
- `npm run validate` — PASS (typecheck + test + workbench:build + build + check:offline)
- `npm run qa:workbench` — **16 / 16**
- `npm run qa:smoke` — **14 / 14**
- `npm run qa:proof` — **23 / 23** (18 new capability-program proof consumers + the 5
  pre-existing Phase-10 deep proofs)
- `npm run qa:starter-kits` — all **14** sub-suites, 0 FAIL
- `npm run qa:matrix` — **45 / 45** generated games entered play (all 74 presets covered)
- `npm run qa:responsive` — **19 / 19** surfaces (portrait + landscape)
- `npm run release:verify` — **6 / 6** controller-shell families (packed, checksummed,
  offline-guarded, real Chrome)

### Generated-game inheritance (Step 4)

Every one of the ten capabilities is present in a representative freshly-generated project
through the normal generator path (`buildGameFiles`) — verified by direct inspection of the
generated `content/game.json` / `content/*.json` / `src/game-specific/shellPack.ts`, and by
`qa:matrix` running all 74 generated games and `generate.test.ts` schema-validating every
generated content document per preset. Proof directories additionally prove the *behaviour*;
they are not the inheritance evidence.

### Determinism audit (Step 6)

No `Math.random` / `Date.now` / `setTimeout` / `setInterval` in any Phase 1–10 contract,
pack, runtime bridge, generator or generated shell (comment mentions only). Procedural
generation uses a project-owned seeded PRNG (mulberry32); encounter, weapon, race and
vehicle-boost timing all accumulate simulation-time `deltaMs`.

### Lifecycle / resource sweep (Step 7)

Every new system disposes cleanly; the leak-prone ones are asserted by their proofs:
projectile pools (`spawned = live + expired`, fresh on restart), world-graph rooms
(exploration-game: no room-sprite accumulation after repeated A→B→A→B), physics
(grappling-platformer: `constraintCount 0` and `bodyCount` back to initial after restart),
race state (top-down-racer: fresh race after restart). One real defect found and fixed during
Phase 9 (a Matter teardown NPE when `matter.world` was already null). One pre-existing
Phase-5 proof flake (`lane-defense` `advanceOk`) hardened during Phase 8.

### Schema / serialization sweep (Step 8)

items, weapons, encounters, puzzles, generation, world-graph, physics profile, vehicle and
race definitions each have a coherent contract ↔ schema ↔ loader ↔ generated content ↔
runtime consumption chain. `parity.test.ts` checks schema keys against the contract
interfaces; the five newest documents all reject representative malformed content.

### Limitation audit (Step 9)

`LIMITATIONS` constants deleted as their capabilities shipped and are consumed:
`spatialPointerTargeting`, `weaponsProjectiles` (narrowed then), `bossOrchestration`,
`puzzleConfigIsCode` (removed from the migrated recipes; rewritten for the four still on the
code seam), `proceduralGeneration`, `worldGraphAndMap`, `grapplingPhysics`, `advancedPhysics`,
`vehicleIntentOnly`, `raceOrchestration`. This certification additionally corrected three
stale "capability does not exist" claims to preset-integration-gap wording (`match-puzzle`
spatial-pointer + match-engine lines, `run-and-gun` encounter line, `action-adventure`
encounter line). Maturity split unchanged at **5 proof-validated / 7 smoke-validated / 62
recipe**.

### Dependency / offline audit (Step 10)

**No new npm dependency** anywhere: root and every workspace `package.json` unchanged across
the program; `package-lock.json` byte-identical to the program start. No CDN, no runtime
remote JS, no hotlinked assets. `check:offline` PASS every phase; `release:verify` asserts
zero external requests on packed builds. Newly generated projects depend only on the
`@sw2d/*` workspace packages plus Phaser (Matter is bundled in Phaser 4.2.1 — no separate
matter-js). Generated projects hold no dependency on Workbench server state.

### Protected regression journeys (Step 5) — all PASS

Zero-art creation, imported-art path, Free-Sprite Intelligence provider/rights/vault/
provenance workflow, frame-group animation, Start UX (Enter / Space / Numpad Enter),
pause/resume with no duplicate input edge, keyboard, pointer/touch, offline packaging, and
every pre-program proof/smoke game — all covered green by `qa:workbench` 16/16,
`qa:smoke` 14/14, `qa:responsive` 19/19, `qa:proof` 23/23 and `release:verify` 6/6 in this
certification run.

### Remaining limitations (deliberately outside the first-ten program)

Full stealth perception (vision cones / noise / hiding), chase/pursuit-pressure, wall-slide /
wall-jump / ledge-grab climbing, ball/paddle collision-and-bounce, customer AI / economy /
demand models, creature needs/behaviour simulation, colony simulation, branching-dialogue
renderer / parser / evidence board, rhythm/beat sync, microgame scheduler, canvas-stroke
drawing capture, wardrobe/attachment system, fishing / cooking / photography gameplay
systems, multi-player / local multi-device input routing, run-based permadeath /
meta-progression, and per-recipe integration gaps where a shipped capability is not yet
consumed by a particular preset's generated shell (e.g. `match-puzzle` → `sw2d.puzzle-rules`
`match` engine; `run-and-gun` / `action-adventure` → `sw2d.encounters`). These are honest
`knownLimitations` on the affected recipes; **not all 74 presets are finished** — this
program completed the first ten *reusable capabilities*.
