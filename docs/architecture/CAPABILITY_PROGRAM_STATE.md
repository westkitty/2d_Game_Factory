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
| 7 | Procedural Generation | `feature/capability-07-procedural-generation` | NOT STARTED |
| 8 | World Graph / Rooms / Transitions / Map | `feature/capability-08-world-graph` | NOT STARTED |
| 9 | Advanced 2D Physics & Constraints | `feature/capability-09-advanced-physics` | NOT STARTED |
| 10 | Vehicle Handling & Racing | `feature/capability-10-vehicle-racing` | NOT STARTED |

Program starting `main`: `0af24cd6c2646cae84fb4be559b68c2477e63d0b`
(the Start/Confirm prerequisite; verified present before Phase 1).

Current phase: **7 — Procedural Generation** (NOT STARTED). Phases 1–6 integrated to `origin/main`.

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
- `npm test` — 2299/2299 PASS (was 2288; +11)
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

Phase 7 — Procedural Generation. Branch `feature/capability-07-procedural-generation`
from the integrated `main`.
