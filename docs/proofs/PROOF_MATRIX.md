# Proof Matrix

Phase 10's five deep, end-to-end proof games - the tier above Phase 8's smoke bar - plus the
capability-completion program's per-phase proof consumers. Each row is backed by a frozen
`proofs/<id>/PROOF_CONTRACT.md`, a real generated composition, and a committed real-browser proof
spec run through `npm run qa:proof`. Mechanically, `npm run qa:proof` is **7/7** as of this
revision.

## Capability program — Phase 1: reusable spatial pointer & interaction (ADR-0018)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/gallery-shooter/` | `gallery-shooter` | `SceneContext.spatialPointer` (world cursor), `SceneContext.interaction` (circle targets + priority), `hitTestPoint`, `sw2d.combat` | Three circular targets + one lowest-priority full-viewport background target; `onClick` kills the target under the cursor; a background click counts a miss | Start; hover selects `target-a`; click at its world point kills it; click empty space (miss, no target selected); click `target-c` (still resolved by world point); restart reinstalls | PASS |
| `proofs/point-and-click/` | `point-and-click` | `SceneContext.interaction` (hover enter/leave, click, drag→drop, pointer capture), `phaserBoundsShape` (live bounds), drop-zone resolution | A lever (hover state + click-to-pull) and a key dragged onto a chest drop-zone | Start; hover enter/leave on the lever; click pulls it; drag the key (captured while the pointer leaves its bounds) onto the chest; drop sets `keyInChest`; restart reinstalls | PASS |
| `proofs/twin-stick-shooter/` (upgraded) | `twin-stick-shooter` | `aimFromPointer` as an **optional** aim source | Existing wave/projectile proof + step 1b: with no digital `AIM_*` held, the mouse position yields `aimX>0, aimY<0` without firing; steps 2-5 prove digital aim still overrides and is independent | PASS |

The two new proof games' presets are left at `maturity: 'recipe'` for now — the frozen proofs
exist and pass `qa:proof`, but the formal `proof-validated` promotion (and its 5/7/62 catalog
count bookkeeping in `honesty.test.ts` / `OPERATIONAL_STATE.md`) is a dedicated catalog pass, not
folded into a capability phase.

## Phase 10 deep proofs

See [`PHASE10_PROOF_HANDOFF.md`](../architecture/PHASE10_PROOF_HANDOFF.md) for the phase-level
narrative (shared-architecture repair, deferred triggers, known limitations) this matrix does not
repeat.

| Proof | Preset | Reusable capabilities exercised | Game-specific mechanics | Browser journey | Lifecycle evidence | Offline evidence | Maturity result | Status |
|---|---|---|---|---|---|---|---|---|
| A - `proofs/chase-platformer/` | `chase-platformer` | `platformController`, `sw2d.world` (checkpoints), `sw2d.world-entities` (Tiled dispatch), `sw2d.combat` (health/damage/invulnerability), `sw2d.arcade` (score), live `content/tuning.json` | Coyote time, jump buffer, double jump (bounded movement policy), content-derived collectible quota, chase pressure frozen during pause and post-respawn spawn-grace, hazard death, checkpoint respawn | Start, move/jump, buffered jump, coyote jump, double jump, collect quota, activate checkpoint, die to hazard, respawn at checkpoint, chase pressure advances during play and freezes during pause/grace, reach exit after quota | Checkpoint/death/restart does not duplicate listeners or entities (per-life state resets cleanly on respawn) | N/A (no network surface) | `proof-validated` | PASS |
| B - `proofs/twin-stick-shooter/` | `twin-stick-shooter` | `topDownController` (independent digital aim, ADR-0016), shared `ProjectilePool`, `sw2d.combat`, `sw2d.world-entities` (`Enemy`-classed Tiled objects), `sw2d.arcade` (score) | Two content-authored enemy waves (wave 2 dormant until wave 1 clears), stationary turret-archetype contact hazards, real closest-in-range targeting, engine-level pause/restart | Start, move+aim simultaneously in different directions, fire, damage/kill two wave-1 enemies (wave completes, wave 2 activates), take contact damage from a wave-2 enemy, pause (state frozen), resume, restart (scene reinstalls) | Projectile counts bounded; `spawnedTotal = liveCount + expiredTotal` at every sample; restart returns a **fresh** `ProjectilePool`'s counters to zero, proving a real scene reinstall, not a reset flag | N/A (no network surface) | `proof-validated` | PASS |
| C - `proofs/tower-defense/` | `tower-defense` | `gridController` (keyboard cursor - spatial pointer stays deferred), `sw2d.progression` (currency), `sw2d.combat`, shared `ProjectilePool` | Fixed route, placement-cell validation, real closest-in-range target selection, **tower upgrade** (`SECONDARY_ACTION` on the tower's own cell, doubles projectile damage) | Start with known currency, move cursor, invalid placement rejected (no spend), valid placement (currency deducted), wave advances automatically, tower damages first enemy (2 hits at base damage), upgrade (currency deducted, damage doubles), second enemy dies in 1 hit at upgraded damage, victory with zero breaches | Route is deterministic (fixed waypoints/spawn timings); currency changes are exact at every step | N/A (no network surface) | `proof-validated` | PASS |
| D - `proofs/sokoban/` | `sokoban` | Real `sw2d.puzzle` (`PuzzleService`) via `packConfig.ts`'s `configSource: 'code'` seam (ADR-0017) - the **only** board state; `gridController` | Standard push/block rules (bounded game-specific TypeScript, no puzzle DSL); `CANCEL`→undo, `SECONDARY_ACTION`→reset, both read directly off `PuzzleService` | Start, ordinary move, legal push, invalid push (byte-for-byte unchanged, rejection counted), two more moves, second push (solves), undo (exact prior state restored), reset (exact initial state restored), replay to solve again | No parallel state/undo stack in `shellPack.ts` to leak; `PuzzleService.isSolved()` and the shell's own visible-completion read agree at every sample | N/A (no network surface) | `proof-validated` | PASS |
| E - `proofs/idle-incremental/` | `idle-incremental` | `sw2d.simulation` (resource ledger + job queue), `sw2d.progression` (currency), `SaveStore` (`context.saves`), `uiSimulationController` | Deterministic passive production, one job (`gather`), one upgrade (doubles the rate, load-bearing for subsequent production), versioned save record | Start, two equal-length stepped intervals (equal gold delta, proving determinism), two job cycles (accumulate currency), upgrade (currency deducted, rate doubles, subsequent production measurably faster), save, **real browser reload** (`gotoAndWaitForRuntime` against the same URL, not an in-memory reset), restored state matches saved state, simulation continues after reload | No canvas movement anywhere in the loop; SaveStore round-trips through real storage across the reload, not JS state | Zero external requests (shared `runSmoke`/`runProofs` oracle) | `proof-validated` | PASS |

## Reading this table against the acceptance contract

Every "Browser journey" cell above is the automated sequence the committed
`packages/qa/proof-specs/<name>.ts` file actually drives against a real production build via
system Chrome (`npm run qa:proof`) - not a manual checklist and not inferred from source reading.
Each proof spec asserts against the same `context.debug.contribute(...)` snapshot surface the
shared `readShellState()` helper reads, the same mechanism every Phase 8 smoke spec already used;
none of the five reaches into private state a real player interaction couldn't also observe.

"Maturity result" reflects `packages/presets/src/catalog/*.ts`'s live `maturity` field, mechanically
checked against this claim by `packages/presets/test/honesty.test.ts` (exactly these five ids may
claim `proof-validated`; every other preset is `smoke-validated` or `recipe`, never overstated).
