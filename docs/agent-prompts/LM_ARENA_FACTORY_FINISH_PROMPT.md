# LM Arena Agent Mode — 2D Game Factory Finish Program

Use the prompt below verbatim in an LM Arena agent-mode session with repository access.

---

You are taking ownership of a major completion and improvement program for this repository:

`https://github.com/westkitty/2d_Game_Factory`

Your job is not to write a report about how the project could improve. Your job is to inspect the real repository, create a separate working branch, make the improvements, run the games, verify the results, commit the work in bounded checkpoints, push the branch, and leave the repository in a materially better, merge-ready state.

## PRIMARY OUTCOME

Transform the Stinky Weasel 2D Browser Game Factory from a technically strong reusable framework with many recipe-level presets into a convincing finished product that can reliably turn assets and preset choices into visibly different, recognizably genre-specific, playable browser games.

The finished result should feel like a game factory, not a metadata factory.

A successful session does all of the following:

- preserves the existing architecture that already works;
- materially improves the Workbench as a product;
- makes generated games easier to run, inspect, understand, and iterate;
- turns existing reusable capabilities into real behavior across more presets;
- closes high-leverage missing reusable mechanics where multiple presets genuinely need them;
- improves the quality, differentiation, readability, feedback, and game feel of generated starters;
- aggressively reduces the `recipe` maturity backlog through real proof rather than relabeling;
- leaves behind durable proof/health tooling so future work is cheaper;
- performs a final adversarial bug sweep;
- pushes all accepted work to a separate branch;
- does **not** merge to `main` unless the human explicitly authorizes that later.

Do not stop after an audit, a plan, a scaffold, one small repair, or one proof game. Continue through bounded implementation waves until the completion contract is satisfied or you hit a concrete external blocker that cannot be solved from the repository and available tools.

## BRANCH LAW — DO THIS BEFORE MUTATION

1. Fetch the repository and inspect `origin/main`.
2. Record the exact `origin/main` SHA before changing anything.
3. Confirm the working tree state.
4. Never commit directly to `main`.
5. Create and work on:

   `arena/factory-finish`

6. If that branch already exists, inspect it before touching it. Resume it only if it is clearly this same program and based on a sensible ancestor of current `origin/main`. Otherwise create a new non-destructive branch such as `arena/factory-finish-v2`. Never force-reset somebody else's work.
7. Push each accepted bounded checkpoint to the remote branch.
8. Keep `main` untouched.
9. At the end, open a PR to `main` if the environment supports it. Do not merge it.

## SOURCE AUTHORITY

Before substantive implementation, read the repository's actual governing state. At minimum inspect:

- `README.md`
- `MASTER_PROJECT.md`
- `OPERATIONAL_STATE.md`
- `WORKBENCH_OPERATIONAL_STATE.md`
- `PROJECT_BIBLE.md`
- `progress.md`
- `docs/AGENT_WORKFLOW.md`
- `docs/qa/QA_MATRIX.md`
- `docs/proofs/PROOF_MATRIX.md`
- `docs/presets/PRESET_CATALOG.md`
- `docs/architecture/CAPABILITY_PROGRAM_STATE.md`
- `docs/architecture/ARCHITECTURE_OVERVIEW.md`
- relevant ADRs
- `package.json`
- `packages/presets/src/**`
- `packages/contracts/**`
- `packages/runtime/**`
- `packages/packs/**`
- `packages/cli/src/templates/**`
- `packages/qa/**`
- `workbench/**`
- `proofs/**`
- `demos/**`
- starter-kit tooling and tests

Then inspect recent git history. Later commits override stale historical prose. Do not blindly trust old test counts or old limitations when current code says otherwise.

## ARCHITECTURE PRESERVATION LAW

The repository already contains a serious reusable architecture. Do not perform prestige rewrites.

Do not replace Phaser.
Do not replace the runtime.
Do not replace the Workbench wholesale.
Do not introduce a new state owner because you prefer another pattern.
Do not collapse the workspace/package boundaries.
Do not rewrite working controller families.
Do not turn all genre behavior into one universal engine.
Do not create a giant gameplay DSL.
Do not move game-specific behavior into shared runtime merely to reduce file count.
Do not add cloud/runtime dependencies to make authoring easier.
Do not make generated games require the network.

Preserve the central law:

`RUNTIME / SYSTEM CODE = reusable machine`

`CONTENT / THEME / GAME-SPECIFIC CODE = individual game`

Requirements determine architecture. Use the least complicated architecture proven sufficient.

## CURRENT STRATEGIC PREMISE

This project already has a large reusable core and a completed ten-capability program including spatial interaction, items/effects, weapons/projectiles, encounter orchestration, navigation/pathfinding, data-driven puzzle rules, deterministic generation, world graphs/transitions, advanced physics, and vehicle/racing systems.

The biggest remaining opportunity is no longer "invent more engine."

It is:

**convert latent reusable capability into visibly different, genuinely playable preset outputs, then add only the missing shared capabilities that are proven necessary.**

Treat that as the default strategy unless current repository inspection disproves it.

# COMPLETION CONTRACT

Create a durable ledger at:

`docs/architecture/ARENA_FACTORY_FINISH_STATE.md`

It must be sufficient for another agent with no chat history to continue safely.

Record:

- starting `origin/main` SHA;
- active branch;
- baseline validation results;
- actual current preset maturity counts;
- actual current proof coverage;
- all 74 presets;
- controller family;
- required/optional packs;
- known limitations;
- whether the missing behavior already exists elsewhere;
- whether the generated shell consumes it;
- required genre-defining proof journey;
- visual/readability problems found;
- implementation status;
- verification status;
- accepted commit SHA;
- remaining blocker, if any.

Update this ledger after every accepted wave.

The branch is not complete merely because tests pass. It is complete when the product is materially better and the evidence supports the claims.

# PHASE 0 — BASELINE REALITY

Before coding:

1. inspect the repository structure and git state;
2. identify current entry points, runtime/state ownership, asset pipeline, input, collision/physics, animation, audio, persistence, build commands, browser QA, Workbench routes, generator templates, and known-good player journeys;
3. run the appropriate baseline commands from the real current `package.json`;
4. record exact results, including failures;
5. inspect the Workbench in a real browser;
6. generate and play representative games from multiple families;
7. visually inspect what the factory actually produces today.

Do not call source inspection a test.
Do not call a build a gameplay proof.
Do not call a screenshot an interaction proof.

# PHASE 1 — GOLDEN PRESET ARCHAEOLOGY

Audit all 74 presets.

For every preset, classify the current gap as one of:

**A. ALREADY BETTER THAN ITS LABEL**
The generated game and existing proof evidence already justify stronger maturity, but the catalog was never reconciled.

**B. EXISTING-CAPABILITY INTEGRATION DEBT**
The reusable capability already exists, but the relevant shell/preset does not consume it.

**C. MISSING REUSABLE CAPABILITY**
Multiple materially different presets need behavior for which no coherent reusable capability exists.

**D. LEGITIMATELY GAME-SPECIFIC**
The behavior should stay in `src/game-specific/**` or content for that game rather than being promoted into the machine.

Do not promote maturity labels by arithmetic.
Do not assume that a proof folder with the same name automatically proves the current generated preset.
Do not assume that 23 proof games means 23 proof-validated presets.
Reconcile evidence one preset at a time.

For each preset, define the minimum player journey that would make a competent developer say, "Yes, this is recognizably this genre."

# PHASE 2 — DESTROY INTEGRATION DEBT BEFORE BUILDING CAPABILITY #11

This is the highest-leverage wave.

Find every place where an existing reusable system is already paid for but generated games fail to use it.

Investigate, verify, and repair examples such as:

- spatial/analog aim in top-down shooting where the spatial pointer already exists;
- weapon/projectile integration in pointer or vehicle shells;
- encounter integration in shmups, arena combat, run-and-gun, or other eligible presets;
- generated dungeon enemies wired into combat/AI/navigation rather than existing as inert content;
- spatial placement in strategy/tower-defense flows where interaction services already exist;
- item/effect integration for recipes that already expose pickup roles;
- world-graph, generation, navigation, race, physics, or puzzle capability gaps caused by shell wiring rather than missing architecture;
- any other mismatch discovered by the full 74-preset audit.

Prefer one correct shell-level or bridge-level integration that improves several presets over many per-preset hacks.

But do not broaden a shell if the mechanic is actually genre-specific.

Every integration must preserve lifecycle ownership and cleanup.

# PHASE 3 — MAKE PRESETS FEEL LIKE DIFFERENT GAMES

The factory must not produce seventy-four cosmetic variations of a generic shell.

Improve preset differentiation across:

- camera behavior;
- control interpretation;
- movement feel;
- enemy/obstacle behavior;
- goal state;
- failure state;
- scoring/progression loop;
- HUD hierarchy;
- feedback and hit response;
- spawn/challenge structure;
- pacing;
- scene composition;
- default content;
- audio cues where appropriate and offline-safe;
- starter tuning;
- meaningful use of the preset's required packs.

Do this by composing the existing reusable systems and bounded game-specific starter logic, not by cloning whole runtimes.

A generated Bullet Hell should not feel like a Top-Down Adventure with different metadata.
A Kart Racer should not feel like a generic moving rectangle.
A Visual Novel should not merely boot a generic play scene.
A Shopkeeper should not be called a shopkeeper because a resource counter exists.

The chosen preset must visibly matter.

# PHASE 4 — GOLDEN PLAYER PROOFS

Extend the existing proof architecture. Do not replace it.

For each candidate preset promotion, create or update a frozen proof contract describing the exact genre-defining player journey.

Examples of proof quality:

- Breakout: paddle control, ball collision, brick destruction, score/state change, miss/failure, reset.
- Stealth: actual perception, an avoid/break-detection path, visible difference between hidden and observed states.
- Survivor-like: movement/combat, escalating spawn pressure, run progression, progression changes effective play.
- Shopkeeper: stock/resource ownership, customer demand, transaction, economy change, repeatable loop.
- Visual Novel: rendered authored dialogue, explicit choice, branch, different resulting narrative state.
- Tower Defense: placement, route behavior, enemy pressure, tower targeting/damage, economy/progression, win/failure path.
- Racing: steering/handling, ordered checkpoints, lap or time-trial completion, shortcut rejection, restart.

These are examples, not a mandate to force every game into the same proof language.

Use real-browser automation and, when available in agent mode, direct visual/computer interaction.

Actually play the games.

Use screenshots/video/visual inspection for visual claims.
Use debug state for hidden state.
Use browser interaction for behavioral claims.
Use reload/reinstall for persistence claims.
Use network inspection for offline claims.
Use resource counters/restarts for lifecycle claims.

A technically green test with visibly broken gameplay is a failure.

# PHASE 5 — BUILD ONLY THE MISSING SHARED CAPABILITIES THAT EARN THEIR EXISTENCE

After integration debt is exhausted, cluster the remaining limitations.

A new shared capability is justified only when:

1. multiple materially different presets need it;
2. the behavior has a coherent reusable contract;
3. repeated game-specific implementations would cause real duplication/divergence;
4. the abstraction can remain renderer-neutral where appropriate;
5. at least two substantially different consumers can prove it.

Likely candidates must be verified against the live catalog before implementation. Possible clusters include:

- melee / knockback / hit-stun;
- stealth perception / sound / suspicion / hiding;
- climbing / wall slide / wall jump / ledge interaction;
- chase / pursuit pressure;
- ball / paddle / rebound mechanics;
- run-based meta-progression / death-reset semantics;
- customer / demand / queue / transaction simulation;
- creature needs / behavior / relationships;
- branching dialogue presentation and portrait/state rendering;
- rhythm / beat synchronization;
- local multiplayer input ownership/routing;
- rail-camera progression;
- capture-zone / territory-control rules;
- recipe/action-sequence production systems.

Do not blindly implement this list. Derive the real priority from the catalog and proof gaps.

For every accepted shared capability:

- define contracts first;
- define schemas/content authority where content-driven behavior is appropriate;
- keep the reusable core renderer-neutral where practical;
- use runtime bridges only for renderer/physics ownership;
- specify lifecycle/disposal;
- specify deterministic timing/RNG behavior;
- specify failure behavior;
- create at least two substantially different consumers;
- add focused unit/integration tests;
- add real browser proof;
- record a consequential architectural decision in an ADR;
- remove/narrow only the limitations that the implementation actually closes.

# PHASE 6 — WORKBENCH PRODUCT PASS

Treat the Workbench as the product, not an internal debug console.

Inspect it at desktop, compact desktop, tablet-like, and narrow/mobile widths.

Improve the end-to-end user journey:

**image/assets -> understand what can be made -> choose direction -> derive/validate sprites -> assign roles -> compose level -> run actual game -> inspect result -> iterate -> validate -> build -> pack**

The user should always be able to tell:

- what project is open;
- what preset it uses;
- what assets exist;
- what roles are still missing;
- what the factory inferred;
- what is generated vs source;
- what will appear in the game;
- how to run the game;
- whether the game is currently running;
- why validation failed;
- what remains before packing;
- what the preset can and cannot currently do.

Repair awkward or over-dense UX rather than simply adding more panels.

Prefer progressive disclosure.
Keep primary actions obvious.
Reduce duplicated status text.
Keep `Run Game` / playable preview easy to reach.
Do not hide the actual game behind an editor state.
Make errors actionable.
Do not turn the Workbench into a dashboard graveyard.

Visually inspect every major changed surface.

# PHASE 7 — PRESET PROOF LAB / RECIPE HEALTH

Add a bounded, useful Workbench surface that exposes the factory's real preset health.

It should be able to show, from repository-derived data rather than hand-maintained lies:

- preset name/family;
- current maturity;
- required capabilities;
- controller family;
- known limitations;
- existing proof coverage;
- most recent proof result where available;
- missing integration vs missing capability;
- launch/generate action;
- relevant validation action;
- evidence link/path.

Where practical, allow a developer to generate and run a selected preset's existing proof path from the Workbench.

Do not require an LLM or network service for this feature.
The factory must remain useful offline.

# PHASE 8 — ASSET AND SPRITE QUALITY

Preserve and improve the existing local-first provenance/validation architecture.

Inspect the current image-first flow, Asset Lab, Dex Sprite workflow, frame grouping, animation/presentation inference, derivative validation, local vault, rights freshness, and generated asset assignment.

Improve actual game-facing results where justified:

- sprite frame grouping;
- stable pivots;
- animation playback consistency;
- direction/state mapping;
- transparent-cell handling;
- visual bounds suggestions;
- scale/readability;
- role assignment;
- obvious fallback behavior;
- preservation of source provenance;
- rebuildable transform recipes.

Do not invent metadata that cannot be derived or verified.
Do not silently alter gameplay collision merely because visual bounds changed.
Do not allow acquired or generated resources to bypass the repository's existing provenance and pack gates.

# PHASE 9 — INPUT, ACCESSIBILITY, RESPONSIVENESS, AND DEVICE HONESTY

Resolve high-value open product unknowns where the environment permits.

Investigate:

- keyboard;
- pointer;
- touch;
- coarse pointer;
- fullscreen;
- focus/visibility loss;
- responsive layout;
- gamepad feasibility;
- rebinding behavior;
- accessibility projection;
- reduced motion;
- audio unlock/failure behavior.

If gamepad support can be added cleanly to the existing semantic-input model, implement and prove it rather than leaving it permanently theoretical.

If actual physical-device testing is impossible in this environment, do not fake it. Keep the claim explicitly unverified and provide the exact remaining test procedure.

# PHASE 10 — REAL PERFORMANCE, NOT PERFORMANCE THEATER

The repository historically distinguishes deterministic-frame evidence from wall-clock performance. Preserve that honesty.

Measure representative generated games in a real browser where possible.

Use representative stress cases rather than meaningless empty-scene FPS.

Look for:

- frame-time spikes;
- runaway object counts;
- projectile churn;
- pathfinding spikes;
- procedural-generation stalls;
- workbench preview leaks;
- repeated restart leaks;
- resize churn;
- asset decode/transform hot spots;
- unnecessary DOM churn;
- bundle bloat or accidental duplicate systems.

Optimize only measured problems.

Do not claim a performance win without before/after evidence.

# PHASE 11 — ADVERSARIAL BUG SWEEP

After feature work stabilizes, perform an exhaustive repository-wide sweep.

Attack the project from multiple angles:

1. type/schema mismatches;
2. lifecycle leaks;
3. restart/quit/reopen defects;
4. invalid asset/provenance states;
5. malformed content;
6. stale generated templates;
7. preset/catalog dishonesty;
8. proof/catalog drift;
9. inaccessible or unreachable Workbench controls;
10. responsive clipping/overflow;
11. broken keyboard/pointer/touch routing;
12. persistence corruption/versioning;
13. offline/network regressions;
14. pack/release manifest defects;
15. security boundaries in local host/import handling;
16. dead code and obsolete limitation text;
17. flaky browser assumptions;
18. screenshots that look wrong despite green state assertions;
19. missing error handling;
20. accidental modification of `main` or unrelated user work.

For every confirmed defect:

- reproduce it;
- identify root cause;
- add the smallest useful regression protection;
- repair the cause, not merely the symptom;
- rerun the affected journey.

Do not manufacture a bug count. Zero confirmed bugs is acceptable if the sweep was real.

# VALIDATION LAW

Use the actual current scripts from `package.json` rather than assuming old command names.

During development, run focused checks.

At every shared-architecture checkpoint, run the relevant broad ladder.

Before final handoff, run the full applicable repository ladder, including the current equivalents of:

- typecheck;
- unit tests;
- root validate;
- Workbench build/tests;
- real-browser Workbench QA;
- smoke QA;
- proof QA;
- responsive QA;
- generated-runtime matrix;
- starter-kit QA;
- release verification;
- offline guard;
- any new proof-lab or performance checks added by this program.

If a full suite is too expensive to run after every tiny edit, that is fine. It is not fine to skip it before declaring a major shared wave accepted.

Distinguish:

- source inspection;
- syntax/type/schema validation;
- unit tests;
- browser boot;
- interaction proof;
- visual proof;
- persistence proof;
- performance proof;
- packaging proof.

Never substitute one for another.

# ACCEPTANCE STANDARD FOR GENERATED GAMES

A generated game should, at minimum:

- visibly render;
- expose discoverable controls;
- have a genre-appropriate immediate objective;
- have at least one meaningful player action beyond moving a placeholder;
- produce visible feedback for that action;
- have a meaningful success/progression or survival loop appropriate to the preset;
- have a failure/reset/restart path where the genre calls for one;
- remain stable through restart;
- have no uncaught console errors;
- make no required external requests in the built game;
- remain responsive at supported viewport classes;
- honestly advertise unsupported features;
- be inspectable from the Workbench.

For presets that claim substantially richer mechanics, the proof contract must be stronger than this floor.

# GIT CHECKPOINT DISCIPLINE

Use bounded commits with descriptive messages.

Before every accepted commit:

1. inspect `git status`;
2. review the diff;
3. remove stray build artifacts and temporary files;
4. run the required validation for that wave;
5. update `ARENA_FACTORY_FINISH_STATE.md`;
6. stage only intended files;
7. inspect the staged diff;
8. commit;
9. push the branch;
10. record the accepted commit SHA in the ledger.

Never stack the next phase on a known-bad checkpoint.

If a candidate approach regresses protected behavior, restore the last accepted checkpoint and try a narrower design.

# DO NOT STOP EARLY

These are not acceptable stopping points:

- "I audited the repo."
- "I wrote a plan."
- "I added a document."
- "I implemented one capability."
- "Typecheck passes."
- "The page opens."
- "The test harness says green."
- "This is too broad for one pass."

This prompt intentionally authorizes a multi-wave autonomous implementation program.

Continue until either:

**A. the completion contract is satisfied and the branch is merge-ready**, or

**B. a concrete external blocker prevents further progress.**

A blocker must name exactly what is unavailable, what was attempted, what remains safe and complete, and the precise next action. "Large scope" is not a blocker.

# FINAL HANDOFF

At the end, provide a concise but evidence-rich handoff containing:

1. result: PASS / PARTIAL / FAIL;
2. branch name;
3. starting `origin/main` SHA;
4. final branch HEAD SHA;
5. summary of the major product improvements;
6. preset maturity counts before and after;
7. preset integrations completed;
8. reusable capabilities added, if any, with consumers;
9. Workbench UX/product improvements;
10. asset/sprite pipeline improvements;
11. actual browser/player journeys executed;
12. actual visual inspections performed;
13. performance measurements, if performed;
14. full validation results with exact counts;
15. bugs found and fixed during the final sweep;
16. remaining known limitations/unknowns;
17. list of commits created;
18. confirmation that `main` was not modified;
19. PR link if opened;
20. explicit recommendation: MERGE / DO NOT MERGE YET, with the reason.

Do not call the project COMPLETE if any completion-contract requirement is only inferred or unverified.

## THE STANDARD TO BEAT

The project already has an unusually strong technical skeleton. Your task is to make the product finally cash that check.

When someone selects a preset, the result should increasingly feel like:

**"make me this kind of game"**

instead of:

**"generate the generic shell nearest this genre label."**

When someone imports art, the factory should make it obvious how that art becomes a real game.

When the factory claims a genre works, the repository should contain a player journey that proves it.

When tests say green, the actual game should also look and behave right.

Preserve what is good. Remove what is merely ceremonial. Integrate what already exists. Build only what earns its abstraction. Play the games yourself. Inspect the pixels. Fix what you find. Push the branch. Leave evidence.
