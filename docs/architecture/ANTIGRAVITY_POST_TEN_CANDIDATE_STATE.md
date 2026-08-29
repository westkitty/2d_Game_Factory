# Anti-Gravity Post-Ten Candidate Program

First-ten base SHA: `acf802f7a32a3f341273c084931af37cb5461784`
Candidate branch: `candidate/antigravity-post-ten-program`
Candidate HEAD: `69d957d27d9d6426f2e79480acac6eedfd3a3f76`
Current candidate phase: Phase 14 (FOCUSED TESTS PASS)

---

### Historical Note: Misrouted Work Preserved
The dungeon-chest / lockpicking prototype was accidentally implemented under Phase 13, preserved on remote branch `salvage/antigravity-dungeon-chests`, and reverted from the post-ten program candidate before continuing. It is not part of the Phase 11–36 program.

---

## Phase 11 — AI Perception, Awareness & Pursuit

- **Phase:** 11
- **Capability:** `ai.perception`, `ai.pursuit`
- **Status:** FOCUSED TESTS PASS
- **Starting SHA:** `acf802f7a32a3f341273c084931af37cb5461784`
- **Candidate commit:** `88fe47e` (repaired in `candidate(repair-11-12)`)
- **Contracts:** `packages/contracts/src/perception.ts`, exported from `packages/contracts/src/index.ts`
- **Schemas:** `packages/schemas/schemas/perception-catalog.schema.json`, registered as `perception-catalog` under document name `perception` in `packages/schemas/src/validator.ts` and `packages/schemas/src/contentDocuments.ts`
- **Packs:** `sw2d.ai-perception` (`packages/packs/src/aiPerception/aiPerceptionPack.ts`), providing `ai.perception` and `ai.pursuit`
- **Runtime bridges:** `packages/runtime/src/game-support/perceptionRuntime.ts`, exported from `packages/runtime/src/index.ts`
- **Generator/template changes:** none required
- **Workbench changes:** `workbench/server/perceptionLab.ts`, `workbench/src/views/perceptionLab.ts`, route `POST /perception/inspect` in `workbench/server/api.ts`, mounted in `workbench/src/views/inspector.ts`
- **Presets changed:** `stealth-game`, `heist-game` in `packages/presets/src/catalog/topDownAction.ts`, `chase-platformer` in `packages/presets/src/catalog/platforming.ts`
- **Proof consumers:** `proofs/stealth-game/` (defining journey in `packages/qa/proof-specs/stealthGame.ts`), `proofs/chase-platformer/` (regression checked)
- **Tests added:**
  - `packages/contracts/test/perception.test.ts` (8 tests)
  - `packages/schemas/test/validator.test.ts` (perception test)
  - `packages/packs/test/aiPerception.test.ts` (10 tests)
  - `packages/runtime/test/perceptionRuntime.test.ts` (2 tests)
  - `proofs/stealth-game/tests/content.test.ts` (5 tests)
- **Tests run:**
  - `npm run typecheck` (PASS)
  - vitest test suite for Phase 11 (328 tests PASS)
  - `packages/presets/test/` (605 tests PASS)
  - `packages/qa/src/runProofs.ts stealth-game` (1/1 PASS)
  - `packages/qa/src/runProofs.ts chase-platformer` (1/1 PASS)
  - `npm run qa:workbench` (16/16 browser journeys PASS)
- **Actual results:** All focused tests passing, 0 console errors, 0 external network requests
- **Limitations changed:** `LIMITATIONS.stealthAi` and `LIMITATIONS.chasePressure` narrowed to reflect existence of `sw2d.ai-perception`
- **Known failures:** None
- **Suspected shortcuts:** None
- **Architectural concerns:** None
- **Work required from certifier:** Adversarial browser validation of stealth and chase journeys.

---

## Phase 12 — Platformer Climbing, Wall-Slide, Wall-Jump & Ledge-Hang

- **Phase:** 12
- **Capability:** `movement.climbing`
- **Status:** FOCUSED TESTS PASS
- **Starting SHA:** `88fe47e`
- **Candidate commit:** `5215687` (repaired in `candidate(repair-11-12)`)
- **Contracts:** `packages/contracts/src/climbing.ts`, exported from `packages/contracts/src/index.ts`
- **Schemas:** `packages/schemas/schemas/climbing-config.schema.json`, registered as `climbing-config` under document name `climbing` in `packages/schemas/src/validator.ts` and `packages/schemas/src/contentDocuments.ts`
- **Packs:** `sw2d.climbing` (`packages/packs/src/climbing/climbingPack.ts`), providing `movement.climbing`
- **Runtime bridges:** `packages/runtime/src/game-support/climbingRuntime.ts`, exported from `packages/runtime/src/index.ts`
- **Generator/template changes:** none required
- **Workbench changes:** `workbench/server/climbingLab.ts`, `workbench/src/views/climbingLab.ts`, route `POST /climbing/inspect` in `workbench/server/api.ts`, mounted in `workbench/src/views/inspector.ts`
- **Presets changed:** `climbing-game` (primary defining preset), `precision-platformer` in `packages/presets/src/catalog/platforming.ts`
- **Proof consumers:**
  - `proofs/climbing-game/` (primary defining consumer: wall-slide, wall-jump, wall-to-wall movement, ledge detection, ledge grab, ledge drop, recovery, ledge climb, exit, clean restart; spec `packages/qa/proof-specs/climbingGame.ts`)
  - `proofs/precision-platformer/` (secondary regression consumer; spec `packages/qa/proof-specs/precisionPlatformer.ts`)
- **Tests added:**
  - `packages/contracts/test/climbing.test.ts` (7 tests)
  - `packages/schemas/test/validator.test.ts` (climbing-config test)
  - `packages/packs/test/climbing.test.ts` (7 tests)
  - `packages/runtime/test/climbingRuntime.test.ts` (2 tests)
  - `proofs/climbing-game/tests/content.test.ts` (5 tests)
  - `proofs/precision-platformer/tests/content.test.ts` (5 tests)
- **Tests run:**
  - `npm run typecheck` (PASS)
  - vitest test suite for Phase 12 (76 targeted tests PASS)
  - `packages/presets/test/` (605 tests PASS)
  - `packages/qa/src/runProofs.ts climbing-game` (1/1 PASS)
  - `packages/qa/src/runProofs.ts precision-platformer` (1/1 PASS)
  - `npm run qa:workbench` (16/16 browser journeys PASS)
- **Actual results:** All focused tests passing, 0 console errors, 0 external network requests
- **Limitations changed:** `LIMITATIONS.climbingMechanics` updated to reflect existence of `sw2d.climbing`
- **Known failures:** None
- **Suspected shortcuts:** None
- **Architectural concerns:** None
- **Work required from certifier:** Adversarial browser validation of climbing, wall-to-wall traversal, ledge grab, ledge drop, recovery, and ledge climb.

---

## Phase 13 — Run Lifecycle & Roguelite Meta-Progression

- **Phase:** 13
- **Capability:** `progression.runs` (RunService)
- **Status:** FOCUSED TESTS PASS
- **Starting SHA:** `e12785b8d25832475557a065b400db03dd283bfb`
- **Candidate commit:** `candidate(phase-13): add run lifecycle and meta progression`
- **Contracts:** `packages/contracts/src/runs.ts` — RunDefinition, RunState, RunService, RunResetParticipant, RunsDocument, SeedPolicy, RunCondition, CarryoverRules, RewardRules, UpgradeDefinition; exported from `packages/contracts/src/index.ts`
- **Schemas:** `packages/schemas/schemas/runs.schema.json` (content-runs:v1), registered under document name `runs`; `packages/packs/schemas/runs-config.schema.json`
- **Packs:** `sw2d.runs` (`packages/packs/src/runs/runsPack.ts`) providing `progression.runs` (RUNS_CAPABILITY_ID)
- **Workbench authoring surface:** `POST /lifecycle/inspect`, `POST /lifecycle/update` in `workbench/server/api.ts`; `workbench/src/views/runsLab.ts` — passes WB-SECURITY-001 (59 endpoints audited, 16/16 journeys PASS)
- **Proof consumers:**
  - `proofs/action-roguelite/` — primary defining proof (18-step journey); spec `packages/qa/proof-specs/actionRoguelite.ts`
  - `proofs/survivor-like/` — secondary proof (10-step journey); spec `packages/qa/proof-specs/survivorLike.ts`
- **Tests run (original Phase 13 commit `69d957d`):**
  - `npm run typecheck` (PASS, 0 errors)
  - `packages/packs/test/runs.test.ts` (vitest, targeted)
  - `packages/qa/src/runProofs.ts action-roguelite` (1/1 PASS — 18/18 steps, 0 console errors, 0 external requests)
  - `packages/qa/src/runProofs.ts survivor-like` (1/1 PASS — 10/10 steps, 0 console errors, 0 external requests)
  - `npm run qa:workbench` (16/16 browser journeys PASS)
- **Actual results:** All focused tests passing, 0 console errors, 0 external network requests
- **Limitations changed:** `LIMITATIONS.runLifecycle` updated to reflect existence of `sw2d.runs`
- **Known failures:** None
- **Architectural concerns:** None
- **Work required from certifier:** Adversarial browser validation of run lifecycle (start, defeat, reset, meta-upgrade, victory), seed determinism across resets, and permanent meta-unlock persistence.

### Phase 13 repair — resumability shortcut removed

The Phase 13 commit shipped one dishonest acceptance step:

```ts
const step17_resumable = true;   // "SaveStore has no has() method"
```

That is now removed. `SaveStore.load` already reports a `SaveLoadOutcome`
(`'loaded'` when the slot holds a record at the current schema version,
`'default'` when it is empty), so no `SaveStore.has()` was added — the proof
uses the public API the store already exposes.

**Architectural change (justified, not test-driven):** `RunServiceImpl` previously
flushed the active-run save only on `startRun` / `addTransientCurrency` /
`purchaseUpgrade` / `dispose`. Elapsed run time and combat stats — which change
every frame — were never checkpointed, so a `resumable: true` run that survived a
crash came back with the currency from its last pickup and none of its progress.
`update(deltaMs)` now checkpoints on a bounded coalescing window
(`RUNS_PERSIST_INTERVAL_MS = 1000`, measured in accumulated **run** time, never wall
clock, so fixed-step harness and real browser behave identically). Lifecycle events
still flush immediately; per-frame localStorage writes are still avoided.

**Test surfaces added (public behaviour only, no private-state pokes):**
- `packages/packs/test/runs.test.ts` — four new tests (14 → 18 in that file):
  - full round trip: start resumable run → mutate currency/upgrade/stats/duration →
    assert `SaveStore.load` outcome `'loaded'` and record contents → rebuild
    `RunService` over the same store → assert `runId` / `phase` / `attempt` / `seed` /
    `transientCurrency` / `transientUpgrades` / `stats` / `runDurationMs` restored →
    `winRun()` → assert slot outcome `'default'` → third `RunService` boots
    `idle`, `attempt: 1`, zeroed stats, no transient upgrades;
  - defeated and abandoned runs are likewise not resumed;
  - `resetRun()` clears the slot so a discarded attempt is not resumed;
  - the checkpoint interval itself: nothing written mid-window, duration+stats written
    once the window is crossed, remainder flushed on `dispose()`.
- `proofs/action-roguelite/src/game-specific/shellPack.ts` — two shell methods:
  `probeSavedRun()` (reads the real `SaveStore` active slot and returns its
  `SaveLoadOutcome` + record) and `rehydrateRunService()` (constructs a second
  `RunServiceImpl` over the same `SaveStore` and the same `content/runs.json`, and
  returns the `RunState` it boots with — the "relaunch the game" half of resumability).
  `ActionRogueliteShellState` gained `runId` so the proof can compare it.
- `packages/qa/proof-specs/actionRoguelite.ts` — `step17_resumable` replaced by
  `step17a_activeRunPersisted`, `step17b_restoresIntoFreshService`,
  `step17c_finishedRunNotResumed`. Journey is now 20 named acceptance steps.

**Negative-control verified** (each sabotage reverted afterwards; `grep` confirms no
sabotage remains):

| Sabotage | Result |
| --- | --- |
| `#clearActiveSave()` made a no-op | `step17c` FAIL, 17a/17b PASS |
| `#persistActive()` made a no-op | `step17a` + `step17b` FAIL, 17c PASS |
| constructor resume branch disabled | `step17b` FAIL, 17a/17c PASS |

**Tests run after repair:**
- `npm run typecheck` (PASS, 0 errors)
- `npx vitest run` (full suite: **152 files, 2683 tests PASS**)
- `packages/qa/src/runProofs.ts action-roguelite` (1/1 PASS — 20/20 steps, 0 console errors, 0 external requests)
- `packages/qa/src/runProofs.ts survivor-like` (1/1 PASS — 10/10 steps, 0 console errors, 0 external requests)

**Suspected shortcuts after repair:** none in Phase 13. The only remaining
characteristic worth a certifier's attention is deliberate and documented in code:
run time and stats are checkpointed on a 1000ms coalescing window, so a hard crash
can lose up to one second of run time and the stats accrued within it. Currency,
upgrades and lifecycle transitions are never in that window.

---

## Phase 14 — Strategy Orders & Tactical Actions

- **Phase:** 14
- **Capabilities:** `strategy.orders` (`StrategyOrdersService`), `strategy.tactics` (`StrategyTacticsService`)
- **Status:** FOCUSED TESTS PASS
- **Starting SHA:** `7902701` (`candidate(phase-13 repair)`)
- **ADR:** `docs/architecture/adr/0028-strategy-orders-and-tactical-actions.md` (new; indexed in `adr/README.md`)

### Contracts

`packages/contracts/src/strategyOrders.ts`, exported from `packages/contracts/src/index.ts`:

- Targets: `OrderTarget` (`none` | `position` | `entity` | `region` | `direction`), `ORDER_TARGET_KINDS`,
  `orderTargetPoint()`, `orderTargetDistance()`.
- Orders: `OrderKind` (`move`, `attack`, `attack-move`, `hold`, `stop`, `interact`, `guard`, `ability`),
  `OrderStatus`, `isResolvedOrderStatus()`, `OrderFailureReason`, `OrderQueueMode`
  (`replace` | `append` | `front`), `StrategyOrder`, `OrderIssueRequest`, `OrderRejection`,
  `OrderIssueResult`, `OrderGroup`.
- The authority seam: `OrderWorldAdapter`, `OrderActorSnapshot`, `OrderExecutionOutcome`, `OrderProgress`.
- Tactics: `TacticalActionDefinition`, `StrategyActionsDocument`, `TacticalTargeting`,
  `TacticalTargetFilter`, `TacticalValidity`, `TacticalInvalidReason`, `TacticalExecutionResult`.
- Validation: `validateStrategyActionsDocument()`, `InvalidStrategyActionsError`.

### Schemas

- `packages/schemas/schemas/strategy-actions.schema.json` (`urn:sw2d:schema:content-strategy-actions:v1`),
  registered as schema name `strategy-actions` in `packages/schemas/src/validator.ts` and as content
  document name `strategy-actions` in `packages/schemas/src/contentDocuments.ts`.
- `packages/packs/schemas/strategy-actions-config.schema.json`
  (`urn:sw2d:schema:pack-strategy-actions-config:v1`) — `defaultQueueMode`, `historyLimit`.
- Global schema validation was **not** weakened. `additionalProperties: false` throughout; the schema
  gate is followed by a second semantic gate (`validateStrategyActionsDocument`) at pack install for
  the rules JSON Schema cannot express (unique ids, `minRange <= range`, a `targeting: 'none'` action
  that also declares a range).

### Pack

`sw2d.strategy-actions` (`packages/packs/src/strategyActions/strategyActionsPack.ts`), providing both
capabilities. `PACK_IDS.strategyActions` / `CAPABILITY_IDS.strategyOrders` / `CAPABILITY_IDS.strategyTactics`
in `packages/packs/src/ids.ts`. Exported from `packages/packs/src/index.ts`. Declares **no** dependency on
`sw2d.strategy` — a continuous RTS installs it alone.

### Authority and determinism (the load-bearing decisions)

- The service owns order ids, queue order, status transitions, the tick counter, cancellation and the
  failure vocabulary. The `OrderWorldAdapter` owns only "where is this actor / is it alive" and "what
  does one tick of this order do". An adapter can refuse or complete an order; it can never author a
  status, an id, a queue position or a failure reason.
- Exactly one adapter at a time (`WorldAdapterAlreadySetError`); issuing with none throws
  (`MissingWorldAdapterError`) rather than silently accepting orders nothing will run.
- `strategy.orders.actorSnapshot()` is the single answer to "where is this actor"; `strategy.tactics`
  reads range through it rather than keeping a second view.
- Order ids are `ord-<n>` from a monotonic counter rewound only by `reset()`.
- `tick()` counts `update()` calls; cooldowns and issued/started/resolved stamps are in ticks, never
  wall clock, so the fixed-step QA harness and a real browser agree.
- Within a tick, actors advance in ascending actor-id order. Within one `issue()`, orders are created
  in the caller's actor order after duplicate ids are dropped keeping the first occurrence; `groupId`
  members are merged after the explicit `actors` list, then deduplicated.
- Dead/removed actor → active order and whole queue fail `actor-removed`. Entity target that dies
  mid-order → that order fails `target-lost`. `replace` → displaced orders resolve `cancelled` with
  `superseded`. A `stop` order is the cancellation itself, recorded in history.

### Events

`packages/packs/src/events.ts` declaration merge: `orders:issued`, `orders:resolved`, `tactics:executed`.

### Presets changed

`packages/presets/src/catalog/strategyDefense.ts`:
- `simple-rts`: `sw2d.navigation` promoted from optional to required; `sw2d.strategy-actions` added as
  required; limitation replaced by the new `LIMITATIONS.rtsSelectionUi`.
- `turn-based-tactics`: `sw2d.strategy-actions` added as required; limitation narrowed to line-of-fire
  occlusion and multi-unit turn ordering.
- `auto-battler` and `territory-control` limitation text updated to reference the now-existing capability.
- `packages/presets/src/shared.ts`: new shared `LIMITATIONS.rtsSelectionUi`.
- `docs/presets/PRESET_CAPABILITY_MATRIX.md` rows for both presets corrected (both were already stale
  for Phase 5: `simple-rts` listed `navigation` in the controller column, `turn-based-tactics` listed it
  as optional).
- **Maturity was deliberately not promoted.** Both presets stay `recipe` / `smoke-validated`. Phases 11-13
  set the precedent that a new committed proof does not by itself claim `proof-validated`; the 5/7/62
  catalog bookkeeping in `honesty.test.ts` is a dedicated catalog pass.

### Workbench authoring surface

- `workbench/server/strategyActionsLab.ts` — read-only inspect of `content/strategy-actions.json`,
  schema-validated then semantically validated before it reports anything.
- `workbench/src/views/strategyActionsLab.ts`, mounted in `workbench/src/views/inspector.ts`.
- Route `POST /tactics/inspect` in `workbench/server/api.ts` (the `/tactics` path keeps it inside the
  WB-SECURITY-001 non-executable route audit, same reasoning as Phase 13's `/lifecycle`).
- Read-only on purpose: the order-lifecycle half of the capability is not content-authored.

### Proof consumers

- **`proofs/simple-rts/` (new)** — primary defining proof. Preset `simple-rts`; spec
  `packages/qa/proof-specs/simpleRts.ts`; frozen contract `proofs/simple-rts/PROOF_CONTRACT.md`
  (13 named steps). Registered in `PROOF_SPEC_MODULES`. The shell contributes exactly two things:
  the drag-rectangle selection surface and the `OrderWorldAdapter` (which routes through
  `sw2d.navigation`'s `RouteFollower` and damages through `sw2d.combat`).
- **`proofs/turn-based-tactics/` (upgraded)** — secondary proof that the capability is not RTS-only.
  All five Phase 5 (navigation) steps are unchanged and still asserted; ten Phase 14 steps added.
  `content/strategy-actions.json` added; `sw2d.strategy-actions` added to `content/game.json` and
  `src/main.ts`; the shell now provides a `game.grid-shell` capability so the spec can drive it.

### Tests added

- `packages/contracts/test/strategyOrders.test.ts` (11 tests)
- `packages/packs/test/strategyActions.test.ts` (32 tests)
- `packages/schemas/test/contentDocuments.test.ts` (2 new tests: valid + malformed strategy-actions)
- `packages/packs/test/capabilityIds.test.ts` (`runsPack` and `strategyActionsPack` added to the
  governed pack list — `sw2d.runs` had been missing from it since Phase 13)
- `packages/presets/test/catalogPackIntegrity.test.ts` (`strategyActionsPack` added to `REAL_PACKS`)
- `proofs/simple-rts/tests/content.test.ts` (6 tests)

### Tests run — actual results

- `npm run typecheck` — **PASS**, 0 errors
- `npx vitest run` — **PASS, 155 files / 2735 tests** (was 152 / 2683 before Phase 14)
- `npx vitest run packages/presets/test` — **PASS, 605 tests**
- `npx vitest run workbench/test` — **PASS, 223 tests**
- `npm run qa:workbench` — **PASS, 16/16 browser journeys**; WB-SECURITY-001 now audits **60** endpoints
  (was 59) and all limits still enforced
- `npm run qa:proof` (full suite, not just the touched targets) — **PASS, 29/29**, including
  `simple-rts` 13/13 and `turn-based-tactics` 15/15, 0 console errors, 0 external requests

### Proof-quality evidence (no unconditional acceptance)

Every named acceptance step in both specs tests an observable property; `grep` confirms no
`const step... = true;` placeholder anywhere under `packages/qa/proof-specs/`. Four sabotages of
`packages/packs/src/strategyActions/strategyActionsPack.ts` were applied, observed, and reverted
(`grep SABOTAGE` clean afterwards):

| Sabotage | Result |
| --- | --- |
| `stop()` returns without clearing the lane | simple-rts step 9 FAIL, step 8 PASS |
| dead-target detection removed (issue-time and per-tick) | simple-rts step 10 FAIL |
| adapter failure reason discarded in `#settle` | turn-based-tactics `failurePathOk` FAIL |
| a successful `execute` never records the cooldown | turn-based-tactics `cooldownOk` FAIL |

Two genuine defects were found and fixed by running the proof rather than by guessing:
the `simple-rts` spec initially waited on `active[actor] === null`, which is already true for a
freshly issued (still `queued`) order — replaced with an order-status poll; and its "out of range"
tactical check was taken from a unit that the earlier attack step had already walked into range.

### Limitations changed

- `LIMITATIONS.rtsSelectionUi` (new, shared by `simple-rts` and `territory-control`) replaces
  `simple-rts`'s "box-select and command-queue UI are not implemented".
- `turn-based-tactics`'s "attack-range/line-of-fire resolution and a full turn-action state machine"
  narrowed to line-of-fire **occlusion** and multi-unit turn ordering.

### Known failures

None.

### Known shortcuts / characteristics a certifier should look at

1. **`usesRemaining()` returns `Number.POSITIVE_INFINITY`** for an action with no `usesPerTurn`. That is
   the right in-process value, but it JSON-serialises to `null` — visible in the proof's own debug
   snapshot (`"remainingUses": null`). Any consumer that ships `TacticalValidity` over a wire must
   handle that. Not a bug; an unhandled serialisation edge.
2. **`OrderQueueMode: 'front'` inserts at queue index 0 and therefore wins its priority tie**, so a
   later `front` order outranks an earlier equal-priority one. Intended ("jump the queue"), but it is a
   policy decision, not a derived property, and it is only covered by a unit test — no proof step
   exercises `front` in a browser.
3. **`OrderKind` `interact` and `guard` have no proof-consumer coverage.** They are in the contract and
   the enum, and unit tests cover `guard` as a running order, but no browser journey uses either.
4. **Region and direction targets are validated but not exercised by a proof consumer.** Unit tests
   cover their rejection paths (zero-area region, zero-vector direction); no shell issues one.
5. **Tactical action points are per-actor and unscoped by team.** `refresh()` with no argument refreshes
   every actor the service has seen, including the opposing side. A game wanting per-team refresh must
   call `refresh(actorId)` per unit. Adequate for both proofs; a real tactics game may want the service
   to know about teams here.
6. **No runtime bridge package** (`packages/runtime/src/game-support/…`) was added. Phases 11 and 12 each
   added one; Phase 14 did not need one because the capability is renderer-neutral end-to-end and the
   only renderer-touching code is the consumer's own adapter. If a later phase finds two consumers
   writing the same Phaser-side adapter, that is the moment for a bridge.

### Architectural concerns

- The `OrderWorldAdapter` is a real seam, but it is also a real burden: every consumer must implement
  `actor()` correctly or the service's dead-actor handling silently never fires. The `MissingWorldAdapterError`
  guard catches the absent case; it cannot catch a wrong one.
- `strategy.turns` (`sw2d.strategy`) and `strategy.orders` are deliberately independent. Nothing stops a
  game issuing orders for a team whose turn it is not; enforcing that is the consumer's job (or a later
  phase's). Both are documented, neither is enforced.

### Work required from a later certifier

- Adversarial browser validation of both proof journeys, especially the queue/replace/cancel transitions
  and the four failure reasons.
- Confirm the determinism claim independently (same order sequence → same tick counts) rather than
  trusting step 13.
- Decide whether `front`, `interact`, `guard`, and region/direction targets should get proof coverage or
  be trimmed from the contract.
- Decide the `usesRemaining()` `Infinity` serialisation question.
