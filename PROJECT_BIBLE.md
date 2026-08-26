# Project Bible

Append-only handoff ledger. Decisions, reasons, rejected paths, and lessons that cost something
to learn. Not a terminal transcript, and not a duplicate of `MASTER_PROJECT.md`.

Detail for each architectural decision lives in `docs/architecture/adr/`. This file records the
*why it mattered*.

---

## Phase 11 - Release, Hardening, Documentation, and Cold-Start Preparation (2026-08-26, Sonnet 5)

**Status: COMPLETE.** Full report:
[`docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md`](docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md).

Not a feature-expansion phase. Two lessons cost real time to find; both are recorded here because
neither would have been caught by reading code alone - only by actually running the thing.

### The lesson that cost the most to learn: a directory named after a `.gitignore` pattern silently never gets committed

New release-packaging source code was written at `packages/cli/src/release/{checksums,
notices, releaseManifest}.ts` - a natural, readable name. `git status` and `git add -A` reported
nothing wrong. `npm run typecheck` passed locally, every time, for the entire duration these files
existed under that name. The bug was invisible from inside the working tree, because everything
that mattered for local development (the files existed on disk, TypeScript's module resolution
found them via relative paths, tests imported and passed) worked correctly - the files simply were
never going to be part of the commit that shipped them, because `.gitignore` line 3 was a bare
`release/`, which matches a directory of that name **at any depth**, not only at the repository
root. It was written to keep a future *generated release output* directory out of git - but a
gitignore pattern has no idea what's meant to live under a matching path; it silently swallows
source code exactly as readily as build output.

This was caught, not guessed at, by Phase 11's own §16 clean-build reproducibility proof: an
isolated `git checkout-index --all` snapshot's `npm run typecheck` failed with "Cannot find
module" errors the primary worktree never showed, because the snapshot only contained what git
actually tracked. The same audit also caught that the same pattern would have swallowed
`release/README.md` (a new, required, must-be-committed documentation file this phase also
needed) the moment it was created. Both fixed: the source directory was renamed to
`packages/cli/src/releasePackaging/`, and `.gitignore`'s `release/` was narrowed to `release/out/`
- the actual generated-output path the original author almost certainly meant, matching
`MASTER_PROJECT.md` §22's own naming.

**Lesson: `git status` in the working tree proves a file exists on disk, never that it will
actually be committed.** A gitignore pattern with no leading slash matches a basename anywhere in
the tree - checking `git check-ignore -v <path>` (or, as this phase's own instructions already
required, an isolated index-derived snapshot build) is the only way to catch this class of bug
before it ships a broken commit. Section 16's clean-build proof is not optional bureaucracy; this
is exactly the failure it exists to catch, and it caught a real one on its very first run.

### A close second: a scale manager that measures its container before the container's layout has settled

`npm run qa:responsive` (new this phase, 19 real-browser surfaces × 2 viewport contexts) failed
19/19 on its first run - not a checker bug, a real one: every surface's touch controls were
clipped off-screen in the 844×390 landscape context. Two compounding root causes, both found by
direct DOM/computed-style inspection in a real headless Chrome instance, not guessed at from
reading CSS:

1. `#app { min-height: 100% }` never gives a flex column a **definite** height - `min-height`
   constrains an `auto`-sized box from below, it does not itself count as a definite height for
   percentage resolution. Every percentage-based sizing rule further down the tree (a canvas's
   `max-height: 100%`, or a flex child's own flex-basis distribution) was therefore silently
   inert.
2. Independently, `Phaser.Scale.FIT` measures its `parent` element's box **synchronously inside
   `new Phaser.Game(...)`** - before the browser has finished laying out the canvas it just
   inserted alongside its `#touch-controls` sibling. On a fresh page load with no subsequent
   resize event (the ordinary case for a real player), the very first size Phaser ever computes
   can be wrong, and nothing corrects it afterward. This was confirmed empirically: dispatching a
   synthetic `resize` event after the fact made Phaser re-measure and land on the *correct* box
   every time - the container layout was always right; only the *timing* of Phaser's own
   measurement was wrong.

Fixed with two small, targeted changes rather than reworking the layout: `#app { height: 100% }`
(a real, non-`min` definite height - propagated identically to all 18 committed `styles.css`
copies plus the CLI template, confirmed byte-identical afterward), and one
`requestAnimationFrame(() => game.scale.refresh())` immediately after game construction in
`packages/runtime/src/core/createGame.ts`, forcing exactly one re-measurement once the browser's
next paint guarantees layout is settled.

**Lesson: a shared layout primitive (`min-height: 100%` used for "at least fill the viewport, grow
if needed") and a third-party library's own internal sizing assumption (`Phaser.Scale.FIT` expects
its parent's size to already be final at construction time) can each be individually defensible
and still compound into a real, every-surface defect neither one would produce alone.** Finding
it required literally measuring `getBoundingClientRect()` in a real browser at the exact viewport
size that broke, not reasoning about the CSS in the abstract - the same reason this phase's
`qa:responsive` suite exists as a real, running check rather than a design-review checklist.

### What this phase did not do

No new genre mechanics, no spatial pointer, no gamepad, no new controller family, no chosen
software license. The full non-goals list is `MASTER_PROJECT.md`'s Phase 11 section - none of it
was reopened.

---

## Phase 10 - Five Deep Proof Games (2026-08-26, Sonnet 5)

**Status: COMPLETE.** Full report:
[`docs/architecture/PHASE10_PROOF_HANDOFF.md`](docs/architecture/PHASE10_PROOF_HANDOFF.md);
per-proof detail: [`docs/proofs/PROOF_MATRIX.md`](docs/proofs/PROOF_MATRIX.md).

### The lesson that cost the most to learn: a fixed-step clock that reseeds from real time is not fixed-step

Phase 9 fixed the QA harness's headline bug - Phaser's own `requestAnimationFrame` driver kept
running underneath manual `stepFrames()` calls - by calling `phaser.loop.stop()` once on attach.
That was necessary but, it turned out, not sufficient. `stepFrames(count)` itself still computed
`let t = performance.now()` fresh **inside every call**, then advanced `t` by `16.67ms * count`
before handing it to `loop.step(t)`. For the common case - one `stepFrames(30)`-style call per
interaction, exactly what every Phase 8 smoke spec does - this is invisible: the absolute epoch
`t` starts from never matters, only the increments within that one call, and those were correct.

Proof A's automated journey needed a different technique: polling the harness one frame at a time
(`stepFrames(1)` in a loop, checking state after each) to catch the exact frame a coyote-time
window opened or a jump-buffer press needed to land. That technique is legitimate - it is how a
careful QA engineer handles tight timing without hand-computing physics trajectories offline - and
it is what exposed the bug. Two `stepFrames(1)` calls close together in real wall-clock time (a
Playwright round-trip is a few milliseconds, not sixteen) each reseeded `t` from a `performance.now()`
that had barely moved, so the delta `loop.step()` actually computed was close to that small real
gap, not the intended fixed 16.67ms. Twenty consecutive `stepFrames(1)` calls advanced the game by
barely one real frame's worth of simulated time instead of twenty.

**Lesson: "deterministic frame stepping" is a property of a whole spec's timeline, not of one call
in isolation.** A fix that makes a single call correct can still leave the *composition* of calls
wrong, and the gap only shows up once someone calls the primitive in a shape its first fix was
never tested against. The repair - move the virtual clock onto `window`, seed it once from real
time on first use, then only ever advance it by frame count thereafter - removes real-clock
coupling entirely rather than reintroducing it, which is what makes it a strengthening of Phase 9's
"no additive real-time" lock rather than a second patch on top of it. Every existing smoke spec was
provably unaffected (each calls `stepFrames` once per interaction with one large count, never
several small calls in a row), confirmed by rerunning `qa:smoke` (14/14) and the generated-runtime
matrix (40/40) after the fix.

### The second lesson: jumping onto a platform from directly underneath it cannot work

Proof A's ledge-landing sequence failed twice before it worked, for a reason that had nothing to do
with the code and everything to do with basic platformer geometry: a jump launched from directly
below a platform's footprint rises into that platform's *underside* before it can ever reach its
*top* surface, regardless of how low the platform is or how much jump velocity is available. The
fix was not a code change but a choreography change - launch the jump from outside the platform's
horizontal span, moving toward it, so the rising arc clears the platform's edge before the
descending arc lands on top of it - verified empirically against the real harness rather than
trusted from projectile-motion arithmetic alone, because an earlier arithmetic-only pass had
already gotten the vertical clearance wrong once (the platform's underside overlapped the player's
own standing head-height, so simply walking underneath it collided before any jump was involved).

### Decisions

**Sokoban's proof uses the real `sw2d.puzzle` pack; it does not repeat the Phase 8 demo's gap.**
`docs/demos/DEMO_MATRIX.md` already recorded that `demos/sokoban/` smoke-validated the *mechanic*
by reimplementing push/undo/reset in `shellPack.ts`, parallel to the pack, never installing it for
real - a gap `tools/scripts/generated-runtime-matrix.ts` covered instead, from the generated-composition
side. This proof closes that gap directly: `PuzzleService` (installed via `packConfig.ts`'s
`configSource: 'code'` seam, ADR-0017) is the proof's only board state.

**Twin-stick-shooter's enemies are content, not a hard-coded array.** They're `Enemy`-classed
Tiled objects (the existing closed 19-class catalog already has this class, requiring only
`enemyType: string`) with `wave`/`enemyId`/`health` as ordinary passthrough custom properties the
catalog already permits alongside a class's declared ones - no catalog change, no schema change,
and retuning wave composition is now a content edit.

**Tower-defense's upgrade reuses the grid cursor rather than adding new input surface.**
`SECONDARY_ACTION` while parked on the tower's own cell triggers the upgrade - the same "read an
action directly off `context.input` outside the controller's own intent shape" pattern the pause
menu (`PauseScene`) already established, not a new mechanism.

**None of Phase 9's deferred triggers fired.** Spatial pointer, a universal puzzle DSL, a shared
grid-cursor abstraction (still two consumers, not three - sokoban has none), and content-role
schemas beyond `tuning`/`levels` all stayed exactly as deferred as Phase 9 left them. No proof
needed any of them enough to justify building them.

---

## Phase 9 - Architecture Integration Gate B (2026-08-26, Opus 5)

**Verdict: PASS WITH TARGETED REPAIRS.** Full report:
[`docs/architecture/PHASE9_ARCHITECTURE_GATE_B.md`](docs/architecture/PHASE9_ARCHITECTURE_GATE_B.md).

### The lesson that cost the most to learn: building is not installing

Phase 8 proved all 74 presets three ways - no unresolved tokens, schema-valid content, thirteen
real `tsc` + `vite build` runs - and concluded "74 runnable starters." Every one of those checks
was real. None of them ever executed `SystemHostImpl.install()`, because installation happens when
a *run starts*, not when a bundle is produced. Six presets therefore shipped as starters that
compiled perfectly, booted to a title screen, and died on the first CONFIRM with
`TypeError: createInitialState is not a function`. Install rollback then removed the shell pack
too, so those six had no gameplay whatsoever - not a missing puzzle service, an empty game.

The general lesson, worth more than the specific bug: **a verification ladder proves exactly the
code paths it executes, and no others.** "It builds for all 74" and "it runs for all 74" are
different claims, and the gap between them is precisely where a composition system hides its
falsehoods. Phase 8 even caught one instance of this itself (the `main.ts` "unknown pack"
regression, handoff §2.1) and correctly diagnosed it as "metadata that declares a contract nothing
evaluates" - but then fixed that one instance rather than the class, and the class bit again two
sections later in the same document.

The durable fix is the new
[`tools/scripts/generated-runtime-matrix.ts`](tools/scripts/generated-runtime-matrix.ts): it
derives runtime signatures **from the catalog rather than a hand-maintained list** - the pair
`(primary controller shell, exact required pack set)`, 37 distinct values across 74 presets - and
really plays one generated game per signature. A new preset with a new pack combination grows the
matrix by itself. 34/40 at the reviewed baseline; 40/40 after repair.

### The second lesson: a harness that does not own the clock is not deterministic

`@sw2d/qa`'s central claim was fixed-step, deterministic frame advancement. It never stopped
Phaser's `requestAnimationFrame` driver, so `stepFrames()` was *additive* to a live real-time loop.
Measured: **~60 frames per second of drift with zero `stepFrames()` calls.** Every smoke spec had
been nondeterministic since it was written; they mostly passed because most had wide margins.

`top-down-racer` had the narrowest margin - equal-and-opposite steering taps - and was already
failing roughly one run in three at the Phase 8 baseline, so `npm run qa:smoke` was 13/14, not the
14/14 recorded. Its `smoke-validated` maturity was not evidence-backed on the day of this review.

Phase 8 had already met this bug once and misread it: `stealth-game`'s flake was attributed to a
"hairline margin against the deterministic-but-precise frame math" and fixed by widening a budget
from 300 to 500 frames. The frame math was not precise; there was no determinism to be precise
against. Widening the budget hid the symptom and left the cause running.

**Lesson: when a test is flaky, distrust the harness before distrusting the margin.** A margin fix
that works is indistinguishable from a margin fix that merely lowers the failure rate. The fix -
`phaser.loop.stop()` on attach, leaving `step()` callable - took one line and turned six
consecutive `top-down-racer` runs byte-identical, including final position.

### Decisions

**`ProjectilePool` promoted - but as game support, not a capability.** Phase 8 left this open with
three consumers. Inspection settled it: the three copies are **byte-identical**, differing only in
constructor arguments. Three independent consumers converging on the same interface with zero
divergence is the strongest evidence available that an interface is finished, and Phase 10 adds
consumers four and five. Deferring again meant five copies of a settled interface.

It went to `packages/runtime/src/game-support/`, not `@sw2d/packs`, for a hard reason: it
manipulates Phaser sprites and Arcade bodies, and every `@sw2d/packs` core is renderer-independent
by contract. It has no capability id, no config schema, no install order. The parts a real
`sw2d.projectiles` capability would have to decide - pooling policy, collision integration, whether
damage-on-hit is first-class - are still undiscovered, and were deliberately left undiscovered.
**Promote the proven interface; do not promote the unproven semantics with it.**

**The puzzle-config gap was fixed with a declaration, not a DSL (ADR-0017).** The tempting fix was
a JSON puzzle format the pack interprets. That is a universal puzzle DSL by another name, and
sokoban, match-3 and falling-block puzzles do not share a rule format - any schema covering all
three would either be an interpreter or validate nothing. The tempting *cheap* fix was to document
the limitation at pack level, which is what Phase 8 did, and which leaves six broken starters while
moving a falsehood between documents.

What worked instead: make the JSON-vs-code distinction a field the system **routes on**
(`configSource: 'json' | 'code'`), give code-configured packs a real composition-root path
(`createGame({ packConfig })`), and have the generator emit a working, editable default into
`src/game-specific/packConfig.ts` - normal game work, in the directory where every other
game-specific mechanic already lives. The pack keeps its opaque `TState`; the generator stops
serializing something that can never work; a missing code config now fails by name at install
instead of as a `TypeError` several frames downstream.

**Grid cursor stays unextracted, because there are two consumers, not three.** The handoff counted
`sokoban`, `tower-defense` and `turn-based-tactics`. `sokoban` has no cursor at all -
`gridController` moves the *player*, and CONFIRM/CANCEL mean reset/undo. Counting consumers by
which module they import rather than by what they actually do inflated the trigger. The two real
cursors are a four-line switch plus a clamp, where CONFIRM means structurally different things.

**Platform movement stays duplicated, and that is correct.** Six lines, shared by two demos, and
diverging in the third exactly where metroidvania's progression begins. An abstraction there would
either absorb progression into movement or rename `platformController.read()`.

### Rejected

- **A JSON-serializable declarative puzzle format.** See ADR-0017's rejected section.
- **Removing code-configured packs from generated `systemPacks`.** Removes the crash and the
  capability, permanently stranding six presets in sokoban's hand-rolled workaround.
- **A general `packConfig` override for any pack.** Would let a generated game quietly move
  JSON-configurable tuning out of `content/**`, breaking the content-authoring boundary the whole
  factory rests on. `SystemHostImpl` consults `packConfig` only for packs declaring
  `configSource: 'code'`.
- **Building spatial pointer.** No Phase 10 proof requires it; tower placement uses the existing
  keyboard grid cursor, which now runs deterministically. It needs its own ADR on input ownership
  when it comes, because hover has no press to claim and so does not fit `ActionInput` the way
  ADR-0016's aim extension did.
- **Deleting `materializeStarterPlan`.** It has no production consumer - the generator reads
  `PresetDefinition` directly, so its docstring's claim that the CLI would consume it is false -
  but removing public API is not a gate's job. Recorded with a trigger instead.
- **Adding content schemas for `dialogue`/`recipes`/`characters`/etc.** Seven of the nine
  `requiredContentRoles` claimed across the catalog have no schema, no generated document and no
  pipeline. Designing them is real pipeline work, not a gate repair. Recorded with a trigger so a
  Phase 10 proof cannot quietly invent a private format instead.

### One more thing worth remembering

`content/tuning.json` was generated for all 74 presets, schema-validated by every generated game's
own test, and named in every generated README as "tuning values" - and read by absolutely nothing.
The numbers lived as literals in the shell templates. It passed every check the repository had,
because every check asked whether the document was *valid*, and none asked whether anything
*consumed* it. **Validation is not consumption.** That is the same shape as the two headline
findings, in a third place, and it is the shape to keep looking for.

---

## Phase 8 - Factory CLI, Generated Starters, Browser QA, and 12 Representative Demos (2026-08-26, Sonnet 5)

One new ADR ([0016](docs/architecture/adr/0016-aim-as-a-digital-axis-not-spatial-pointer.md)).
Full architectural handoff in
[`docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md`](docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md) -
this entry records the *why*, that file records the *what*.

### Decisions

**Generation is pure and deterministic, writing is not.** `buildGameFiles()` returns an in-memory
`Map<string, string>`; `writeGameFiles()` is the only function that touches disk. This split (not
an obvious one to skip - it would have been simpler to write files directly) is what made the
"byte-identical trees across all 74 presets" determinism proof possible to write at all: a pure
function is trivially comparable across repeated calls, a function with file-system side effects
is not.

**`ProjectilePool` stays copied, not shared, even with three real consumers.** The Phase 8
directive's own three-consumer trigger fired exactly (`twin-stick-shooter`, `bullet-hell`,
`tower-defense`), and promoting it to `@sw2d/packs` was seriously considered. Decided against
*this phase* specifically because the three consumers' actual usage (construction arguments only -
`textureKey`/`displaySize`/`lifetimeMs`) hasn't yet revealed whether a real capability needs a
richer interface (pooling strategy, first-class damage-on-hit, collision integration) or the
current shape is already sufficient - promoting ahead of that answer risks the exact "metadata
that declares a contract nothing evaluates" failure Phase 5's gate found and fixed once already.
Left as an explicit open question for Opus in the handoff doc rather than decided unilaterally,
since it is a pack-architecture call, not a generated-game-architecture one.

**Aim became a second digital axis, not a spatial pointer service.** See ADR-0016. The deciding
factor: `twin-stick-shooter`'s smoke contract needed genuinely independent aim, and
`topDownController`'s existing `moveX`/`moveY` pattern (two digital axes, clamped magnitude) was
structurally sufficient - a spatial pointer service would have been new input-ownership surface
built for a need that didn't require it.

**`sokoban` does not select `sw2d.puzzle`.** Discovered, not designed around in advance:
`PuzzleConfig` requires functions (`createInitialState`, `isSolved`), and the generator can only
ever populate `content/game.json`'s `config` with JSON data. Rather than force a workaround into
the generator (e.g. a special-cased non-JSON config path for exactly one pack) or silently claim a
capability the demo doesn't actually use, the demo implements the identical state shape directly
and the incompatibility is recorded as a real, generalizable finding - the next preset needing
`sw2d.puzzle` will hit the identical wall, and Phase 9 should decide whether that's a pack-level
fix or a permanent documented limitation.

**The all-74 evidence bar is two-tier, not "build all 74 for real."** Building all 74 on every
change would be real but disproportionate - most of the variation between presets is JSON content
data, already exhaustively schema-checked statically. The real-build tier only needs one
representative per *shell-template equivalence class* (six classes; the twelve demos already cover
five, so only `gallery-shooter` needed adding for the `pointer` class) to be honest evidence for
the untested 61 - because what varies between them (JSON data) is exactly what the static tier
already checks for all 74, and what doesn't vary (scaffolding, template selection logic) is exactly
what the real build proves works.

**`validate`'s browser smoke was strengthened mid-phase after it missed a real bug.** The original
oracle only checked the title screen loaded - it never started a run, so `SystemHostImpl.install()`
never executed during the check, and a `main.ts.template` that only wired the shell pack (not every
required pack) would have shipped "validated" while actually broken for any preset needing a second
pack. Caught by hand while building `metroidvania` (which needs `sw2d.progression`), not by the
ladder itself - the ladder was then fixed so the *next* instance of this bug class would be caught
automatically.

### Rejected during this phase

- **A spatial pointer/world-coordinate aim service.** See "Decisions" above and ADR-0016. Deferred
  again, not built smaller-than-planned - genuinely not needed for anything Phase 8 required.
- **Promoting `ProjectilePool` to `@sw2d/packs`.** See "Decisions" above. Left open for Phase 9,
  not decided by default-to-promote or default-to-defer.
- **A generic fix or workaround inside the CLI generator for `sw2d.puzzle`'s config shape.**
  Would have been a pack-architecture fix disguised as a generator change, and risked being
  designed around one demo's specific needs rather than the real underlying gap. Recorded as a
  finding for Phase 9 instead.
- **Downloading a bundled Playwright browser.** The full `playwright` package's install script
  does this by default; `playwright-core` (same driver API, no such script) satisfies the phase's
  explicit dependency policy without it. See `docs/architecture/DEPENDENCY_BASELINE.md`.
- **Building all 74 presets for real on every validation run.** See "Decisions" above - the
  two-tier evidence strategy was chosen deliberately over this, not settled for as a shortcut.
- **A shared "grid cursor" abstraction** across `sokoban`/`tower-defense`/`turn-based-tactics`.
  Considered; rejected because CONFIRM means something different in each (push vs. place vs.
  select-then-act) - a shared abstraction would either encode all three behaviors, defeating the
  purpose, or stay too thin to be worth extracting yet. Left for Opus to revisit if a fourth
  grid-family demo needs the identical shape.

---

## Phase 7C - Preset Catalog Families G-I (2026-08-25, Sonnet 5) - catalog complete

No new ADR - the third phase in a row where extending ADR-0015's package boundary and Phase 7A's
authoring pattern required zero changes to either. That is itself the finding worth recording: the
repair generalises across genuinely different kinds of recipes (menu-driven sims, dialogue-heavy
narrative games, pointer-driven toys), not just the two Phase 7B happened to add.

### Decisions

**`sw2d.simulation`'s zero-consumer gap was closed by genre fit, not by assignment.** Phase 7A and
7B both flagged it honestly rather than forcing an unnatural recipe to reference it early - the
right call, confirmed in hindsight: Family G's eight recipes are *defined* by "a resource ledger
plus timed jobs" (`simulationPack`'s own scope), so the pack became central without anyone
deciding to manufacture coverage. The tell that this was genuine fit and not padding: `sw2d.ai` is
selected by *zero* Family G-I recipes, even though several (colony-lite, pet-creature, shopkeeper)
are exactly the kind of recipe a less careful catalog would reach for "AI" to describe. Section 9's
instruction not to select AI "merely to simulate customers/animals if the current AI capability
does not actually represent those behaviors" was followed to the letter: `aiPack`'s
idle/patrol/chase/flee vocabulary does not represent a shop customer, a farm animal or a colonist,
so none of these recipes claims it, and every one instead names the real gap
(`LIMITATIONS.customerEconomy`, `LIMITATIONS.creatureSimulation`, or an inline colony-specific
string) in `knownLimitations`.

**`creatureSimulation` is this phase's one deliberately cross-family shared constant.**
`pet-creature` (Family G) and `virtual-pet`/`aquarium-terrarium` (Family G and I respectively)
share identical wording because they share an identical real gap - a creature/needs/relationship
simulation beyond `simulationPack`'s foundational resource ledger. Phase 7B's shared constants
were all reused *within* one family; this is the first constant reused *across* two families,
which is exactly what the "share only when wording is genuinely reused" rule should produce when
two unrelated-looking families turn out to need the same honest sentence.

**Family G stayed `ui-simulation`-only, deliberately, even where `pointer` was tempting.**
Shop/restaurant/tycoon recipes "feel" like they want tap-to-select item interaction, but
`UiSimulationIntent`'s `confirmPressed`/`navigateLeftPressed`/etc. already cover menu-style
selection completely honestly - adding `pointer` on top would have been a controller-family claim
with no real capability behind it beyond what `ui-simulation` already provides. Reconsidered and
rejected mid-authoring, not left ambiguous: the first draft of `shopkeeper`/`restaurant` included
`pointer`, removed once it was clear nothing about "press-style pointer" adds anything
"confirm-style ui-simulation" does not already honestly claim.

**Family H followed the master plan's own per-recipe assignments exactly, including its
dual-controller cases (`point-and-click`, `investigation-game`, `museum-exhibit`).** Two
controllers on one recipe is not a new pattern - Phase 7A's `puzzle-platformer`
(`platform`+`grid`) and Phase 7B's `tower-defense` (`grid`+`pointer`) already established it - but
Family H is the first family where a *majority* of recipes (4 of 7) genuinely need two. That is a
property of narrative/exploration games actually combining locomotion and interaction, not a
loosening of the "smallest honest composition" rule; each dual-controller recipe's own file
comment states which controller does which job.

**Family I's controller choices were the most judgment-heavy of the whole catalog, and each was
argued from the recipe's real identity, not from a family default.** `physics-toy` and
`drawing-game` get bare `pointer` (no secondary controller) because tapping/dragging genuinely is
their whole interaction model. `fishing-game` and `cooking-game` - which read as "should be
pointer" on a first pass - were deliberately assigned `ui-simulation` alone instead: casting and
chopping are both single-press-timing actions `confirmPressed`/`primaryPressed` already covers
honestly, and claiming `pointer` for them would have been exactly the unjustified-claim mistake
avoided in Family G. `photography-game` is the one Family I recipe combining `top-down` (walking a
Tiled level to find a subject) with `pointer` (framing/capturing) - the same justified-dual pattern
Family H established, applied because photography genuinely has both a locomotion half and an
aiming half.

### Rejected during this phase

- **`pointer` on Family G's customer-facing recipes** (`shopkeeper`, `tycoon-lite`, `restaurant`).
  See "Decisions" above.
- **`sw2d.ai` on any Family G-I recipe.** MASTER_PROJECT.md section 9's explicit instruction; see
  "Decisions" above.
- **A tenth or eleventh validation profile** for finer Family G/H/I granularity. Nothing about
  `idle-incremental` vs. `colony-lite`, or `visual-novel` vs. `escape-room`, differs at the
  validation-profile level yet - the same reasoning Phase 7A/7B already applied to their own
  families.
- **Building any of the roughly twenty missing systems Family G-I's `knownLimitations` name**
  (offline-progress/prestige economy, customer/colonist/creature AI, crop-growth systems,
  branching-dialogue rendering, evidence-linking, exhibit presentation, escape-room puzzle
  grammar, microgame scheduling, local multiplayer routing, wardrobe drag/drop, sandbox
  authoring, canvas drawing, fishing/cooking sequencing, photography scoring) to make a recipe
  feel more finished. Every one is a `knownLimitations` entry instead, per the phase's own
  explicit non-goals list and the master plan's standing rule: registering a recipe is not
  permission to implement its defining mechanic.
- **A generic "content role is conceptual" shared limitation constant.** Considered for the nine
  recipes whose `requiredContentRoles` include a not-yet-schema-backed role (`dialogue`,
  `exhibits`, `puzzles`, `microgames`, `characters`, `recipes`). Rejected because each recipe's
  *specific* required limitation text (section 11) already states the underlying gap precisely
  enough that a second, vaguer, generic sentence on top would have been redundant rather than
  additionally honest.

---

## Phase 7B - Preset Catalog Families D-F (2026-08-25, Sonnet 5)

No new ADR - this phase's job was to prove ADR-0015 and Phase 7A's authoring pattern generalise,
not to make new architecture decisions. It did.

### Decisions

**Extend through the existing generic test suites; do not write a second set.** Every Phase 7A
test file (`catalog.test.ts` excepted, which hardcodes ids by design) was already written as a
loop over `PRESETS`, not a fixed list of 27 names. Adding 22 recipes to the catalog made those
suites exercise 49 cases with zero code changes - only `catalog.test.ts`'s exact-id list,
`honesty.test.ts`'s required-limitation cases, and `schemaValidation.test.ts`'s hardcoded profile
count needed touching. This is the payoff of writing Phase 7A's tests generically in the first
place, not a Phase 7B decision - but confirming it held, rather than assuming it would, is what
this phase actually verified.

**Four new shared `LIMITATIONS` entries, not thirteen.** Every Phase 7B recipe has at least one
real limitation (MASTER_PROJECT.md section 9 names one per recipe or per small group), but only
four pieces of wording are genuinely reused two or more times: vehicle-intent-only and
race-orchestration text across all five Family D recipes, advanced-physics text across
`physics-puzzle`/`pinball-lite`, and ball-paddle-system text across `breakout`/`pong`. Every other
limitation - falling-block engine, match/cascade rules, tower pathfinding, RTS selection, tactics
movement/attack ranges, wave/base-damage orchestration, territory/capture mechanics - is used by
exactly one recipe and stays an inline string in that recipe's own catalog file. The phase brief
was explicit about this trade-off ("add shared limitation constants only when wording is genuinely
reused"), and getting it right matters: a shared constant for a single-use string would be one more
name to look up for no reuse benefit, while inlining a genuinely-shared string would let two
recipes' wording drift apart silently.

**`sw2d.strategy` got its first real consumers; `sw2d.simulation` still has none, and that is
recorded honestly rather than forced.** Family F (`auto-battler`, `simple-rts`,
`turn-based-tactics`, `territory-control`) is exactly the family Phase 7A's own bible entry
predicted would be `sw2d.strategy`'s first real consumer. `sw2d.simulation` had no natural fit in
any of the 22 Phase 7B recipes - none of vehicle/movement, puzzle/arcade or strategy/defense is
actually about a resource ledger with timed jobs, the capability `simulationPack` publishes. Add
it to `docs/presets/PRESET_CAPABILITY_MATRIX.md` as unreferenced with a pointer to where it
belongs (Phase 7C's simulation/management family) rather than bolt it onto a recipe that does not
need it just to make the "every pack has a consumer" story tidier.

**`tower-defense` and `territory-control` both select `sw2d.ai` optionally but `sw2d.combat`
required.** `aiPack.dependencies = ['combat.health']` is the one non-trivial cross-pack dependency
among all ten current packs, established as a Phase 7A rule
(`packages/presets/src/catalog/topDownAction.ts`'s file comment: "any recipe selecting sw2d.ai
anywhere also selects sw2d.combat as required"). Applying it correctly to two new recipes during
authoring - not discovering it via a failing test afterward - is what "reuse the pattern" actually
means in practice, not just reusing `definePreset`.

**Controller choices followed the phase brief's own routing table exactly, including where it
under-specifies.** `breakout`/`pong` are typed `top-down` for paddle movement, explicitly *not*
because the ball has a controller - it does not, and `LIMITATIONS.ballPaddleSystem` says so
directly. `maze-game` chose `grid` over `top-down` (the brief allowed either) because a maze is
fundamentally a discrete-cell structure, matching `sokoban`'s and `tower-defense`'s reasoning
elsewhere in the same family set. `pinball-lite`'s two-flipper input maps onto
`UiSimulationIntent`'s `navigateLeftPressed`/`navigateRightPressed` more honestly than any other
existing intent shape - not a perfect fit (nothing here is "the pinball controller"), but the
closest real one, which is exactly what MASTER_PROJECT.md section 3.1 asks a preset recipe to be:
a composition of what exists, not a placeholder for what does not.

### Rejected during this phase

- **A fourth, fifth or sixth Family D/E/F-specific validation profile.** Three new profiles (one
  per family) were added; nothing about horizontal-shmup-style granularity (Phase 7A rejected the
  same idea) applies any more here than it did there.
- **A dedicated "vehicle" or "strategy" controller family.** Every Family D/F recipe uses one of
  the six existing families; MASTER_PROJECT.md section 7 explicitly rules out inventing new ones,
  and nothing about racing or RTS commands needed a new one - `vehicle` and `top-down`/`grid`
  already cover the honest subset of behaviour these recipes can claim.
- **Building any of the fourteen missing systems section 9 names** (vehicle physics, ball/paddle
  bounce, falling-block/match-3 engines, tower placement/pathfinding, RTS selection, tactics
  movement/attack ranges, wave orchestration, territory mechanics) to make a recipe feel more
  complete. Every one is a `knownLimitations` entry instead - registering a recipe is not
  permission to implement its defining mechanic, the phase brief's own words.
- **Adding `sw2d.simulation` to a Family D/E/F recipe just to give it a consumer.** See
  "Decisions" above.

---

## Phase 7A - Preset Catalog Families A-C (2026-08-25, Sonnet 5)

Full architecture rationale:
[ADR-0015](docs/architecture/adr/0015-preset-catalog-and-pack-metadata-boundary.md).

### Decisions

**Investigate the Phase 5 trigger before choosing a dependency shape - the brief said to, and it
paid off twice.** The obvious first attempt (`@sw2d/presets`' tests importing `resolveInstallOrder`
from `@sw2d/runtime`) failed immediately and loudly: `ReferenceError: window is not defined`,
thrown from inside Phaser's own module-load code, not from anything this phase wrote. That is the
same failure shape the Ajv trigger already described for `@sw2d/packs` - a package's barrel
evaluates everything reachable from it, so importing one pure function pulls in a renderer that
function never touches. Confirming the trigger *with a failing test* rather than reasoning about
it abstractly is what turned "investigate before choosing the package dependency shape" from a
suggestion into an actual repair.

**The repair is the same shape both times: a named `package.json` "exports" subpath pointing
directly at the one already-side-effect-free file, nothing invented.** `@sw2d/packs` gained
`./ids` (`ids.ts`, zero imports - true before this phase, unchanged by it). `@sw2d/runtime` gained
`./composition` (`resolveInstallOrder.ts`, contracts-types-only - also true before this phase). Both
additive; neither package's `.` export or existing behaviour changed, confirmed by an unchanged
`npm run build` output. The alternative that was actually tempting - a small hand-written
`PackMetadata[]` mirroring each pack's `id`/`provides`/`dependencies` as plain data - was rejected
specifically because it is the exact defect shape Phase 5's gate spent its whole report
diagnosing: a second copy of a fact that could silently drift from the real implementation. A
subpath export has nothing to drift, because it is not a copy.

**Eleven recipes carry the master plan's exact required limitation text, verbatim, asserted by
regex in a test.** Not paraphrased per-recipe: `stealth-game` and `heist-game` share one string,
every shmup/`bullet-hell`/`run-and-gun` share another, because they share the same real gap
(`combatPack`'s own doc comment: "deliberately not a combat system - no weapons, projectiles").
Sharing the string is a decision, not laziness - MASTER_PROJECT.md section 12 is explicit about
what each of these must say, and duplicating slightly-different wordings per recipe would be the
first crack in the "honest limitations" invariant.

**`aiPack.dependencies = ['combat.health']` shaped every recipe that touches AI.** It is the one
non-trivial cross-pack dependency among all ten current packs (every other pack's `dependencies`
is `[]`). Any recipe selecting `sw2d.ai` anywhere - required or optional - had to select
`sw2d.combat` as *required*, or the recipe's own selection set would fail to resolve through the
real `resolveInstallOrder` the moment a generated game actually tried to install AI without combat
already present. `stealth-game`/`heist-game` needed a second pass for exactly this: they were
first drafted with `combat` only optional, and the catalog-integrity test - which resolves the
*full* required+optional selection set, not just required - caught it immediately.

**`defaultConfig: {}` and `starterScene: SCENE_KEYS.play` are uniform across all 27, deliberately,
not from an oversight.** Nothing in the repository consumes `PresetDefinition.defaultConfig` yet
(MASTER_PROJECT.md section 11 explicitly permits `{}` when that is true), and every generated game
boots into the one real `PlayScene` regardless of preset - genre identity lives in which packs and
controller families a preset selects, not in a preset-specific scene. Inventing per-recipe values
for either field would have been decoration, the same class of problem Phase 4/5 already named and
rejected for pack config.

### Rejected during this phase

- **A hand-written pack-metadata mirror**, instead of the subpath-export repair. See "Decisions".
- **Moving `resolveInstallOrder` into `@sw2d/contracts`.** Genuinely Phaser-free and could live
  there, but moving working, tested code to solve a reachability problem an additive
  `package.json` entry already solves is a bigger change than the problem justifies.
- **Deep relative imports** (`../../runtime/src/core/resolveInstallOrder.ts`) from
  `@sw2d/presets`' test suite, bypassing `package.json` "exports" entirely. Works today only
  because this is one monorepo checkout; not a real package boundary.
- **A fourth or fifth `validationProfile`** to give shooters and top-down recipes more granular
  buckets. MASTER_PROJECT.md section 14 asks for a bounded set "justified by actual recipe
  differences" - nothing about horizontal vs. vertical shmup, or arena-combat vs. boss-rush,
  actually differs at the validation-profile level yet; three profiles, one per family, is the
  honest granularity today.
- **A twentieth object-class catalog entry**, for any recipe that might want one. None of the 27
  Family A-C recipes needed a class beyond Phase 6's fixed nineteen; ADR-0014's deferral trigger
  ("a second real consumer") did not fire.
- **Promoting any recipe past `maturity: 'recipe'`.** Nothing in this phase - schema validation,
  composition checks, pack-dependency resolution, materialization - constitutes a smoke demo or an
  end-to-end proof. Calling any of it `smoke-validated` would be exactly the "file existing is not
  a feature" failure MASTER_PROJECT.md section 3.9 and `docs/AGENT_WORKFLOW.md` both warn against.

---

## Phase 6 - Tiled, Theme, Accessibility, and Resource Pipeline (2026-08-25, Sonnet 5)

Full architecture rationale:
[ADR-0014](docs/architecture/adr/0014-content-pipeline-and-entity-registry.md).

### Decisions

**A new package, not a bigger `@sw2d/schemas` or `@sw2d/packs`.** Tiled ingestion needs real
transform logic (per-class required-property checks with located errors) that JSON Schema cannot
express cleanly, and it needs zero Ajv/Phaser dependency. Cramming it into `@sw2d/schemas` would
have blurred a boundary Phase 5's gate specifically praised for staying narrow ("the model scales -
do not generalise it further"); cramming it into `@sw2d/packs` would have given a stateless
transform a capability-installation lifecycle it does not need. `@sw2d/content-pipeline` depends on
`@sw2d/contracts` only - the same "does this actually need Phaser or a validator" test every
existing package boundary in this project has passed.

**Three new shared types went into `@sw2d/contracts`, not into whichever package produces them
first.** `NormalizedLevel`, `ThemeManifest`, `ResourceRecord`/`ResourceManifest` are each consumed
by two or three packages that must not depend on each other's implementation
(`content-pipeline` produces them, `schemas` validates them, `packs`' entity registry consumes
one of them). Exactly the reasoning that put `AssetDescriptor`/`ContentBundle` in contracts back in
Phase 1 - and, on the negative side, `GameContext` gained zero fields from any of this, the same
evidence Phase 4 and Phase 5 both produced independently.

**Two-stage Tiled validation, not one.** `normalizeTiledMap` (hand-written, `@sw2d/content-pipeline`)
does the transform and the semantic checks a schema cannot express well (per-class required
properties, unknown-class rejection with a real object id in the message).
`level-document.schema.json` (`@sw2d/schemas`) then validates *its output* at the content boundary,
the same guarantee `tuning.json` has had since Phase 2. Neither stage validates raw Tiled JSON
directly against a schema - Tiled's own on-disk format is an authoring-tool detail this factory
does not commit to mirroring exactly, and MASTER_PROJECT.md section 6 explicitly says "do not
attempt every Tiled feature."

**The entity registry is `world.entities`, the entity registry's factories are Phaser-free by
type, but the *pack that registers real factories* is scene-scoped.** `EntityRegistry<TContext>`
is generic; the concrete `EntityRegistryImpl` stores `(object, context) => result` and never
inspects `context`, so it is honestly typed as `EntityRegistry<GameContext>` at the pack-definition
level and widened to `EntityRegistry<SceneContext>` at the one real call site
(`starter/src/game-specific/tiledLevelPack.ts`) - identical to the widening cast Phase 4 already
accepted for `puzzlePack`'s `PuzzleService<TState>`. Reusing an already-reviewed pattern instead of
inventing a second one.

**Tile-image rendering is out of scope, on purpose, not by oversight.** `normalizeTiledMap` records
a tile layer's name and dimensions and stops there; every collidable/visual surface in the Phase 6
proof is a `Solid`-classed object-layer rectangle, rendered with the same generated-texture pipeline
every other sprite in this project uses. Reading Tiled's per-cell GID data and resolving a tileset
image is real work with a real resource-governance question behind it (a tileset PNG needs a
provenance record) that no Phase 6 proof actually needs answered.

**The Tiled-proof page is a second static entry, not a change to the first.** MASTER_PROJECT.md
section 8 explicitly allows this ("the existing starter should load this level *or* a dedicated
small Phase 6 content fixture"). Given a choice between risking the hard-won Phase 1-5 evidence
(`context.disposables` flat at 6 across 8 restarts, zero console errors, `vx`/`vy` values matching a
schema-validated config) and adding one more `<script>` entry to a Vite multi-page build, the second
was strictly cheaper and strictly safer. `placeholderMoverPack.ts` was not read for edits, only for
its *pattern* - `tiledLevelPack.ts` is a second worked example of the protected boundary, not a
replacement for the first.

**`highContrast` and `refreshEnvironment()` were closed inside `resolveTheme()`/`createGame()`
respectively, not by adding new `GameContext` fields.** Both were flagged as gaps as far back as
Phase 1-3 ("persisted and projected; nothing renders differently for it" / "no caller re-reads
media queries yet"). Phase 6 is the first phase with an actual presentation layer (the theme/CSS
pipeline) for `highContrast` to affect, and the first phase to introduce a plausible caller for
`refreshEnvironment()` - MASTER_PROJECT.md section 12's own instruction ("do not create polling
simply to mark this item used") is exactly why neither was closed earlier. `matchMedia`'s `change`
event is a real, non-polling signal; wiring it inside `createGame` next to the existing
`visibilitychange` listener reuses a pattern already reviewed, rather than adding a new one.

### The pattern this phase kept finding

Every one of Phase 5's five defects was "a declaration nothing evaluates." Phase 6 did not repeat
that shape anywhere it touched - the object-class catalog's required properties are checked
(`validateObjectProperties`, with tests for both a missing and a mistyped property); a pack's
`provides: [CAPABILITY_IDS.entities]` is real (checked by the existing Phase 5 `provides`
enforcement, for free); the two themes' `assets` arrays are schema-validated, not just
TypeScript-satisfied. The one place a declaration-vs-behaviour gap could plausibly have crept back
in - "not every object class needs a registered factory" - is explicit in the entity registry's own
contract (`dispatch()` returns `undefined`, not an error, for a recognised-but-unregistered class),
so an author cannot mistake "the catalog knows this class" for "something happens when it appears."

### Rejected during this phase

- **An extensible, runtime-registered object-class catalog.** MASTER_PROJECT.md section 13.1
  permits it; Phase 6 has one real consumer (the proof level) and no second one, which is exactly
  invariant 14's bar for a new abstraction. Deferred with a trigger: a second content-authoring
  consumer (a Phase 7+ preset) needing a class outside the fixed nineteen.
- **Live in-page theme hot-swapping.** `ContentSource.load()` has always been a one-shot call at
  `createGame()` time; making it swappable mid-session is a materially bigger runtime change no
  Phase 6 acceptance criterion actually needs. The query-parameter-selected, load-time theme choice
  proves theme/gameplay separation just as well and costs nothing new in the runtime.
- **Rendering Tiled tile images.** See "Decisions" above.
- **Wiring the Tiled proof into `index.html`.** See "Decisions" above.
- **A `PackConfigValidator`-style dependency-inversion for resource governance**, so
  `@sw2d/schemas` would not need `resource-policy.json` passed in. Unnecessary: `resource-policy.json`
  lives at the repository root, `validateResourceManifest` is a pure function that takes a
  `ResourcePolicy` object, and the one real caller (a test, today; `@sw2d/cli`'s future `doctor`
  command) already has to read the file anyway. Passing data in beats reaching a path out of the
  package.

---

## Phase 5 - Architecture Integration Gate A (2026-08-25, Opus 5)

Verdict: **PASS WITH TARGETED REPAIRS**. Full report:
[`docs/architecture/PHASE5_ARCHITECTURE_GATE_A.md`](docs/architecture/PHASE5_ARCHITECTURE_GATE_A.md).

### The pattern behind every defect this gate found

Five issues, one shape: **a declaration nothing evaluates.**

`configSchemaId` named a schema that did not exist. `provides` named a capability that was never
published. `sideEffects: false` claimed a purity two modules did not have. `GameEventMap`'s doc
comment stated a rule the interface below it broke. Capability ids claimed families their services
did not cover.

None of these was a bug in the usual sense - nothing was broken, no test failed, and the code did
exactly what it was written to do. They are all cases where a *contract* existed in metadata and
nothing on any execution path ever checked it. That is precisely the class of defect that survives
a green validation ladder, and precisely the class that multiplies when 74 presets copy the worked
example.

The lesson worth carrying: **a declared field is either enforced or it is a comment.** Declaring
`configSchemaId` and not resolving it hid a wrong value for four phases. Declaring `provides` and
not publishing it would have blamed the wrong pack. When a phase adds a field to a definition
contract, the same phase should add the thing that reads it - or record explicitly that it is a
comment until phase N.

### Decisions

**`GameContext` is closed, on negative evidence.** All nine Phase 4 pack families needed only
`events` and `capabilities` - both present since Phase 1. Nine new consumers across nine domains
added zero fields. That is the whole argument; nothing about the field list itself would have
settled it. ADR-0004's admission test ("a pack may be absent") still decides every future case, and
Phase 6's theme/asset work has an existing home (`assets`, `content`) rather than a new field.

**Capability ids were renamed now because nine constants is the cheapest this ever gets.** The
forcing evidence was not tidiness: `combatPack`'s own doc comment says it is "deliberately not a
combat system," and `MASTER_PROJECT.md` §9.7 lists the rest of that family; `worldPack` holds flags
while §9.9's world family is tilemaps and camera zones - Phase 6's subject. A foundational core
holding the flat id `world` means Phase 6 literally cannot publish, because `resolveInstallOrder`
will correctly refuse it. Three id conventions were already live in the repo (Phase 1's tests used
`combat.health`, Phase 4 shipped `combat`, the starter used `starter.player`), so this settled a
drift rather than inventing a style. ([ADR-0011](docs/architecture/adr/0011-capability-id-governance.md))

**Gameplay events moved out of contracts because of the protected boundary, not because of size.**
The accumulation argument alone (sixteen families, 74 presets, one core interface) would have been
weak - a long interface is not a defect. The decisive argument is that `packages/contracts/**` is
reserved for runtime work needing justification and regression coverage, so under the Phase 4
arrangement a preset author raising one event has to edit the machine. Declaration merging was
already documented in the file as the intended mechanism; Phase 4 simply did not use it.
([ADR-0012](docs/architecture/adr/0012-gameplay-events-belong-to-their-package.md))

**Config validation became a composition-root option, but stayed optional.** Making it required
would break every call site and force a schema layer on roots that legitimately have none (a test
harness, a CLI dry-run). The actual failure was never "unenforced" - it was **silent**. A debug
warning naming every pack whose `configSchemaId` is going unenforced closes that without the
breakage. ([ADR-0013](docs/architecture/adr/0013-composition-root-enforces-pack-declarations.md))

**Deferred with triggers, not with intentions.** Shared bounded-counter and flag-store primitives,
the generic `PuzzleService<TState>` shape, the spatial pointer service, and exporting pack config
schemas as data instead of self-registering. Sonnet's Phase 4 judgement on the first two was
correct and is upheld: the *events* each family emits differ enough (`combat:entityDamaged` vs
`progression:currencyChanged` vs `simulation:resourceChanged`) that a shared primitive would have
to be event-agnostic, which makes it a `Math.max` wrapper. Each deferral names the concrete
condition that reopens it, so "later" is checkable rather than aspirational.

### The proof that had never been written

The Phase 3 leak - a pack's `dispose()` throwing mid-teardown and silently skipping the rest of its
own cleanup - was fixed, documented at length in this file, and *untested at the layer where it
happened*. `DisposableBagImpl` had "keeps tearing down after one teardown throws";
`SystemHostImpl` did not. A lesson recorded in prose and not in a test is a lesson the next
Phaser-backed pack gets to learn again. Now asserted: one pack's throwing `dispose()` leaves every
other pack disposed, every capability withdrawn and the host empty.

### Rejected during this phase

- **Extracting a `BoundedCounter` / `FlagStore` primitive.** Deferred with a named trigger, for the
  reason above. Judged on semantic stability, not on the ~30 lines it would save.
- **Redesigning the generic puzzle API for uniformity with the other eight families.** The widening
  cast only appears where a caller invokes `install()` directly - which is tests. A real game
  selects the pack through `SystemPackSelection`, whose `config` is already `unknown`, and reads
  state back through `capabilities.require<PuzzleService<TState>>(...)`, fully typed. An asymmetry
  that costs nothing outside a test file is not a design problem yet.
- **Making `packConfigValidator` required on `createGame`.** See above.
- **Building a leak detector, a capability registry, or a schema-ownership framework.** Each was
  considered against a concrete failure and rejected because a convention, a test or a named error
  already covered it. `MASTER_PROJECT.md` §47 is right.
- **Inventing a `starter.player` service so the starter's unpublished `provides` entry could
  stay.** An abstraction with no consumer, created to preserve a declaration nothing reads.
- **Writing an asset/theme schema to close the known `assets`/`ui` gap.** Real, correctly scoped,
  and Phase 6's - defining a schema before the pipeline that decides what an asset is would be
  guessing at the shape.

---

## Phase 4 - Reusable System Pack Core (2026-08-25, Sonnet 5)

### Decisions

**Nine independent, small implementations, not one shared abstraction, for the first pass.**
Combat's health clamp, simulation's resource ledger, arcade's score/lives and progression's
currency/XP/items all reimplement the same shape: `Math.max(0, value + delta)`, emit an event on
actual change. World's and narrative's flag stores are likewise near-identical
(`Set<string>` + no-op-on-no-change + emit). Unifying either pair into a shared primitive was
judged premature: this is the *first* pass at every one of these families, and a shared
abstraction designed from one example each is a guess, not a generalisation. Four correct,
independent, well-tested implementations are safer than one clever one built too early. Flagged
directly for Phase 5 Opus review (see below) rather than silently deferred.

**`configSchemaId` enforcement is dependency-inverted, not imported** ([ADR-0010](docs/architecture/adr/0010-pack-config-validation.md)).
`@sw2d/runtime` gained an optional `PackConfigValidator` parameter on `SystemHostImpl`, not a
dependency on Ajv or `@sw2d/schemas`. The same shape as ADR-0005's `ContentSource`: the runtime
declares the boundary, a composition root fills it. This was the deliberate alternative to the
two options the phase brief explicitly ruled out (importing a schema library into runtime, or
putting schema machinery into contracts).

**Only two packs get real config schemas.** `progressionPack` and `arcadePack` have
JSON-serializable, install-time-meaningful config. The other seven either take no config
(combat, AI, world, simulation, narrative, strategy) or take config that cannot be a JSON Schema
at all - `puzzlePack`'s `createInitialState`/`isSolved` are functions. Declaring a
`configSchemaId` for a pack with nothing to validate would have been decoration, not
architecture; the phase brief's own instruction ("add configuration schemas only for packs that
actually have config") is the reason, not an afterthought.

**AI depends on combat by capability id, reading a typed service, to prove the rule with a real
case.** `aiPack.isAgentAlive()` calls `context.capabilities.require<CombatService>('combat')`,
importing `CombatService` as a type only. This is the first Phase 4 pack-to-pack dependency the
project has - Phase 1's `resolveInstallOrder` tests used synthetic fakes because no real pack
existed yet. Proving "packs depend on capabilities, never modules" against an invented example is
weaker evidence than proving it against a real one.

**`undefined`, not `never`, is the config type for packs with no config.** The existing contract
(`SystemPackDefinition<TConfig = unknown, ...>`) makes a definition's `install()` require its
declared `TConfig` as a second, non-optional parameter at every call site, even though the
*implementation* can validly take fewer parameters (TypeScript's bivariant method checking).
`SystemPackDefinition<never, GameContext>` would make that second parameter literally
unconstructible outside an unsafe cast; `SystemPackDefinition<undefined, GameContext>` lets every
call site simply pass `undefined`. A small, purely call-site-ergonomics decision, recorded because
the next family added to `@sw2d/packs` will hit the same choice.

### Rejected during this phase

- **A shared `BoundedCounter`/`FlagStore` primitive for combat/simulation/arcade/progression and
  world/narrative.** See "Decisions" above - deferred to Phase 5 Opus review, not built on a
  sample size of one-to-two consumers per shape.
- **Wiring any Phase 4 pack into the starter.** The phase brief's own acceptance contract only
  required a real consumer for Phase 3's platform controller; Phase 4's packs are proven through
  unit tests and a real-`SystemHostImpl` composition test. Inventing a starter demo to "prove" a
  pack family works would have been exactly the kind of ungrounded scope expansion the phase
  explicitly warned against ("do not scaffold empty future packages" / "do not build nine visual
  demo games").
- **A pack-owned schema registry that `@sw2d/schemas` imports from `@sw2d/packs`.** Would invert
  the dependency the wrong way (schemas depending on packs) for no real benefit over each pack
  registering its own schema at module load.

### Questions for Phase 5 (Opus) - explicitly not solved here

Recorded per the phase brief's own instruction not to preemptively fix these on Sonnet:

1. **Shared low-level primitive candidates.** Combat/simulation/arcade/progression's bounded
   numeric mutation, and world/narrative's flag stores (see "Decisions"). Worth unifying once a
   third real consumer exists, or worth keeping independent because the *events* each emits
   differ enough (`combat:entityDamaged` vs `progression:currencyChanged` vs
   `simulation:resourceChanged`) that a shared primitive would need to be event-agnostic and
   therefore less useful than it looks?
2. **`GameContext` pressure.** No Phase 4 pack needed a new `GameContext` field - all nine use
   only `events` and `capabilities`, already present since Phase 1. Worth flagging anyway: Phase 6
   (Tiled/theme) and Phase 4's own eventual consumers (a game wiring these packs into real scenes)
   are the first places genuinely likely to want something `GameContext` does not yet expose.
3. **Pack API shape asymmetry.** `puzzlePack` is generic (`PuzzleService<TState>`) where the other
   eight are concrete. Its `SystemPackDefinition` value has to be widened (`as PuzzleConfig`) at
   every call site because one non-generic pack value cannot itself be generic over a caller's
   state type (see test-file comment in `packages/packs/test/puzzle.test.ts`). Tolerable for one
   family; worth a real design pass if a second generic-state family (e.g. a future strategy
   board-state pack) arrives.
4. **Config validator injection scope.** Enforcement is opt-in per `SystemHostImpl` instance
   today - nothing wires `packConfigValidator` into the starter's real `PlayScene`, so
   `configSchemaId` is enforced in tests but not in the one real running game. Is per-instance
   opt-in the right default going forward, or should `createGame()`/`CreateGameOptions` grow a
   validator option so real games get enforcement without each one remembering to wire it?
5. **Capability id collision risk at scale.** Nine flat string ids (`combat`, `ai`, `world`, ...)
   work cleanly now. With dozens of future packs (Phase 4's own family list is not exhaustive -
   `MASTER_PROJECT.md` §9 names sixteen pack families total), is a flat namespace still
   sufficient, or does capability-id governance need a convention (prefixing, a registry doc)
   before Phase 7's 74 presets start selecting packs at scale?

---

## Phase 3 - Controller Families (2026-08-25, Sonnet 5)

### Decisions

**Controllers are stateless singleton objects, not classes with a lifecycle.** Every family is a
plain `{ read(input: ActionInput): TIntent }` value. No `Disposable`, no constructor, no held
state. The forcing test: nothing a controller needs to compute (an axis, a bounded vector, a
claimed edge) requires memory across calls - `ActionInputHost` already remembers frame-to-frame
state, so a controller reading it doesn't need to. This directly satisfies §4's "disposable only
if it actually allocates state/resources": none do, so none are `Disposable`, and there is nothing
to leak by construction rather than by discipline.

**Exactly one family (`jumpPressed` in `PlatformIntent`, and `confirmPressed`/`cancelPressed`/
`pausePressed` in `UiSimulationIntent`) calls `consumePress`; everything else is a plain,
non-claiming read.** The line is: a field is claimed only when it represents a genuinely discrete,
single-owner, mode-changing decision - jump-trigger, confirm, cancel, pause - the same class ADR-
0003 names explicitly. Movement axes, held state, and navigation are observational: several
systems may reasonably want to see them in the same frame without racing each other for
ownership. Getting this line wrong in either direction was the main design risk of the whole
phase - too little claiming reintroduces c_chase-style double-consumption; too much claiming turns
a read into an exclusive lock nothing else can observe.

**The `Controller<TIntent>` contract lives in `@sw2d/contracts`, not `@sw2d/runtime`.** It depends
on nothing but `ActionInput` (already contracts-owned), so it costs nothing to keep
engine-agnostic, and doing so is what lets `packages/schemas` or a future `packages/cli` reason
about controller shapes without pulling in Phaser - the same argument that put `SystemPackDefinition`
in contracts during Phase 1.

**`topDownController` scales the whole `(moveX, moveY)` vector, not each axis independently, when
diagonal magnitude exceeds 1.** Clamping each axis to its own [-1, 1] range would still let a
diagonal press produce `sqrt(2)` total speed - exactly the bug the phase's acceptance contract
named. Scaling the vector preserves direction and guarantees `length <= 1` for any input,
digital or analog, which is why the fixture test asserts the *vector's* magnitude, not each
component.

**`pointerActionController` exposes only press-style actions and says so in its own doc comment,
rather than stubbing spatial fields.** `MASTER_PROJECT.md` §9.6's "hover, drag/drop, targeting,
placement, camera pan" vision for the pointer pack needs a spatial pointer service (world-space
cursor position, hover targets, drag deltas) that `ActionInput` does not have today. Inventing
placeholder `x`/`y`/`hover` fields that always read `0`/`false` would look complete and lie by
omission the first time someone builds a placement mechanic against them. Recorded as a bounded
future capability instead - a real `packages/runtime` addition for whichever phase needs
tower-defense-style placement or drag-drop, not a Phase 3 problem to fake around. This did **not**
rise to an Opus escalation: the existing `ActionInput` contract is not blocking Phase 3's actual
scope (press-style controllers), only a not-yet-required future one.

### The bug the regression check earned its keep on

**Restarting through the pause menu threw inside the placeholder mover's `dispose()`, and had
since Phase 1.** `SceneRouterImpl.restartRun()` queues `stop(play)` and an immediate `start(play)`
for the *same* scene key in one batch (`#clearPause()`, then stop, then `#switchTo`). By the time
the pack's teardown ran - during the queued stop's shutdown processing - Phaser's own physics
world/group teardown for that scene could already have run, so
`scene.physics.world.removeCollider(collider)` threw `TypeError: Cannot read properties of null`.
`SystemHostImpl.dispose()` catches and logs a per-pack disposal failure by design (so one pack's
bad teardown cannot block the others) - but *within* that one pack's `dispose()`, the throw still
aborted execution before `player.destroy()` and `ground.destroy()` ran. Every restart through the
pause menu therefore leaked one player sprite and one platform group, forever.

Why Phase 1's own evidence missed it: `DisposableBagImpl.dispose()` and `SystemHostImpl.dispose()`
both clear their bookkeeping (`#items`/`#installed`) *before* iterating to dispose each entry, so
the "flat disposable count" proof Phase 1 recorded is insensitive to an individual entry's
`dispose()` throwing partway through - the *count* of things the bag tracked returns to zero
either way. The leak was in Phaser's own object graph, one level below anything `OPERATIONAL_STATE.md`
was checking. Console output was not part of Phase 1's browser-check evidence; this phase's
regression pass added it, specifically because refactoring the mover's `update()` was reason
enough to distrust the untouched `dispose()` too.

The fix is scoped entirely to `starter/src/game-specific/placeholderMoverPack.ts` (a `safely()`
helper wrapping each physics-touching teardown step independently) - not `packages/runtime/**`,
because the actual defect is this one pack assuming its scene's physics world outlives its own
teardown, which is a pack-local assumption, not a shared architectural one. `SystemHostImpl`'s
catch-and-continue behaviour is correct and untouched.

**Lesson for whoever writes the next system pack's `dispose()`:** a scene-shutdown-triggered
teardown cannot assume the scene's built-in systems (physics world, groups, cameras) are still
alive. Guard each step, or order cleanup so pure-JS state (event listeners, timers, in-memory
counters) is released before anything that touches a Phaser-owned object.

### Rejected during this phase

- **A spatial pointer service**, to make `pointerActionController` feel more complete. See
  "Decisions" above - a real, bounded future capability, not built ahead of a real consumer.
- **A parallel edge tracker for `gridController`.** `ActionInputHost.justPressed` already
  guarantees exactly one true frame per physical press; reimplementing that inside the controller
  would have been the "second edge state machine" §11 explicitly forbids, for no benefit.
- **Wiring the other five controllers into real scenes** (e.g. having `PauseScene`/`TitleScene`
  consume `uiSimulationController`) to make them feel more "real." The phase's acceptance contract
  only requires a real consumer for the platform family; retrofitting scenes that already work,
  and are covered by the pause/resume regression lock, for a family with no real UI to drive yet
  would have been unjustified risk to a protected invariant for no Phase 3 requirement.

---

## Phase 2 - Schema, Registry, and Content Foundation (2026-08-25, Sonnet 5)

### Decisions

**Schema/type parity by `satisfies`-typed fixture, not a generator.** Each of the five schema
targets gets one TypeScript object literal typed `satisfies <ContractInterface>`; a test asserts
`Object.keys(fixture)` equals the schema's declared property-key set, and that the fixture
validates. The compiler enforces the fixture has every required field and no extra one; the
runtime assertion ties that to the schema. No `ts-json-schema-generator` or reverse codegen was
added - a new dependency for one direction of a two-direction sync would have been the larger
architectural commitment, and the field-name-set check is the strongest thing available without
one. Documented residual limitation directly in `packages/schemas/test/parity.test.ts`: this does
not prove every field's *type constraint* matches (a schema narrowed to a numeric range with a
plain `number` TS type would not be caught by parity alone) - the targeted negative fixtures in
`validator.test.ts` cover that for the fields where it matters.

**`ContentDocumentEnvelope<T>` closes the `ContentBundle.data` hole without giving `@sw2d/contracts`
an ajv dependency.** Contracts stays validator-agnostic - it knows the shape of "a validated
document" (`schemaId`, `valid`, `value`), not how validation happens. The actual document
registry (which document name maps to which schema) lives in `@sw2d/schemas`, which is allowed to
depend on Ajv. This mirrors the `SystemPackDefinition` split: contracts owns the shape, the
implementing package owns the mechanism.

**`assets`/`ui` in the starter's content have no JSON Schema yet, only a `satisfies`-then-cast at
the JSON import site.** A JSON import infers widened primitives (`role: string`, not the
`AssetRole` union), so `satisfies` alone cannot narrow it - the assertion in
`starter/src/content.ts` is compile-time trust, not a runtime check. Building a real asset schema
belongs to Phase 6's Tiled/theme pipeline (`MASTER_PROJECT.md` §12/§14), not to inventing one
early against §12's explicit instruction not to build ahead of a phase's real scope.

**`SystemPackDefinition.configSchemaId` stays unenforced.** Enforcing it means
`SystemHostImpl.install()` (`packages/runtime`) calling the validator before a pack installs -
exactly the kind of `packages/runtime/**` edit Phase 2 was required to avoid. Left as declared
metadata, same state as Phase 1 left it, for whichever phase is next permitted to touch runtime.

**Preset dependency-order determinism is not duplicated.** `resolveInstallOrder`
(`@sw2d/runtime`, Phase 1) already resolves `SystemPackDefinition` dependency graphs
deterministically, with real cycle-detection coverage. `PresetDefinition.requiredSystemPacks` /
`optionalSystemPacks` carry no dependency edges of their own (just a pack id and opaque config),
so a preset cannot represent a cycle at that level - only a `SystemPackDefinition` graph can.
Reimplementing that logic inside `@sw2d/schemas` to get a second, schemas-owned test suite would
have been duplicated, drift-prone code for coverage that already exists and stays untouched.
Phase 2 instead added the one cross-field rule JSON Schema cannot express by itself: rejecting a
pack id duplicated across a preset's required and optional lists
(`validatePresetComposition`).

### The gotcha worth flagging for later schema/JSON work

**`exactOptionalPropertyTypes: true` rejects `key: possiblyUndefinedValue` on an optional
property**, even though the property itself is optional. Reading `content.ui` from a
`{ ui?: Partial<UiCopy> }`-typed JSON import produces `Partial<UiCopy> | undefined`; assigning
that directly to another `ui?: Partial<UiCopy>` property fails to typecheck, because "optional"
under this flag means "may be absent," not "may be `undefined`." The fix is a conditional spread
(`...(value !== undefined ? { key: value } : {})`) so the key is omitted rather than present with
an explicit `undefined`. See `starter/src/content.ts`. Anyone building the Phase 6 theme/asset
loader on the same JSON-import pattern will hit this.

### Rejected during this phase

- **A schema for `assets`/`ui`.** See "Decisions" above - reserved for Phase 6, not invented
  early to make the schemas directory look more complete.
- **A second schema-validation or codegen dependency** for stronger parity guarantees. The
  `satisfies`-fixture approach was judged the smallest robust option; a generator would be a
  bigger, unrequested architectural commitment for marginal additional coverage.
- **Import attributes (`with { type: 'json' }`) for the JSON schema imports.** Plain
  `import x from './y.json'` already works under this repo's `resolveJsonModule` +
  `moduleResolution: "bundler"` configuration across `tsc`, Vite and Vitest; the assertion syntax
  added risk without a demonstrated need.

---

## Phase 1 - Establishment and Architecture Foundation (2026-08-24, Opus 5)

### Decisions

**Phaser 4.2.1 as the sole runtime, with three containment rules.** Contracts never import it,
its keyboard plugin is disabled, and only `SceneRouter` touches its scene manager. Picking an
engine is cheap; deciding where it is *allowed to appear* is what keeps the CLI and schema
tooling from needing a browser later. ([ADR-0001](docs/architecture/adr/0001-phaser-as-the-runtime.md))

**`@sw2d/contracts` is a package, not a folder, and has zero dependencies.** The forcing case is
Phase 8: the CLI must read preset and pack shapes in Node. If contracts lived inside the runtime,
`sw2d list-presets` would instantiate a renderer.
([ADR-0002](docs/architecture/adr/0002-package-boundaries.md))

**Three packages exist; five more are named but not created.** `schemas`, `presets`, `packs`,
`cli`, `qa` have reserved names and documented boundaries in the architecture overview, and no
directories. An empty package asserts progress that has not happened, which is the exact failure
`OPERATIONAL_STATE.md` exists to prevent.

**Core services on `GameContext`; optional capabilities as system packs.** The test that settles
every future case: *a pack may be absent*, so anything a scene cannot function without is a
context service. ([ADR-0004](docs/architecture/adr/0004-context-services-vs-system-packs.md))

**`resolveInstallOrder` is a pure function.** Pack composition is the thing most likely to break
subtly as 74 presets arrive, and making it engine-free meant Phase 1 could ship ten real tests
for it before a single pack existed.

**The runtime consumes a `ContentBundle`; it never reads a file.** Phase 2 swapping the inline
source for a schema-validated JSON source without touching runtime code *is* the acceptance test
for the machine/game boundary. ([ADR-0005](docs/architecture/adr/0005-content-loading-boundary.md))

**Offline is structural before it is checked.** System fonts, generated art, synthesised audio -
there is nothing to fetch, so the check confirms a property rather than enforcing a rule.
([ADR-0006](docs/architecture/adr/0006-offline-by-construction.md))

**TypeScript 7.0.2, the current stable native compiler.** It is not on the runtime path, so the
downside is bounded: if it regresses, 6.0.3 is a drop-in and nothing shipped depends on the
compiler. Copying an older version to feel safe would have contradicted the brief's instruction
to verify current versions rather than inherit them from examples.

### The lesson that cost the most

**A semantic input layer does not prevent double consumption. Ownership does.**

The `c_chase` audit's top finding was one keypress consumed twice - by a `keydown` handler and by
the animation loop, both reading the same `pressed` set - which broke pause, level select, the
briefing system and several toggles. Phase 1 started with the obvious lesson applied: semantic
actions, one owner advancing edges per frame, adapters that only write raw values.

It hit the same class of bug anyway on the first real browser run. Pressing P resumed the game
and then instantly re-paused, because the pause overlay resumed the play scene *within the same
frame* and the freshly-resumed scene then read the same `justPressed('PAUSE')` edge. Confirmed
from the call stack: `PauseScene.update -> setPaused(false)` immediately followed by
`PlayScene.update -> setPaused(true)`.

The fix is `consumePress(action)`: claiming an edge removes it for the rest of the frame, so one
physical press yields one effect no matter how many layers are alive. Holding is untouched.

Three things are worth carrying forward from this:

1. **Frame ownership solves stale reads. It does not solve two live readers.** Those are separate
   problems and need separate mechanisms.
2. The bug appeared only in a real browser, on the first end-to-end run. Unit tests could not have
   found it - nothing was individually wrong. `MASTER_PROJECT.md` §3.9 earned its place here.
3. The narrower fixes on offer (defer resume by a frame, order scenes by priority, per-system
   "did I handle this" flags) would each have fixed this instance and left the class open. The
   last one is literally what produced the original `c_chase` bug.

Every future layer - menus, HUD, dialogue, overlays - inherits the guarantee for free.

### Second defect

`BootScene` never stopped after handing off to the title; it stayed active for the life of the
game. Harmless in effect, but a scene nobody is accounting for is exactly the kind of thing that
becomes load-bearing by accident. The router now owns boot exclusively along with the other
scenes.

### Rejected during this phase

- **Phaser HEADLESS under jsdom** to automate the browser journey in Vitest. HEADLESS still builds
  a canvas and `generateTexture` needs a renderer, so the likely outcome was degrading real
  product code to satisfy a test environment. Wrong trade at the foundation.
  ([ADR-0008](docs/architecture/adr/0008-phase1-validation-strategy.md))
- **Playwright now.** A browser-driver dependency and a CI browser download to validate one flow,
  ahead of the QA phase that will have many. Deferred, and recorded as QA debt rather than
  quietly skipped.
- **Ajv now.** Verified current (8.20.0, MIT) and deliberately left uninstalled: Phase 1 has no
  schema to validate, and a dependency without a consumer is exactly what §20 warns against.
- **Bundling placeholder PNGs.** Binary art with no licensing story, when a rectangle drawn at
  boot is smaller, clearer, and provably local.
- **Escape bound to both PAUSE and CANCEL.** Caught while writing the default bindings: it would
  have made one keypress both resume and quit. The same failure family as the lesson above, so it
  is asserted in a test, not just avoided.

### Notes for whoever picks this up

- `globalThis.__SW2D__.snapshot()` is the QA contract. Its counters (`input.adapters`,
  `context.disposables`, `scene.disposables`, installed packs, debug sections) are how restart
  leaks are detected. Keep them honest; they are evidence, not decoration.
- `starter/src/game-specific/placeholderMoverPack.ts` is the worked example of the protected
  boundary: real controllable behaviour added entirely from the game side. When in doubt about
  where something belongs, compare against that file.
- Cloud Chaser has **no software license** and unconfirmed asset clearance. Its numeric tuning
  values are recorded in the extraction report with their source and date; its assets must never
  enter this repository.
- The `c_chase` audit is unusually good source material. Its "what already works" section is a
  list of things to preserve, and its ranked problems are a list of failure modes to design out.
  Read it before Phase 3 (movement) and Phase 10 (proof games).
