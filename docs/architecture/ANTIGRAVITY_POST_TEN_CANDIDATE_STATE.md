# Anti-Gravity Post-Ten Candidate Program

First-ten base SHA: `acf802f7a32a3f341273c084931af37cb5461784`
Candidate branch: `candidate/antigravity-post-ten-program`
Candidate HEAD: `4055e5ec4842882b34f1396b6166104051c9113b`
Current candidate phase: Phase 17 (FOCUSED TESTS PASS) — Phase 18 next, per `POST_TEN_PROGRAM_SPEC.md`

---

### Phase 15 blocker: resolved by the external program authority

**Amended.** The evidence-based stop recorded below was correct when it was written and is
preserved as history, not deleted.

At the Phase-14 boundary no Phase-15 specification existed in the repository. The external
program authority subsequently supplied the authoritative Phase-15-through-36 continuation.
That continuation is now persisted in
[`POST_TEN_PROGRAM_SPEC.md`](POST_TEN_PROGRAM_SPEC.md). **Phase 15 is next.**

Read `POST_TEN_PROGRAM_SPEC.md` after any context compaction; it is deliberately complete so
the roadmap never has to be re-supplied.

#### Historical record — the original stop, kept verbatim

At the Phase-14 boundary, Phase 14 was the last phase with a recoverable specification.
Searched for a Phase 15+ spec and found none:

- `git grep 'Phase 1[5-7]' -- '*.md'` across **every remote branch** — no hits.
- `MASTER_PROJECT.md`, `PROJECT_BIBLE.md`, `README.md`, `OPERATIONAL_STATE.md`,
  `WORKBENCH_OPERATIONAL_STATE.md` — none enumerated post-ten phases.
- This file was the only post-ten program document; it recorded phases retrospectively and
  never carried a forward plan. The "Phase 11-36" phrase in the note below was a single
  unelaborated mention, not a phase list.
- `CAPABILITY_PROGRAM_STATE.md`'s closing "Remaining limitations" paragraph is a set of gaps,
  **not** an ordered phase sequence: Phase 13 (run lifecycle) came from late in that paragraph
  and Phase 14 (strategy orders) is not in it at all.

Work stopped at the durable Phase 14 boundary rather than inventing a Phase 15. That judgement
stands on its evidence; the specification simply did not exist in-repo yet, and now it does.

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

## Phase 15 — Local Multiplayer & Gamepad Routing

- **Phase:** 15
- **Capability:** `input.players` (`PlayerInputService`)
- **Status:** FOCUSED TESTS PASS
- **Starting SHA:** `0e84376` (`docs(program): persist post-ten phases 15-36 specification`)
- **ADR:** `docs/architecture/adr/0029-player-identity-is-a-routing-dimension.md` (new; indexed)

### Core decision

Player identity is a **routing dimension over the existing `ActionInput`**, not a second vocabulary.
There is no `P1_MOVE_LEFT`. Each seated player owns an ordinary `ActionInputHost` — the same
certified edge machine a single-player game uses — with its own adapters bound to its own device, so
**isolation is a property of ownership rather than of filtering**: player two's channel has no
adapter listening for player one's keys. That is why the proof can assert player two's *entire*
value snapshot is zero rather than that one action was suppressed.

### Contracts

`packages/contracts/src/playerInput.ts`, exported from `index.ts`:
`PLAYER_INPUT_CAPABILITY_ID`, `PlayerId`, `DeviceAssignment` (`keyboard-profile` | `gamepad-index`),
`deviceKey`/`sameDevice`, `KeyboardProfile`, `PlayerSlot`, `PlayerJoinState`, `PlayerJoinRejection`,
`PlayerJoinResult`, `GamepadDeadzoneConfig`, `PlayerRosterConfig`, `PlayerRosterDocument`,
`DEFAULT_GAMEPAD_DEADZONE`, `validatePlayerRosterDocument`/`InvalidPlayerRosterError`,
`GamepadSnapshot`, `GamepadSource`, `GamepadBinding(s)`, `GamepadStick`,
`STANDARD_GAMEPAD_BINDINGS`, `STANDARD_GAMEPAD_STICKS`, `applyDeadzone`, `applyRadialDeadzone`,
`PlayerInputService`.

### Schemas

- `packages/schemas/schemas/player-roster.schema.json` (`urn:sw2d:schema:content-players:v1`),
  registered as schema name `player-roster` and content document name `players`.
- Global validation not weakened: `additionalProperties: false`, followed by the contract's semantic
  gate (`minPlayers <= maxPlayers`, `playerIds` length/uniqueness, deadzone range).

### Runtime

- `packages/runtime/src/input/PlayerInputHub.ts` — the service.
- `packages/runtime/src/input/GamepadAdapter.ts` — one pad to one channel, plus `browserGamepadSource()`.
- `packages/runtime/src/input/keyboardProfiles.ts` — `DEFAULT_KEYBOARD_PROFILES` (two profiles that
  share **no** physical key, asserted by `keyboardProfileConflicts`), `mergeKeyboardProfiles`.
- `packages/runtime/src/core/createGame.ts` — builds the hub **only** when `content/players.json`
  exists, provides `input.players`, advances it in the existing single-owner `PRE_STEP` hook, and
  clears it on visibility loss. New optional `gamepadSource` option for QA injection.
- `packages/runtime/package.json` — new `./input-profiles` subpath (Phaser-free), mirroring the
  existing `./composition` subpath and for the same reason.
- `packages/runtime/src/input/KeyboardAdapter.ts` — resolves its blur target defensively instead of
  assuming a global `window`. No browser behaviour change; it makes a channel constructible in a
  non-DOM context.

### Presets changed

- `local-party-game`: controller families now `ui-simulation` + `top-down`; content role `players`
  added; limitation replaced with the new shared `LIMITATIONS.localTouchMultiplayer`.
- `pong`: content role `players` added; the "no proven multi-player input-routing abstraction"
  limitation replaced with `LIMITATIONS.localTouchMultiplayer` (the ball/paddle limitation stays —
  that is Phase 16).
- `packages/presets/src/shared.ts`: new shared `LIMITATIONS.localTouchMultiplayer`.
- Maturity deliberately **not** promoted, matching the Phases 11-14 precedent.

### Workbench authoring surface

- `workbench/server/playersLab.ts` — inspect + update `content/players.json` (schema then semantic
  validation, atomic write, path containment). Routes `POST /roster/inspect`, `POST /roster/update`
  (the `/roster` path keeps them inside the WB-SECURITY-001 audit).
- `workbench/src/views/playersLab.ts`, mounted in `inspector.ts`.
- Scope held deliberately small: counts, ready policy, slot ids, deadzone. **Not** a
  controller-remapping application — per-action rebinding belongs to the existing binding surface.
- `workbench/test/playersLab.test.ts` guards the one duplication (the server restates the default
  profile ids rather than importing the renderer package).

### Proof consumers

- **`proofs/local-party-game/` (new)** — primary defining proof, 13 named steps; spec
  `packages/qa/proof-specs/localPartyGame.ts`; frozen contract in the proof directory.
- **`proofs/pong/` (new)** — the Phase 15 **input foundation only**: two isolated paddle channels,
  7 named steps. No ball, no bounce, no score — Phase 16 consumes this shell rather than replacing it.
- Both inject a scripted `GamepadSource` through the new `createGame` option, which is the seam the
  contract defines for exactly this purpose.

### Tests added

- `packages/contracts/test/playerInput.test.ts` (18 tests) — including the five required deadzone
  cases (inside, exact boundary, above boundary, full positive, full negative) plus radial deadzone.
- `packages/runtime/test/playerInputHub.test.ts` (32 tests) — profiles, roster, join/leave/ready,
  exclusive ownership, reassignment, keyboard isolation, edge advancement, clear, dispose,
  adapter-count leak probe, gamepad mapping/deadzone/edges/disconnect/reconnect/reindex, and the
  single-player-unaffected case.
- `packages/schemas/test/contentDocuments.test.ts` (2 new tests).
- `proofs/local-party-game/tests/content.test.ts` and `proofs/pong/tests/content.test.ts` (7 each).
- `workbench/test/playersLab.test.ts` (1 drift test).

### Tests run — actual results

- `npm run typecheck` — **PASS**, 0 errors
- `npx vitest run` — **PASS, 160 files / 2802 tests** (was 155 / 2735 before Phase 15)
- `npm run validate` — **PASS** (typecheck, tests, workbench build, starter build, offline check:
  "no external request construct found")
- `npm run qa:workbench` — **PASS, 16/16**; WB-SECURITY-001 now audits **62** endpoints (was 60)
- `npm run qa:proof` (tranche gate, full suite) — **PASS, 31/31**, including `local-party-game` 13/13
  and `pong` 7/7, 0 console errors, 0 external requests

### Proof-quality evidence

No unconditional acceptance step exists in either spec. Three sabotages were applied, observed and
reverted (`grep SABOTAGE` clean afterwards):

| Sabotage | Result |
| --- | --- |
| exclusive device ownership removed from `PlayerInputHub` | party steps 3 and 11 FAIL |
| gamepad disconnect no longer clears held actions | party step 10 FAIL, step 9 PASS |
| every channel given every profile's bindings (cross-talk) | party steps 4-5 FAIL; pong steps 3 and 7 FAIL |

### Limitations changed

`LIMITATIONS.localTouchMultiplayer` (new, shared by `local-party-game` and `pong`) replaces both
"No multi-player/local multi-device input routing exists" and "Pong does not yet have a proven
multi-player input-routing abstraction".

### Known failures

None.

### Known shortcuts / characteristics a certifier should look at

1. **Same-device multi-touch multiplayer was not built.** This is stated in the limitation text and
   is the honest scope: the supported shape is one touch-controlled player plus keyboard/gamepad
   players. `DeviceAssignment` has no `touch` variant.
2. **Per-player channels run alongside the global `ActionInput`, not instead of it.** A key bound in
   both a profile and `DEFAULT_BINDINGS` drives both (e.g. `KeyA` is `MOVE_LEFT` globally and on
   profile A). Harmless because the meaning is identical, and deliberate because system actions
   (`PAUSE`) must stay global — but a certifier should confirm no generated shell reads the global
   channel for per-player gameplay.
3. **Gamepad `poll()` reads the source once per channel per frame.** With four pads seated that is
   four `getGamepads()` calls per frame. Correct and cheap in practice; a shared per-frame snapshot
   cache is the obvious optimisation if profiling ever asks for it.
4. **Device assignments do not persist across sessions**, per the specification. Players rejoin.
   `deadzone` is authored content, not a user setting; wiring it to the settings store was not done.
5. **`PlayerInputHub.adapterCount` is a class getter, not part of `PlayerInputService`.** Both proof
   shells read it defensively (`-1` when absent) rather than widening the renderer-neutral contract
   for a debug probe. A certifier may prefer it promoted or removed.
6. **The proofs' scripted `GamepadSource` lives in the proof `main.ts`**, reading
   `window.__SW2D_TEST_PADS__`. It falls through to the real `navigator.getGamepads()` reader when
   unset, so a human opening the page uses real hardware — but it is test-control code shipped in a
   proof build.

### Architectural concerns

- The hub is created by `createGame` from content rather than being a system pack, because it must
  advance inside the single-owner `PRE_STEP` hook that packs cannot reach. That is the right owner,
  but it does mean `input.players` appears in the capability registry without a pack id in
  `content/game.json` — a difference from every other capability worth a certifier's attention, and
  the reason `proofs/*/tests/content.test.ts` asserts the document is what grants it.
- Nothing prevents a game from seating a player and then reading the global input for that player's
  movement. The architecture makes the right thing easy; it does not make the wrong thing impossible.

### Work required from a later certifier

- Adversarial browser validation of both journeys, especially the disconnect/reconnect transition
  and the restart leak check.
- Real-hardware validation with two physical gamepads (the automated proof uses the scripted seam).
- Decide whether `adapterCount` belongs on the public service.
- Decide whether touch multiplayer is in scope for a later phase or stays a permanent limitation.

## Phase 16 — Ball & Paddle Arcade Systems

- **Phase:** 16
- **Capability:** `arcade.ball-paddle` (`BallPaddleService`)
- **Status:** FOCUSED TESTS PASS
- **Starting SHA:** `2670526` (`candidate(phase-15)`)
- **ADR:** `docs/architecture/adr/0030-ball-paddle-is-an-authored-simulation.md` (new; indexed)

### Core decisions

1. **A pure, renderer-neutral simulation rather than a physics engine.** A ball/paddle bounce is
   *authored* - the outgoing angle is a designed function of where the ball struck - which is the
   opposite of what a restitution solver computes. Plus determinism: a pure integrator with bounded
   substeps lets the browser proof assert exact speeds and exact scores. Follows the Phase-10
   vehicle/racing precedent. Matter is untouched (nothing needs constraints or polygon collision).
2. **One document, two genres.** Arena edges carry a behaviour (`bounce` | `goal` | `loss`), so
   Breakout is three bouncing walls plus a `loss` floor with bricks and lives, and Pong is two
   bouncing walls plus two `goal` edges naming their scorer with a target score.
3. **Single ownership of frame advancement.** `update()` is absent from `BallPaddleService`; the pack
   advances once per frame and consumers observe through `drainEvents()`. See the defect note below.
4. **The 80-degree bounce cap IS the degenerate-trajectory prevention.** An outgoing vector built by
   rotating the paddle normal by at most 80 degrees always keeps a real component along the normal,
   so a ball can never leave a paddle travelling along its own face. No special case needed.
5. **Bounded substeps, not CCD.** The ball moves at most half its radius per substep; the count is
   capped at 64; a definition whose top speed would exceed that budget at 30fps is rejected at
   install with `UnsupportedBallSpeedError` rather than tunnelling silently later.

### Contracts

`packages/contracts/src/ballPaddle.ts`, exported from `index.ts`: `BALL_PADDLE_CAPABILITY_ID`,
`ArenaEdge`/`ArenaEdgeBehavior`/`ArenaEdgeRule`/`ArenaDefinition`, `ServePolicy` (`fixed` |
`alternate` | `seeded-direction`), `BallDefinition`, `PaddleAxis`/`PaddleFacing`/`PaddleDefinition`
with `axisForFacing`/`normalForFacing`, `BrickDefinition`/`BrickPlacement`, `BallPaddleDocument`,
`BallPaddleStatus`/`BallState`/`PaddleState`/`BrickState`/`BallPaddleState`, `BallPaddleEvent`,
`BallPaddleService`, `validateBallPaddleDocument`/`InvalidBallPaddleError`, and the pure bounce maths
`paddleHitOffset`/`paddleBounceDirection`/`serveDirection`.

### Schemas

- `packages/schemas/schemas/ball-paddle.schema.json` (`urn:sw2d:schema:content-ball-paddle:v1`),
  registered as schema name `ball-paddle` and content document name `ball-paddle`. The `servePolicy`
  discriminated union is written as `oneOf` branches rather than `if`/`then` so Ajv strict mode can
  see every property each branch permits.
- `packages/packs/schemas/ball-paddle-config.schema.json` — `autoServe`.
- Global validation not weakened: `additionalProperties: false` throughout, followed by the
  contract's semantic gate at install.

### Pack

`sw2d.ball-paddle` (`packages/packs/src/ballPaddle/ballPaddlePack.ts`) providing `arcade.ball-paddle`.
`PACK_IDS.ballPaddle` / `CAPABILITY_IDS.ballPaddle`. Events declared in `packages/packs/src/events.ts`:
`ballPaddle:paddleBounce`, `ballPaddle:brickDestroyed`, `ballPaddle:goal`, `ballPaddle:ballLost`,
`ballPaddle:matchComplete`.

### Presets changed

- `breakout`: `sw2d.ball-paddle` added as required; content role `ball-paddle` added.
- `pong`: `sw2d.ball-paddle` added as required; content role `ball-paddle` added (keeping Phase 15's
  `players`).
- `packages/presets/src/shared.ts`: `LIMITATIONS.ballPaddleSystem` narrowed from "does not exist" to
  what is true, **including the honest substep caveat**.
- `docs/presets/PRESET_CAPABILITY_MATRIX.md` rows updated for both.
- Maturity deliberately not promoted, matching the Phases 11-15 precedent.

### Workbench authoring surface

`workbench/server/ballPaddleLab.ts` + `workbench/src/views/ballPaddleLab.ts`, mounted in
`inspector.ts`; routes `POST /arena/inspect`, `POST /arena/update` (the `/arena` path keeps them
inside the WB-SECURITY-001 audit). Edits ball speed and bounds, per-hit speed gain, bounce angle,
paddle size/speed and match rules. **Brick placement is reported but not edited** - that is the Scene
Composer's spatial job, and a second numeric editor would give two answers to where a brick is.

### Proof consumers

- **`proofs/breakout/` (new)** — primary defining proof, 12 named steps; spec
  `packages/qa/proof-specs/breakout.ts`. **The proof plays the game**: the paddle tracks the ball
  with real arrow-key presses. The one test control (`parkPaddle`) refuses to run while the ball is
  live, so a rally can never be staged.
- **`proofs/pong/` (upgraded)** — composes Phases 15 and 16, 12 named steps. Its six Phase-15 steps
  are unchanged and still asserted; the rally is played by both players with their own real keys.

### Tests added

- `packages/contracts/test/ballPaddle.test.ts` (22 tests) — bounce maths for all four facings, unit
  vectors, the parallel-trajectory bound, `bounceInfluence`, all three serve policies, and every
  branch of the semantic validator.
- `packages/packs/test/ballPaddle.test.ts` (29 tests) — install/validation, serve, wall and paddle
  bounce, steering, speed ramp and clamp, paddle travel clamp, brick damage/destruction/drops,
  board clear, loss and lives, goals and target score, two-player paddle independence, high-speed
  and long-frame tunnelling, determinism, resets, bus events, and the single-ownership regression.
- `packages/schemas/test/contentDocuments.test.ts` (document registry updated).
- `proofs/breakout/tests/content.test.ts` (8 tests).

### Tests run — actual results

- `npm run typecheck` — **PASS**, 0 errors
- `npx vitest run` — **PASS, 163 files / 2861 tests** (was 160 / 2802 before Phase 16)
- `npm run qa:workbench` — **PASS, 16/16**; WB-SECURITY-001 now audits **64** endpoints (was 62)
- `npm run qa:proof` (full suite) — **PASS, 32/32**, including `breakout` 12/12 and `pong` 12/12,
  0 console errors, 0 external requests

### Defects this phase found and fixed

1. **Double frame advancement (real architectural bug).** The first draft had the pack advance the
   simulation *and* the consuming shell advance it, so the ball double-stepped and the shell only
   ever saw the events of its own half. The browser proof caught it as a brick count that disagreed
   with the board. Fixed by removing `update()` from `BallPaddleService` entirely — the same rule
   `ActionInput` has used since Phase 1 — making the mistake unrepresentable rather than merely
   documented. Two regression tests guard it.
2. **Bounce direction wrong for two of four facings.** An earlier per-facing formula steered `left`
   and `down` paddles backwards. A contract test caught it; replaced with one general rule
   (`normal * cos + tangent * sin`) that cannot express the asymmetry.
3. **`status: 'complete'` with a live ball.** Contradictory state a consumer would draw as a ball
   hanging in mid-air. The proof asserted it; completion now parks the ball.
4. **A proof assertion that was too weak.** Step 7's original single-sample steering check survived
   the "flat mirror" sabotage because the sampled bounce happened to be near centre. Rewritten to
   sample several bounces and require at least one genuinely off-centre — which then failed the
   sabotage as it should.

### Proof-quality evidence

No unconditional acceptance step exists in either spec. Four sabotages were applied, observed and
reverted (`grep SABOTAGE` clean afterwards):

| Sabotage | Result |
| --- | --- |
| hit-location steering removed (flat mirror) | breakout steps 7 and 11 FAIL |
| brick hit points ignored | breakout step 6 FAIL, step 5 PASS |
| the loss edge no longer costs a life | breakout step 9 FAIL |
| goal-edge ownership ignored | pong steps 10 and 11 FAIL |

### Limitations changed

`LIMITATIONS.ballPaddleSystem` narrowed. It now states what is reusable **and** that collision safety
is bounded substepping within the definition's declared speed range, not universal CCD.

### Known failures

None.

### Known shortcuts / characteristics a certifier should look at

1. **Bounded substeps are not continuous collision detection.** Stated in the limitation, in the ADR
   and in code. A definition beyond the budget is rejected at install, so the failure mode is a
   startup error rather than a tunnelling ball - but the bound is real and worth confirming.
2. **One brick per substep.** `#resolveBricks` resolves at most one brick per substep to avoid
   double-reflecting. A ball wedged exactly between two bricks resolves them on consecutive substeps;
   correct, but the ordering is "first in layout order", not "nearest".
3. **Breakout brick score accrues to the first paddle's `playerId`.** There is no per-owner goal edge
   in a Breakout-shaped document, so `#defaultScoreOwner()` picks `paddles[0].playerId`. Fine for one
   paddle; a two-paddle Breakout variant would need an explicit owner.
4. **`parkPaddle` is a proof-shell test control** that refuses to run while the ball is live. It is
   shipped in the breakout proof build. Deliberate and guarded, but it is test-control code.
5. **No runtime bridge package.** None needed - the capability is renderer-neutral end to end and the
   only renderer-touching code is each consumer's own drawing.
6. **`autoServe` is off by default**, so a game that installs the pack and never calls `serve()` sits
   with a parked ball. Deliberate (the game decides when a round begins), but it is a quiet failure
   mode for a careless consumer.

### Architectural concerns

- The `drainEvents()` model means a consumer that forgets to drain accumulates events forever. The
  buffer is unbounded. In practice both proof shells drain every frame, and `reset()` clears it, but
  a bound (or a documented drain contract) would be safer.
- `BallPaddleServiceImpl.update()` is public on the class so the pack and unit tests can call it,
  while being absent from the interface. That is exactly the `ActionInputHost` pattern, but it does
  mean a consumer holding the impl type could still double-advance.

### Work required from a later certifier

- Adversarial browser validation of both journeys, especially the speed clamp and the board clear.
- Confirm the substep bound empirically at the top of the supported speed range on slower hardware.
- Decide whether the `drainEvents()` buffer needs an explicit bound.
- Decide the Breakout multi-paddle score-owner question.

## Phase 17 — Rhythm, Beat & Precision Timing

- **Phase:** 17
- **Capabilities:** `arcade.rhythm` (`RhythmService`), `arcade.reaction` (`ReactionService`)
- **Status:** FOCUSED TESTS PASS
- **Starting SHA:** `81a7e12` (`candidate(phase-16)`)
- **ADR:** `docs/architecture/adr/0031-rhythm-judges-against-a-transport.md` (new; indexed)

### Core decisions

1. **`AudioTransport` is the only authority for what time it is.** `performance.now()` drifts against
   the audio output clock, keeps running under tab throttling, and knows nothing about a pause - all
   three silently. `RhythmService.press()` takes **no timestamp**; it reads the transport itself, so
   a caller cannot judge against a stale or invented time.
2. **Two guarantees the service owns, not the caller.** A note is judged at most once, ever (one
   `#commit`, one `judged` flag, every path checks it); and nothing is judged while paused, so a
   pause can neither farm notes at a frozen time nor silently expire the notes it froze over.
3. **Beats are content.** A note authors exactly one of `timeMs` or `beat`; both or neither is a
   content error, so the resolver never guesses. One chart can mix both unambiguously.
4. **The reaction machine is a separate capability on a separate clock** - simulation time from
   `update(deltaMs)`, with the wait drawn from the canonical seeded RNG. A press during the wait is a
   false start; a response past the timeout is a *completed round with no time*, a different outcome.
5. **Judgement points are fixed in the contract** so a chart cannot inflate its own score.

### Contracts

`packages/contracts/src/rhythm.ts`, exported from `index.ts`: `RHYTHM_CAPABILITY_ID`,
`REACTION_CAPABILITY_ID`, `TransportState`/`AudioTransport`, `JudgementWindows`, `RhythmNote`,
`RhythmChart`, `RhythmDocument`, `msPerBeat`/`noteTimeMs`, `Judgement`/`JudgedNote`/
`RhythmInputOutcome`/`RhythmScore`/`RhythmChartStatus`/`RhythmState`, `RHYTHM_JUDGEMENT_POINTS`,
`RhythmService`, the reaction types (`ReactionPhase`, `ReactionRoundResult`, `ReactionSummary`,
`ReactionConfig`, `ReactionState`, `ReactionService`), `validateRhythmDocument`/
`InvalidRhythmChartError`, `MAX_CALIBRATION_MS`/`clampCalibration`, `classifyDelta`, `reactionWaitMs`.

### Schemas

- `packages/schemas/schemas/rhythm.schema.json` (`urn:sw2d:schema:content-rhythm:v1`), registered as
  schema name `rhythm` and content document name `rhythm`.
- `packages/packs/schemas/rhythm-config.schema.json` — `defaultChartId`, `reaction`.
- Global validation not weakened; the contract's semantic gate runs at install.

### Runtime

`packages/runtime/src/game-support/audioTransport.ts` — `BrowserAudioTransport` (reads
`AudioContext.currentTime`, clamps a backwards-moving clock to zero, degrades to `performance.now()`
when Web Audio is absent and reports that through `usingAudioClock`), `ManualAudioTransport` (same
contract, clock supplied rather than sampled), `createAudioTransport`. Exported from the runtime index.

### Pack

`sw2d.rhythm` (`packages/packs/src/rhythm/rhythmPack.ts`) providing both capabilities.
`PACK_IDS.rhythm`; `CAPABILITY_IDS.rhythm` / `.reaction` / `.audioTransport`. The transport is
**required** from the capability registry: a missing one is a construction error, not a silent no-op
that would judge every note against zero. Events: `rhythm:judged`, `reaction:stimulus`,
`reaction:round`.

### Presets changed

- `rhythm-action` and `reaction-timing`: `sw2d.rhythm` added as required, content role `rhythm` added.
- `packages/presets/src/shared.ts`: new shared `LIMITATIONS.rhythmTransport`, replacing both old
  "does not exist" claims and stating the honest scope (the game supplies the transport; no
  music-authoring tooling ships).
- `docs/presets/PRESET_CAPABILITY_MATRIX.md` rows updated for both.
- Maturity deliberately not promoted, matching the Phases 11-16 precedent.

### Workbench authoring surface

`workbench/server/rhythmLab.ts` + `workbench/src/views/rhythmLab.ts`, mounted in `inspector.ts`;
routes `POST /beatmap/inspect`, `POST /beatmap/update` (the `/beatmap` path keeps them inside the
WB-SECURITY-001 audit). Edits tempo, offset, the three windows and the calibration default, and
**reports every note's resolved absolute time** so a beat-authored chart can be checked against the
music. **Notes are not edited here** - placing notes against a waveform is a DAW's job, and a numeric
note grid would be a poor imitation of a tool that already exists.

### Proof consumers

- **`proofs/rhythm-action/` (new)** — primary defining proof, 12 named steps; spec
  `packages/qa/proof-specs/rhythmAction.ts`. Installs `ManualAudioTransport` so the journey sits at
  exact chart positions; a rhythm assertion against a free-running clock would be a timing race.
- **`proofs/reaction-timing/` (new)** — 10 named steps; spec `packages/qa/proof-specs/reactionTiming.ts`.
  Installs the **real** `BrowserAudioTransport` on a real `AudioContext` and asserts its clock source
  and state machine. The reaction test never consults it, so that check is free and genuine.

### Tests added

- `packages/contracts/test/rhythm.test.ts` (21 tests) — beat conversion, every window boundary
  including the exact edges, symmetry of early/late, calibration bounds, the seeded wait's
  determinism/variation/bounds, and every branch of the semantic validator.
- `packages/packs/test/rhythm.test.ts` (33 tests) — install/validation, judgement by delta,
  nearest-note selection, action and lane matching, the once-only guarantee, combo/accuracy, expiry
  exactly once, chart completion, pause/resume semantics, calibration, lookahead, load/reset, the
  full reaction machine (seeded wait, false start, response, timeout, rounds, summary, reset), and
  bus events.
- `packages/runtime/test/audioTransport.test.ts` (10 tests) — audio-clock reading, pause not
  advancing, the backwards-clock clamp, restart, the no-Web-Audio fallback, dispose, and the manual
  transport.
- `packages/schemas/test/contentDocuments.test.ts` (document registry updated).
- `proofs/rhythm-action/tests/content.test.ts` and `proofs/reaction-timing/tests/content.test.ts`
  (8 each).

### Tests run — actual results

- `npm run typecheck` — **PASS**, 0 errors
- `npx vitest run` — **PASS, 168 files / 2941 tests** (was 163 / 2861 before Phase 17)
- `npm run qa:workbench` — **PASS, 16/16**; WB-SECURITY-001 now audits **66** endpoints (was 64)
- `npm run qa:proof` (full suite) — **PASS, 34/34**, including `rhythm-action` 12/12 and
  `reaction-timing` 10/10, 0 console errors, 0 external requests

### Proof-quality evidence

No unconditional acceptance step exists in either spec. Four sabotages were applied, observed and
reverted (`grep SABOTAGE` clean afterwards):

| Sabotage | Result |
| --- | --- |
| the `judged` flag is ignored when selecting a note | rhythm step 6 FAIL |
| presses are judged while paused / before start | rhythm steps 2 and 9 FAIL |
| a press during the wait is ignored instead of a false start | reaction steps 4 and 9 FAIL |
| the reaction wait is a constant instead of a seeded draw | reaction step 5 FAIL, step 3 PASS |

The last control is instructive: a constant wait still satisfies "inside the authored bounds"
(step 3), which is precisely why step 5 asserts that two rounds differ.

Two defects were in the **proof**, not the implementation, and both were found by running it:
`judgedNoteIds` tracked presses only, so an expired note legitimately never appeared there (the shell
now also exposes the service's own complete record); and `accuracy` is reported rounded to four
decimal places, which a `1e-6` tolerance could never satisfy.

### Limitations changed

`LIMITATIONS.rhythmTransport` (new, shared by `rhythm-action` and `reaction-timing`) replaces
"No deterministic music-beat/audio-synchronization system exists yet" and "no specialized
reaction-test flow is implemented".

### Known failures

None.

### Known shortcuts / characteristics a certifier should look at

1. **`holdMs` is modelled but not judged.** `RhythmNote.holdMs` exists in the contract and schema and
   is validated, but a hold is judged as a single tap. Recorded rather than hidden.
2. **No audio actually plays.** The transport is the *position* of music; playing a track is the
   game's job through the existing audio bus. Neither proof plays a sound, so "the chart matches what
   the player hears" is asserted only through the transport, not acoustically.
3. **`BrowserAudioTransport` is only lightly browser-proofed.** Ten unit tests cover its behaviour;
   the reaction proof asserts it is on the audio clock and that start/pause/resume/stop behave, but
   no browser step asserts that its reported position advances in real time - that would reintroduce
   the timing race the manual transport exists to avoid.
4. **`rhythm.tick()` is called from the pack's `update()` every frame** while `press()` is called by
   the consumer. Unlike Phase 16, `tick()` is on the service interface, so a consumer *could* also
   call it. It is idempotent (a judged note is never re-judged), so a double call is harmless - but
   the asymmetry with Phase 16's stricter single-owner rule is worth a decision.
5. **No lookahead scheduler ships.** `state().upcoming` reports notes inside a fixed 2000ms window
   for a renderer to draw; scheduling audio events ahead of time is left to the game. The contract
   documents that a scheduling callback must never become the authority.
6. **`reaction-timing` ships a `driveTransport` test control** used only to exercise the real
   transport's state machine from the proof.

### Architectural concerns

- The `audio.transport` capability is provided by the **game** (via a `GameExtension` in both proofs)
  rather than by the runtime automatically. That is deliberate - the runtime cannot know whether a
  game wants the audio clock or a scripted one - but it means a preset requiring `sw2d.rhythm` will
  fail at install unless its generated shell also supplies a transport. The generator does not yet do
  that automatically; Phase 36's realization pass will need to.
- `RhythmService.tick()` returning expired notes *and* mutating state means a caller that ignores the
  return still gets the mutation. That is intended (the pack drives it) but is a second observation
  path alongside `judged()`.

### Work required from a later certifier

- Adversarial browser validation of both journeys, especially pause/resume and calibration.
- Decide whether `holdMs` should be judged as a hold or removed from the model.
- Decide whether `tick()` should leave the public interface, matching Phase 16's stricter rule.
- Confirm the generator supplies an `audio.transport` for any preset requiring `sw2d.rhythm`
  (currently a proof-shell responsibility).

---

## Phase 18 — Simulation Agents, Needs, Behavior & Schedules

- **Phase:** 18
- **Capability:** `simulation.agents` (`SimulationAgentsService`)
- **Status:** FOCUSED TESTS PASS
- **Starting SHA:** `ed74dc3` (`candidate(phase-17)`)
- **ADR:** `docs/architecture/adr/0032-agent-needs-are-authored-vocabulary.md` (new; indexed)

### Core decisions

1. **The capability holds no vocabulary of its own.** It knows a need has a range, a drift rate and
   two thresholds; it does not know that `hunger` exists. Shipping a `hunger`/`sleep`/`eat` starter
   vocabulary is how most engines do this, and it is why most games built on those engines feel like
   the same game. `pet-creature`'s proof asserts this directly: the agent's need set must be exactly
   the two needs the document declares and nothing else.
2. **Urgency normalises against each need's own authored range**, so a 0..100 need and a -50..50
   need compare on the same scale without the author converting anything by hand.
3. **Selection is utility, not scripting.** Score = base utility + Σ(need urgency × authored weight),
   highest eligible score wins, ties break on ascending behaviour id. No behaviour tree, no state
   machine, no scripting language.
4. **Preconditions and effects are a closed declarative union** (six condition kinds, five effect
   kinds). The moment a condition can be an arbitrary function, the document stops being data, the
   Workbench cannot show it, and content validation cannot check it.
5. **Blocking reasons are named, not silent.** An ineligible behaviour reports
   `blockedBy: 'precondition:has-tag'` or `'cooldown'`. A creature that does nothing is the hardest
   thing to debug in a simulation like this; a capability that cannot say why is untunable.
6. **Interruption applies no effects.** Only completion applies them. Partial effects on interruption
   would make "was it interrupted?" observable through need values — exactly the ambiguity the event
   stream exists to remove. `#complete()` clears `active` *before* applying effects, so re-entry
   cannot double-complete.
7. **Drift ticks every frame; selection runs on `decisionIntervalMs` (default 250).** A need that
   only moves on a decision boundary is visibly steppy; re-ranking every behaviour for every agent
   every frame is the cost that stops a colony from scaling, and a creature that re-decides sixty
   times a second dithers.
8. **Work orders are reservations, not a task graph.** One agent per order, one order per agent,
   tag-gated, priority with an ascending-id tie-break. Release resets progress to zero so work is
   never half-credited to the next taker, and `despawn()` releases whatever the departing agent held.

### Contracts

`packages/contracts/src/simulationAgents.ts`, exported from `index.ts`:
`SIMULATION_AGENTS_CAPABILITY_ID`, `NeedDefinition`/`NeedState`/`NeedLevel`, `needUrgency`/
`needLevel`/`tickNeed`, `BehaviorCondition` (`need-below`, `need-above`, `has-tag`, `lacks-tag`,
`schedule-activity`, `target-available`), `BehaviorEffect` (`need-delta`, `need-set`, `add-tag`,
`remove-tag`, `relationship-delta`), `BehaviorDefinition`/`BehaviorScore`/`ActiveBehavior`,
`behaviorScore`/`selectBehavior`, `ScheduleBlock`/`scheduleBlockAt`, `WorkOrder`/`WorkOrderKind`/
`WorkOrderState`, `RelationshipEntry`, `AgentDefinition`/`AgentState`,
`SimulationAgentsDocument`/`SimulationAgentsService`/`SimulationAgentEvent`,
`validateSimulationAgentsDocument`/`InvalidSimulationAgentsError`, `tieBreakBySeed`.

### Schemas

- `packages/schemas/schemas/agents.schema.json` (`urn:sw2d:schema:content-agents:v1`), registered as
  schema name `agents` and content document name `agents`.
- `packages/packs/schemas/simulation-agents-config.schema.json` — `documentName`,
  `decisionIntervalMs`, `minutesPerSecond`.
- Global validation not weakened; the contract's semantic gate (dangling need references, threshold
  ordering, zero-length schedule blocks, unknown behaviour references) runs at install.

### Pack

`sw2d.simulation-agents` (`packages/packs/src/simulationAgents/simulationAgentsPack.ts`).
`PACK_IDS.simulationAgents`; `CAPABILITY_IDS.simulationAgents`. Agents are processed in ascending id
order so a multi-agent frame is reproducible. Events: `agents:behavior`, `agents:need-level`,
`agents:work-order`.

### Presets changed

- `pet-creature`, `colony-lite`, `aquarium-terrarium`, `virtual-pet`: `sw2d.simulation-agents` added
  as required, content role `agents` added.
- `packages/presets/src/shared.ts`: `LIMITATIONS.creatureSimulation` rewritten from a "does not
  exist" claim to the honest remaining scope (no pathfinding — that is `sw2d.navigation`; no
  inter-agent negotiation; no needs that depend on another agent's needs).
- `docs/presets/PRESET_CAPABILITY_MATRIX.md` rows updated for all four.
- Maturity deliberately not promoted, matching the Phases 11-17 precedent.

### Workbench authoring surface

`workbench/server/agentsLab.ts` + `workbench/src/views/agentsLab.ts`, mounted in `inspector.ts`;
routes `POST /needs/inspect`, `POST /needs/update` (the `/needs` path keeps them inside the
WB-SECURITY-001 audit). Edits drift rates, both thresholds, per-behaviour base utility and per-need
weights — the numbers a creator re-tunes constantly — and **reports** how many seconds each need
takes to reach each threshold at the authored rate, which is the thing JSON hides while tuning.
**Preconditions, effects and schedules are reported, not edited**: a form for wiring an arbitrary
condition graph is a visual scripting environment, which this program has consistently declined to
build.

### Proof consumers

- **`proofs/pet-creature/` (new)** — one agent's inner life, 12 named steps; spec
  `packages/qa/proof-specs/petCreature.ts`.
- **`proofs/colony-lite/` (new)** — several agents sharing a job queue, 12 named steps; spec
  `packages/qa/proof-specs/colonyLite.ts`.

### Tests added

- `packages/contracts/test/simulationAgents.test.ts` (22 tests) — urgency normalisation across
  differently-ranged needs, level thresholds and their boundaries, drift clamping, every condition
  kind, scoring, selection and the id tie-break, schedule lookup including a block wrapping past
  midnight, and every branch of the semantic validator.
- `packages/packs/test/simulationAgents.test.ts` (36 tests) — install/validation, drift, threshold
  announcements once rather than per tick, automatic selection, precondition gating with named
  reasons, cooldowns, effects on completion, no effects on interruption, `interruptible: false`,
  relationships, spawn/despawn, the full work-order lifecycle (offer, tag gate, reservation
  exclusivity, one job per agent, completion, release resetting progress, cancel, release on
  despawn), and bus events.
- `proofs/pet-creature/tests/content.test.ts` and `proofs/colony-lite/tests/content.test.ts`.
- `packages/schemas/test/contentDocuments.test.ts` (document registry updated).

### Tests run — actual results

- `npm run typecheck` — **PASS**, 0 errors
- `npx vitest run` — **PASS, 172 files / 3017 tests** (was 168 / 2941 before Phase 18)
- `npm run qa:workbench` — **PASS, 16/16**; WB-SECURITY-001 now audits **68** endpoints (was 66)
- `npm run qa:proof` (full suite) — **PASS, 36/36**, including `pet-creature` 12/12 and
  `colony-lite` 12/12, 0 console errors, 0 external requests

### Proof-quality evidence

No unconditional acceptance step exists in either spec. Four sabotages were applied, observed and
reverted (`grep SABOTAGE` clean afterwards):

| Sabotage | Result |
| --- | --- |
| preconditions no longer gate eligibility | pet steps 4 and 8 FAIL |
| a despawned agent's work order is not released | colony step 9 FAIL |
| interrupted behaviours apply their effects | 2 pack tests FAIL |
| tie-break by insertion order instead of behaviour id | 1 contract test FAIL |

Two defects were found by running the work rather than by reading it. Six pack tests initially failed
because the pet *keeps choosing to eat*, so hunger never reached starvation — the fix was not to
weaken the assertions but to isolate the rules under test behind a `decisionIntervalMs` large enough
that no automatic selection occurs, and to rewrite the automatic-selection test to assert on the
event stream instead. And `pet-creature` step 12 originally asserted `clock.elapsedMs === 0` *after*
stepping two frames; the stepping was removed, because a reset that is only clean until the next
frame is not a reset.

### Limitations changed

`LIMITATIONS.creatureSimulation` (shared by `pet-creature`, `colony-lite`, `aquarium-terrarium`,
`virtual-pet`) rewritten from "no creature/needs simulation exists" to the honest remaining scope.

### Known failures

None.

### Known shortcuts / characteristics a certifier should look at

1. **No pathfinding, and no spatial model at all.** `target-available` is a boolean the game supplies;
   the capability never asks where anything is. A colonist "hauling" is a timer, not a walk. This is
   deliberate — `sw2d.navigation` owns movement — but it means an agent can work an order it could
   never physically reach.
2. **Relationships are a flat metric per ordered pair**, changed only by a `relationship-delta`
   effect. Nothing decays them, and no condition kind reads them, so a relationship can influence
   presentation but cannot yet gate a behaviour. Recorded rather than hidden.
3. **`decisionIntervalMs` is global, not per agent.** A colony where a few agents should think often
   and many should think rarely cannot express that yet.
4. **The schedule is one authored day, looping.** No calendar, no weekday/weekend, no seasons.
5. **`minutesPerSecond` couples game time to real time linearly** with no speed control; a
   management game wanting 1x/2x/3x would drive that through its own `update` scaling today.
6. **Both proofs use a test control (`drain`) to force a need low.** It writes through the same
   `need-set` path the effects use, so it is not a private back door, but it is a control a player
   has no equivalent for.

### Architectural concerns

- **The `agents:behavior` event stream is the only record of what an agent decided.** `AgentState`
  reports the *current* active behaviour; a consumer that misses an event has no way to reconstruct
  the history. That is the same shape as Phase 16's `drainEvents()` and is fine for a renderer, but a
  game wanting "what did this colonist do today" must record it itself.
- **`selectBehavior` is a pure function on the contract and is also called inside the pack.** A
  consumer can therefore score behaviours itself and act on a *different* choice than the one the
  pack made. Nothing enforces that the pack's selection is the only one. Phase 16 closed this shape
  by removing `update()` from the service; the analogous tightening here would be to stop exporting
  `selectBehavior`, at the cost of making the Workbench unable to preview a ranking.
- **Work-order progress advances only while an agent holds the order**, but the agent's *behaviour*
  and its *work order* are independent — an agent can hold `haul-crates` while its selected behaviour
  is `rest`, and the order still progresses. Whether that is a feature (jobs are assignments, not
  actions) or a defect (a resting colonist should not be hauling) is a design decision this phase did
  not make; `colony-lite` demonstrates the behaviour without endorsing it.

### Work required from a later certifier

- Adversarial browser validation of both journeys, especially the work-order lifecycle.
- Decide whether holding an order should require the matching behaviour to be active.
- Decide whether `selectBehavior` should leave the public contract, matching Phase 16's stricter
  single-owner rule.
- Decide whether a `relationship-above`/`relationship-below` condition kind should exist, which is
  what would make relationships load-bearing rather than decorative.
- Confirm the generator supplies `content/agents.json` for any preset requiring
  `sw2d.simulation-agents` (currently a proof-shell responsibility, same gap Phase 17 recorded for
  `audio.transport`).
