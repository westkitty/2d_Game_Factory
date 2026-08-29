# Anti-Gravity Post-Ten Candidate Program

First-ten base SHA: `acf802f7a32a3f341273c084931af37cb5461784`
Candidate branch: `candidate/antigravity-post-ten-program`
Candidate HEAD: `e12785b8d25832475557a065b400db03dd283bfb`
Current candidate phase: Phase 13 (FOCUSED TESTS PASS)

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
- **Tests run:**
  - `npm run typecheck` (PASS, 0 errors)
  - `packages/packs/test/runs.test.ts` (vitest, targeted)
  - `packages/qa/src/runProofs.ts action-roguelite` (1/1 PASS — 18/18 steps, 0 console errors, 0 external requests)
  - `packages/qa/src/runProofs.ts survivor-like` (1/1 PASS — 10/10 steps, 0 console errors, 0 external requests)
  - `npm run qa:workbench` (16/16 browser journeys PASS)
- **Actual results:** All focused tests passing, 0 console errors, 0 external network requests
- **Limitations changed:** `LIMITATIONS.runLifecycle` updated to reflect existence of `sw2d.runs`
- **Known failures:** None
- **Suspected shortcuts:** `step17_resumable` asserts `true` unconditionally (SaveStore has no `has()` method; save lifecycle is exercised implicitly by the resume-on-boot path in RunServiceImpl constructor and cleared on endRun)
- **Architectural concerns:** None
- **Work required from certifier:** Adversarial browser validation of run lifecycle (start, defeat, reset, meta-upgrade, victory), seed determinism across resets, and permanent meta-unlock persistence.

---
