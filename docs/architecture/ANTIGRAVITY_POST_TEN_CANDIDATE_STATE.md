# Anti-Gravity Post-Ten Candidate Program

First-ten base SHA: `acf802f7a32a3f341273c084931af37cb5461784`
Candidate branch: `candidate/antigravity-post-ten-program`
Candidate HEAD: `5215687`
Current candidate phase: Phase 12 (PASS)

---

## Phase 11 — AI Perception, Awareness & Pursuit

- **Phase:** 11
- **Capability:** `ai.perception`, `ai.pursuit`
- **Status:** PASS
- **Starting SHA:** `acf802f7a32a3f341273c084931af37cb5461784`
- **Candidate commit:** `88fe47e`
- **Contracts:** `packages/contracts/src/perception.ts`, exported from `packages/contracts/src/index.ts`
- **Schemas:** `packages/schemas/schemas/perception-catalog.schema.json`, registered as `perception-catalog` under document name `perception` in `packages/schemas/src/validator.ts` and `packages/schemas/src/contentDocuments.ts`
- **Packs:** `sw2d.ai-perception` (`packages/packs/src/aiPerception/aiPerceptionPack.ts`), providing `ai.perception` and `ai.pursuit`
- **Runtime bridges:** `packages/runtime/src/game-support/perceptionRuntime.ts`, exported from `packages/runtime/src/index.ts`
- **Generator/template changes:** none required
- **Workbench changes:** none required
- **Presets changed:** `stealth-game`, `heist-game` in `packages/presets/src/catalog/topDownAction.ts`, `chase-platformer` in `packages/presets/src/catalog/platforming.ts`
- **Proof consumers:** `proofs/stealth-game/` (new, full defining journey tested by `packages/qa/proof-specs/stealthGame.ts`), `proofs/chase-platformer/` (regression checked, 1/1 PASS)
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
  - `packages/qa/src/runAll.ts` (14/14 smoke demos PASS)
- **Actual results:** All tests passing, 0 console errors, 0 external network requests
- **Limitations changed:** `LIMITATIONS.stealthAi` and `LIMITATIONS.chasePressure` narrowed to reflect existence of `sw2d.ai-perception`
- **Known failures:** None
- **Suspected shortcuts:** None
- **Architectural concerns:** None
- **Work required from certifier:** Adversarial browser validation of stealth and chase journeys.

---

## Phase 12 — Platformer Climbing, Wall-Slide, Wall-Jump & Ledge-Hang

- **Phase:** 12
- **Capability:** `movement.climbing`
- **Status:** PASS
- **Starting SHA:** `88fe47e`
- **Candidate commit:** `5215687`
- **Contracts:** `packages/contracts/src/climbing.ts`, exported from `packages/contracts/src/index.ts`
- **Schemas:** `packages/schemas/schemas/climbing-config.schema.json`, registered as `climbing-config` under document name `climbing` in `packages/schemas/src/validator.ts` and `packages/schemas/src/contentDocuments.ts`
- **Packs:** `sw2d.climbing` (`packages/packs/src/climbing/climbingPack.ts`), providing `movement.climbing`
- **Runtime bridges:** `packages/runtime/src/game-support/climbingRuntime.ts`, exported from `packages/runtime/src/index.ts`
- **Generator/template changes:** none required
- **Workbench changes:** none required
- **Presets changed:** `precision-platformer`, `climbing-game` in `packages/presets/src/catalog/platforming.ts`
- **Proof consumers:** `proofs/precision-platformer/` (new, full defining journey tested by `packages/qa/proof-specs/precisionPlatformer.ts`)
- **Tests added:**
  - `packages/contracts/test/climbing.test.ts` (7 tests)
  - `packages/schemas/test/validator.test.ts` (climbing-config test)
  - `packages/packs/test/climbing.test.ts` (7 tests)
  - `packages/runtime/test/climbingRuntime.test.ts` (2 tests)
  - `proofs/precision-platformer/tests/content.test.ts` (5 tests)
- **Tests run:**
  - `npm run typecheck` (PASS)
  - vitest test suite for Phase 12 (71 targeted tests PASS)
  - `packages/presets/test/` (605 tests PASS)
  - `packages/qa/src/runProofs.ts precision-platformer` (1/1 PASS)
  - `packages/qa/src/runAll.ts` (14/14 smoke demos PASS)
- **Actual results:** All tests passing, 0 console errors, 0 external network requests
- **Limitations changed:** `LIMITATIONS.climbingMechanics` updated to reflect existence of `sw2d.climbing`
- **Known failures:** None
- **Suspected shortcuts:** None
- **Architectural concerns:** None
- **Work required from certifier:** Adversarial browser validation of climbing, wall jump reflection, and ledge hanging.

---

