# Final Product Completion - durable state

Read this first when resuming. The matrix
([`FINAL_PRODUCT_COMPLETION_MATRIX.md`](FINAL_PRODUCT_COMPLETION_MATRIX.md)) is the ledger; this
file is the cursor.

## Fixed facts

- Starting `origin/main`: `0d00d4a7ae8ca482f1c4b2786e9e409961579355` (verified = accepted baseline).
- Branch: `claude/final-product-completion`; worktree `~/2d_game_factory/final-completion`.
- Protected: `~/2d_game_factory/2d_Game_Factory` (branch `candidate/antigravity-post-ten-program`,
  dirty AntiGravity work) - never checked out, stashed, reset, cleaned, modified, committed, rebased or
  deleted by this program.
- Gate: `npm run limitations:extract` (`tools/scripts/extract-limitations.ts`) must print
  `ZERO-LIMITATIONS GATE: PASS`.

## Cursor

| field | value |
|---|---|
| branch SHA | (see git log; this checkpoint is the Wave 1-3 independent sanity repair) |
| waves completed | 3 + sanity repair + Wave 4 L18-L23/L26/L28 |
| limitations closed | 32 / 69 entries |
| remaining machine-executable | 37 |
| blockers | none |
| next exact action | Wave 4 remainder: L25/L46 physics/escape grammar, L27 rhythm/reaction — then Waves 5-9 |

## Checkpoint log

### Wave 0 - inventory
- Created worktree/branch from `0d00d4a`. `npm ci` clean (0 vulnerabilities).
- Extracted 69 entries / 52 distinct texts programmatically; wrote the matrix (L01-L53, X01-X02).
- Added `tools/scripts/extract-limitations.ts` + `npm run limitations:extract` (currently FAIL, 69).
- Proof inventory: 43 of 74 `proofs/<id>/` directories are byte-identical (or template-drift-only)
  canonical factory output; 31 are pre-program hand-authored proofs. Program policy: canonical
  proofs are regenerated from the factory after each wave (`tools/scripts/refresh-canonical-proofs.ts`,
  Wave 1); hand-authored proofs are kept and every changed preset additionally gets a fresh
  generated-game journey (`npm run qa:completion`).

### Wave 1 - platforming movement (L01, L02, L03)
- New reusable pack `sw2d.pursuit` (`movement.pursuit`): `wall` (closing wall) and `chaser` (trailing pursuer that closes while the runner stumbles) modes from `content/pursuit.json`. Consumers: chase-platformer, endless-runner, auto-runner (all now require it).
- `sw2d.wall` ledge grammar: authored ledges, `grounded/airborne/sliding/ledge-hang/climbing` state machine, climb/drop/hang-jump/release, regrab lockout; platform shell pins the body while hanging. Fixed Wave 30's inverted slide/kick direction.
- New program tooling: `npm run qa:completion` (fresh generate → tsc → vite build → real-Chrome journey, `packages/qa/completion-specs/`), `npm run proofs:refresh` / `proofs:check` (canonical proofs regenerated from the factory; 51 canonical, 23 hand-authored), `npm run docs:presets` (mechanical preset-doc tables).
- Honesty test inverted into a closed-limitations regression guard (`packages/presets/test/honesty.test.ts`).

### Wave 2 - combat / top-down (L04-L09)
- `sw2d.melee`: combo chains, facing-arc directional strikes, foe pursuit, player hit-stun, `target()`; HUD reticle/arc/combo.
- `sw2d.encounters`: wave escalation (`escalation`), boss `sequence` (consumed in Wave 3), `start(id, { wave })`; binding gains permadeath, loadout, boss sequencing, enemy positions in the snapshot.
- New reusable pack `sw2d.runs` (`progression.runs`, `content/runs.json`): run lifecycle, permadeath, banked meta via saves, unlocks, loadout. Consumers: survivor-like, action-roguelite.
- New `bindStarterDungeon`: room-graph enemies as `sw2d.ai` agents, rooms, exit gate, camera follow; crawl (dungeon-crawler) and rogue (action-roguelite) modes; `DUNGEON_STARTER` in packConfig (replaces COMBAT_STARTER 'room' and PROGRESSION_STARTER 'run').
- `sw2d.perception`: patrol routes, observer state machine, chase/catch, investigation, return, noise investigation, takedowns.
- twin-stick-shooter requires `sw2d.encounters`; dungeon-crawler requires `sw2d.ai`.
- New QA helper `packages/qa/src/dungeonJourney.ts` (room-graph navigation from the manifest); tools helper `tools/scripts/register-content-document.py`.

### Wave 3 - shooters (L10-L17)
- `sw2d.encounters`: `sequence` (boss rush), `archetypes` behaviour metadata (chase / ground / drift / approach / hold), `formation` spawn points; `entity-health-below` waits for its spawn.
- `bindStarterEncounters`: archetype motion, HUD, `arcade.score`, escapes/misses, time limit, boss sequencing, ground walkers under gravity (platform shell), scroll offsets (rail), dynamic projectile bounds.
- Pooled `createProjectileRuntime` + `npm run qa:bullet-budget` (400+ live @ 60 fps; stress 1676).
- `sw2d.stage-scroll`: parallax `layers`, `rail` legs, `crossOffset`; starter draws planes.
- `sw2d.vehicles` `ship` profile; new `bindStarterAsteroids`; new `bindStarterGallery` (gallery + rail modes); `GALLERY_STARTER` / `ASTEROIDS_STARTER` in packConfig (LOOK_STARTER 'rail' retired).
- Catalog: run-and-gun, gallery-shooter, rail-shooter, asteroids-shooter require the packs they now consume.
- Fixes found by play: pointer `inside` without `pointerenter`; PlayScene camera bounds pinned the old rail; per-entity health condition before spawn.

## Validation evidence

### Wave 1
- `npm run typecheck` PASS; `npx vitest run` 208 files / 4160+ tests PASS (includes `pursuit.test.ts`, extended `wall.test.ts`, Wave 1 generate tests).
- `npm run qa:completion` 5/5 PASS (chase-platformer, endless-runner, auto-runner, precision-platformer, climbing-game) - fresh factory output, system Chrome.
- `npm run qa:proof -- chase-platformer endless-runner auto-runner precision-platformer climbing-game traditional-platformer` 6/6 PASS.
- `npm run limitations:extract`: 64 machine-executable remain (was 69).

### Wave 2
- `npm run typecheck` PASS; `npx vitest run` 209 files / 4195+ tests PASS.
- `npm run qa:completion` PASS for action-adventure, arena-combat, twin-stick-shooter, dungeon-crawler, action-roguelite, survivor-like, stealth-game, heist-game (fresh factory output, system Chrome).
- `npm run qa:proof` 14/14 PASS for every wave-2-affected proof (incl. hand-authored twin-stick, dungeon-crawler, bullet-hell, boss-rush, run-and-gun, base-defense).
- `npm run limitations:extract`: 56 machine-executable remain.

### Wave 3
- `npm run typecheck` PASS; `npx vitest run` 209 files / 4212 tests PASS.
- `npm run qa:completion` 21/21 PASS (all Wave 1-3 presets, fresh factory output).
- `npm run qa:proof` 18/18 PASS for every wave-3-affected proof (incl. hand-authored gallery, boss-rush, bullet-hell, run-and-gun, twin-stick, racers).
- `npm run qa:bullet-budget` PASS: 429 live @ 60.1 fps (p95 16.7 ms), pool reuse 82.7 %; `--stress` 1676 live @ 60.1 fps.
- `npm run limitations:extract`: 47 machine-executable remain.

### Independent sanity audit (post-Wave 3, before Wave 4)
Inherited HEAD `df850f2` was clean (no uncommitted Wave 4). Local tree matched origin. AntiGravity worktree `~/2d_game_factory/2d_Game_Factory` was not touched. Live extractor: **47 machine-executable / 35 distinct / 74 presets** (matches the ledger remaining count; original 69/52).

**Defects found in inherited Waves 1-3 (not trusted from docs):**
1. **BLOCKER** `EncounterServiceImpl.#dueFires` parsed `requestId` group index from the member slot (`slice(-3)[2]`), so entity-carried emitters on spawn group ≥ 1 never fired. Run-and-gun wave-2 shooters, twin-stick/skirmish wave-2 shooters, and shmup gunners were silent. Completion specs did not assert enemy shots.
2. **L12 budget claim was false on this machine.** Isolated `qa:bullet-budget` peaked at **342 live** (60 fps, 80.3 % reuse) against a 400 live gate. Prior "429 live" claim is not reproducible from `df850f2` factory output.
3. **Catalog honesty:** arena-combat required parked `sw2d.encounters`/`sw2d.weapons` (melee returns before `battle.update`); action-adventure required unused `sw2d.weapons`; stealth/heist required unused `sw2d.ai`/`sw2d.combat`. Boss-rush / shmups / bullet-hell required encounters without an `encounters` content role.
4. Stale `shooter.ts` header still claimed rail-shooter does not wire `sw2d.weapons`.

**Repairs in this checkpoint:**
- Parse group index from the second-last `requestId` segment; unit test fires a group-1 shooter from that origin.
- Densify bullet-hell opening emitters so the supported budget is actually reached.
- Drop unused required packs (stealth/heist: perception+world only; arena-combat: combat+melee; action-adventure: drop weapons from required). Add `encounters` content roles where the pack is required.
- `run-and-gun` completion spec now requires a live `shooter` *and* enemy `projectilesSpawned` in wave 2.

**Re-validation (this agent, system Chrome 152 / macOS arm64):**
- `npm run typecheck` PASS
- `npx vitest run` targeted: pursuit/wall/melee/runs/encounters/perception/vehicles/stage-scroll/items/puzzleRules/pinball/timing/generation/honesty/generate/catalogPackIntegrity/docsSync PASS (2587 in the generate+honesty+encounters batch)
- `npm run qa:completion` **21/21 PASS** (all Wave 1-3 completion specs, fresh factory output)
- `npm run qa:proof -- run-and-gun twin-stick-shooter stealth-game bullet-hell arena-combat action-adventure` **6/6 PASS**
- `npm run qa:bullet-budget` PASS: **peak 555 live @ 60.1 fps mean, p95 16.7 ms, pool reuse 80.8 %**
- `npm run limitations:extract`: 47 remain (unchanged; no Wave 4 rows closed)

Known leftover (not a Wave 1-3 product hole, not repaired here): `bindStarterProgression` survive mode still sets `outcome: 'complete'` at XP 6 as a surge milestone while the permadeath run continues (proof `survivorLike` asserts that). Dual HUD, not a second run authority. `ProjectilePool` remains the unpooled demo/proof path; generated games use `createProjectileRuntime`.

### Wave 4 L18 - kart held items
- `sw2d.items` gained `hold` / `useHeld` / `clearHeld` and a `vehicle.boost` effect; `VehicleService.triggerBoost()` applies it.
- kart-racer requires `sw2d.items`; generated `content/items.json` ships `kart-shell` + `kart-boost`.
- `bindStarterKartItem` grants/holds on box overlap, PRIMARY consumes, fires a heading shell, two boxes respawn. Race still owns completion.
- `npm run typecheck` PASS; items/vehicles/generate/honesty tests PASS.
- `npm run qa:proof -- kart-racer` PASS; `npm run qa:completion -- kart-racer` PASS (fresh factory, system Chrome).
- `npm run limitations:extract`: **46** machine-executable remain.

### Wave 4 L19 - endless-driving items / traffic
- Same held-item loop (`kart-boost` on the road). Traffic + off-road crash; best distance persisted through `context.saves`.
- `qa:completion -- endless-driving` PASS; `qa:proof -- endless-driving kart-racer` PASS.
- `npm run limitations:extract`: **45** remain.

### Wave 4 L21/L22 - match pointer swap + falling-block wall kicks
- `sw2d.puzzle-rules` rotate now wall-kicks. `bindStarterPuzzle` match mode hover/drag-swaps through `context.spatialPointer`.
- `qa:completion -- match-puzzle falling-block-puzzle` PASS; `qa:proof` PASS.
- `npm run limitations:extract`: **42** remain.

### Wave 4 L23/L28 - pinball table
- Table drains consume balls (default 3); zero is `game-over`. Launch/plunger wired. Breakout/pong no longer claim a missing pinball table.
- `qa:completion -- pinball-lite` PASS; `qa:proof -- pinball-lite` PASS.
- `npm run limitations:extract`: **39** remain.

### Wave 4 L26 - maze generation / fog / minimap
- Seeded perfect maze (`generateMazeLayout`), fog-of-war, minimap. maze-game requires `sw2d.generation`.
- `qa:completion -- maze-game` PASS; `qa:proof -- maze-game` PASS.
- `npm run limitations:extract`: **38** remain.

### Wave 4 L20 - boat/flight arcade
- Racing required; auto-start; buoy hazard; bank visual; boat→flight→airborne complete.
- `qa:completion -- boat-flight-racer` PASS; `qa:proof` PASS.
- `npm run limitations:extract`: **37** remain.
