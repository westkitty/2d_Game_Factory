# Anti-Gravity Post-Ten Candidate Program

First-ten base SHA: `acf802f7a32a3f341273c084931af37cb5461784`
Candidate branch: `candidate/antigravity-post-ten-program`
Candidate HEAD: `69d957d27d9d6426f2e79480acac6eedfd3a3f76`
Current candidate phase: Phase 13 (FOCUSED TESTS PASS, resumability proof repaired)

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
