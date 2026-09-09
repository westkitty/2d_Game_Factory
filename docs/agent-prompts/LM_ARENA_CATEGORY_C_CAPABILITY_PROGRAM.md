# LM Arena Agent Mode — Category-C Capability Completion Program

Repository: `https://github.com/westkitty/2d_Game_Factory`

Implementation branch: `arena/category-c-capability-program`

Base merge commit: `150cdb6698aa44bc14db03165c3dd3a49d6f08b2` (PR #6 merged into `main`)

## Mission

The previous Arena finish program successfully converted a large amount of existing reusable machinery into real generated-game behavior and reconciled the catalog to 23 proof-validated / 3 smoke-validated / 48 recipe presets.

This program is the next stage.

Your job is to attack the remaining **Category-C backlog**: mechanics the live catalog still honestly identifies as genuinely missing reusable capability. Build only the abstractions that earn their existence, prove them with materially different consumers, integrate them into generated games, improve the affected starter kits and Workbench surfaces, play the games, and promote presets only when the evidence actually justifies promotion.

Do not reopen or rewrite the architectural work that already passed. Do not relitigate Phaser, package boundaries, state ownership, the Workbench host, the asset/provenance pipeline, or the first-ten capability program without concrete evidence that a current requirement cannot be satisfied within them.

## Authority and starting state

Before mutation, read current `main` and this branch, then inspect at minimum:

- `OPERATIONAL_STATE.md`
- `docs/architecture/ARENA_FACTORY_FINISH_STATE.md`
- `docs/architecture/CAPABILITY_PROGRAM_STATE.md`
- `MASTER_PROJECT.md`
- `PROJECT_BIBLE.md`
- `README.md`
- `docs/AGENT_WORKFLOW.md`
- `docs/presets/PRESET_CATALOG.md`
- `docs/presets/PRESET_CAPABILITY_MATRIX.md`
- `docs/proofs/PROOF_MATRIX.md`
- `docs/qa/QA_MATRIX.md`
- `packages/presets/src/**`
- `packages/contracts/**`
- `packages/packs/**`
- `packages/runtime/**`
- `packages/cli/src/templates/**`
- `packages/qa/**`
- `workbench/**`
- `proofs/**`

Recompute the Category-C backlog from current code. The list below is a priority hypothesis, not permission to ignore the repository if it has changed.

## Branch law

Work only on `arena/category-c-capability-program` or a safe successor branch if the environment cannot use that exact ref. Never commit directly to `main`. Keep `main` mergeable and untouched until a human explicitly authorizes a later merge.

Record the exact starting `origin/main` and branch HEAD before work. Use bounded commits. Push accepted checkpoints. Never stack the next wave on a known-bad checkpoint.

## Core architecture law

Preserve:

`RUNTIME / SYSTEM CODE = reusable machine`

`CONTENT / THEME / GAME-SPECIFIC CODE = individual game`

A new reusable capability is allowed only when all of these are true:

1. At least two materially different presets need the same underlying behavior.
2. The behavior has a coherent reusable contract rather than a pile of genre-specific switches.
3. Reimplementing it separately would create real duplication or divergent semantics.
4. The contract can remain renderer-neutral where practical.
5. At least two distinct consumers can prove it.
6. Lifecycle, disposal, deterministic timing/RNG, content authority, failure behavior, and persistence implications are explicit.

If only one preset needs a behavior, prefer the existing game-specific seam unless there is stronger evidence for reuse.

Do not build a universal gameplay DSL.
Do not create one mega-pack for unrelated mechanics.
Do not invent abstractions merely to reduce file count.

## Category-C priority hypothesis

The previous program identified these genuine reusable gaps or closely related clusters. Re-audit before implementation.

### Tier 1 — multiplicative capability clusters

These should be investigated first because each can unlock several substantially different presets.

**A. Customer / demand / transaction / production economy**
Likely consumers: Shopkeeper, Tycoon, Restaurant Management, possibly bounded parts of other management starters.

The reusable machine should cover only common semantics such as inventory/stock, demand requests, queue/service state, transaction settlement, production jobs, and bounded economy state. Theme-specific goods, recipes, layouts, pricing balance, and presentation remain content/game-specific.

**B. Creature needs / behavior / relationship simulation**
Likely consumers: Virtual Pet, Aquarium, Pet Sim, and selected Colony behavior if the contract genuinely fits.

Avoid pretending a full colony simulator and a pet are the same system. Reuse only bounded primitives that truly overlap: needs, decay/recovery, simple behavior selection, relationship/affinity state, and deterministic simulation time.

**C. Branching dialogue / narrative presentation**
Likely consumers: Visual Novel, Point-and-Click, Museum/Exploration presentation, Investigation where appropriate.

Separate content/state authority from rendering. A reusable dialogue graph/state service and a reusable presentation bridge may be justified; character portraits, scene composition, prose, and game-specific deduction logic are not automatically reusable.

**D. Stealth perception / suspicion / noise / hiding**
Likely consumers: Stealth Game and Heist.

This should be a real gameplay capability, not a boolean `seen` flag: bounded field-of-view or awareness geometry, occlusion rules appropriate to the current 2D architecture, suspicion/alert state, noise events, hiding/visibility modifiers, and clear debug/proof state.

### Tier 2 — strong two-consumer primitives

**E. Ball / paddle / rebound rules**
Likely consumers: Breakout and Pong.

Do not conflate this with general advanced physics. The useful abstraction is deterministic arcade ball/paddle semantics: serve/reset, rebound control, scoring/failure boundaries, speed clamps, and collision ownership.

**F. Melee / knockback / hit-stun**
Likely consumers: Action Adventure, Arena Combat, Run-and-Gun or other eligible action presets.

Compose with the existing combat-health system; do not fork combat into a second authority.

**G. Local multiplayer input ownership/routing**
Likely consumers: Local Party and Pong, possibly additional couch-play starters.

Build on semantic input. Explicitly model player slots, device/control ownership, join/leave where appropriate, focus/disconnect behavior, and deterministic routing. Do not claim physical gamepad proof without a real device or supported test path.

### Tier 3 — narrower but still potentially reusable

Re-audit each before sharing it:

- rail camera / fixed-path progression;
- territory capture / ownership / scoring;
- chase / pursuit pressure;
- climbing / wall-slide / wall-jump / ledge interaction;
- run-based meta-progression / death-reset semantics;
- falling-block engine;
- match-puzzle interaction integration if the existing match engine still is not consumed;
- crop-growth / season / plot state if more than one preset can actually consume it.

### Tier 4 — likely specialized; prove reuse before abstracting

These may belong in game-specific starter seams unless the audit finds a second real consumer:

- rhythm / beat synchronization;
- parser interactive fiction;
- fishing casting / line / tension / fish behavior;
- cooking ingredient / recipe / action-sequence flow;
- photography framing / capture / scoring;
- wardrobe attachment;
- drawing stroke capture;
- microgame scheduler / rotation/meta;
- generalized sandbox authoring.

Do not turn every remaining limitation into a shared package just to make the count go down.

## Wave contract for every new capability

For each accepted capability:

1. Define the problem and the exact presets it unlocks.
2. Inspect current nearby systems and prove the gap is real.
3. Write a short ValidationPlan and CompletionContract in the durable ledger before implementation.
4. Define contracts first.
5. Define schema/content authority where appropriate.
6. Implement the reusable core in the narrowest correct layer.
7. Add runtime bridge code only where rendering/physics/lifecycle ownership requires it.
8. Add at least two materially different consumers.
9. Update generated shells or starter kits only where the capability should actually appear by default.
10. Add focused unit/integration tests.
11. Add or extend real-browser proof journeys.
12. Generate fresh games from the affected presets and actually play them.
13. Inspect visual readability and game feel, not only debug state.
14. Re-run restart/disposal/offline/responsive checks relevant to the wave.
15. Update known limitations narrowly.
16. Promote preset maturity only when its own proof contract passes.
17. Record an ADR for consequential architecture.
18. Update the durable ledger.
19. Commit and push the accepted checkpoint.

## Durable state

Create and maintain:

`docs/architecture/CATEGORY_C_CAPABILITY_PROGRAM_STATE.md`

It must include:

- starting main SHA;
- branch;
- baseline test/browser results;
- current 74-preset maturity counts;
- exact Category-C gap inventory;
- priority ranking and rationale;
- each capability's consumers;
- ValidationPlan;
- CompletionContract;
- implementation status;
- proof status;
- browser journeys actually executed;
- visual inspection notes;
- accepted commit SHA;
- remaining blockers/unknowns.

Another fresh agent should be able to continue from this file without chat history.

## Proof standard

A capability is not complete because its service has unit tests.

For each consumer preset, freeze a player journey that proves the genre-facing behavior.

Examples:

- Shopkeeper: stock exists -> customer requests -> service/transaction happens -> inventory and money change -> next customer cycle remains stable -> reload/restart behavior is correct.
- Virtual Pet: a need changes over simulation time -> player action changes it -> behavior visibly responds -> relationship/affinity changes where applicable -> save/reload semantics match the contract.
- Visual Novel: authored dialogue renders -> choice is selectable -> branch changes -> resulting narrative state differs -> restart/reload follows the documented rule.
- Stealth Game: patrol perception exists -> player can be detected -> suspicion/alert changes visibly -> player can avoid or break detection -> occlusion/hiding/noise semantics are proven.
- Breakout: serve -> paddle control -> rebound -> brick destruction -> scoring -> miss/life/failure -> reset.
- Pong: two independently routed player inputs -> serve -> paddle contacts -> scoring boundary -> next serve/reset.
- Melee consumer: attack window -> hit detection -> health change -> knockback/hit-stun -> invulnerability/cooldown semantics -> death/reset.

Use visual/browser interaction for visible behavior, debug state for hidden state, reload for persistence, and real object/lifecycle checks for disposal. Do not call a screenshot interaction proof.

## Workbench requirements

Every new reusable capability should become inspectable without turning the Workbench into a wall of panels.

Prefer contextual inspectors and the existing preset evidence surface. Show:

- whether the capability is installed;
- content/config authority;
- bounded live state useful for debugging;
- validation errors;
- proof/evidence location.

Do not make the Workbench require an LLM or network service.

## Generated-game quality floor

For every preset materially changed by this program, generate a fresh game and verify:

- genre-appropriate controls are discoverable;
- the defining mechanic is visible within the first short play session;
- the objective is understandable;
- feedback exists for meaningful actions;
- success/progression/failure semantics fit the genre;
- restart is stable;
- no uncaught console errors;
- no required external requests;
- responsive layout remains usable;
- unsupported features remain honestly stated.

The factory should increasingly produce games that are meaningfully different in mechanics, pacing, HUD, camera, goals, and feedback — not just different preset labels.

## Validation ladder

Use the CURRENT `package.json` scripts. Do not hard-code historical counts as expected values.

During a wave, run focused tests.

Before accepting a shared capability, run the relevant broad suites.

Before final handoff, run the full applicable ladder, including current equivalents of:

- typecheck;
- unit tests;
- validate;
- Workbench build/tests;
- qa:workbench;
- qa:smoke;
- qa:proof;
- qa:matrix;
- qa:responsive;
- qa:starter-kits;
- release:verify;
- check:offline;
- any new capability-specific proof suites.

Keep evidence labels honest. If the environment lacks physical-device proof, say so.

## Adversarial mode

At the end of every major capability cluster, stop building and attack it:

- restart repeatedly;
- hold/spam controls;
- switch focus/visibility;
- try empty/malformed content;
- test zero/large delta paths where simulation contracts permit;
- force boundary states;
- inspect object counts and listeners after restart;
- resize while active;
- test persistence version/failure paths where relevant;
- ensure one consumer's tuning/content cannot corrupt another;
- inspect the actual game visually.

Repair confirmed root causes and add regression protection.

## Stop conditions

Do not stop after an audit, architecture document, skeleton service, one consumer, typecheck, browser boot, or a single happy-path test.

Continue in bounded waves until either:

A. the chosen Category-C wave has a real reusable implementation, at least two distinct consumers, real browser/player proof, honest catalog integration, full relevant validation, and a pushed accepted checkpoint;

or

B. a concrete external blocker prevents further safe progress.

After an accepted wave, continue to the next highest-leverage Category-C cluster if time/tools permit. Do not expand scope into unrelated architecture rewrites.

## Final handoff

Report:

1. PASS / PARTIAL / FAIL;
2. branch and final HEAD;
3. starting main SHA;
4. capability clusters completed;
5. exact consumers for each;
6. presets promoted and why;
7. maturity counts before/after;
8. real browser journeys played;
9. visual inspections performed;
10. bugs found/fixed;
11. exact validation results;
12. remaining Category-C backlog;
13. remaining device/performance unknowns;
14. commits created;
15. confirmation main was not modified;
16. PR link if opened;
17. MERGE / DO NOT MERGE YET verdict.

The goal is not to make the architecture larger. The goal is to make the remaining recipe presets become real games, one earned reusable capability at a time.
