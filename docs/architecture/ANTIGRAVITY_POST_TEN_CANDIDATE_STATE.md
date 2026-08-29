# Anti-Gravity Post-Ten Candidate Program

First-ten base SHA: `acf802f7a32a3f341273c084931af37cb5461784`
Candidate branch: `candidate/antigravity-post-ten-program`
Candidate HEAD: `4055e5ec4842882b34f1396b6166104051c9113b`
Current candidate phase: Phase 15 (FOCUSED TESTS PASS) — Phase 16 next, per `POST_TEN_PROGRAM_SPEC.md`

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
