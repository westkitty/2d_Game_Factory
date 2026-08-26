# Phase 9 - Architecture Integration Gate B

- Date: 2026-08-26
- Owner: Opus 5
- Baseline reviewed: `59073445a932bdbf9de6af43bddffc9869ebb62b` (Phase 8 complete, `origin/main`, clean tree)
- Range inspected: `7363129..5907344`, plus every file in `packages/*/src`, `packages/*/test`,
  `demos/*/src`, `starter/src`, `tools/scripts/`, and the control-plane documents
  [`MASTER_PROJECT.md`](../../MASTER_PROJECT.md), [`OPERATIONAL_STATE.md`](../../OPERATIONAL_STATE.md),
  [`PROJECT_BIBLE.md`](../../PROJECT_BIBLE.md), ADR-0011/0013/0014/0015/0016, the preset catalog and
  capability matrix, the demo matrix, and the CLI reference.

## Verdict

**PASS WITH TARGETED REPAIRS.**

The factory is genuinely a factory, not a renamed monolith. The composition really composes: 74
presets resolve to **37 distinct runtime signatures**, not 74 labels over one engine and not six
shells with cosmetic metadata. Every protected invariant in the Phase 9 directive's section 12
holds in the actual source, not merely in the ADRs describing it.

But two of Phase 8's headline claims were false when tested rather than read, and both were false
in the same way Gate A's five defects were false - **a contract declared in metadata that nothing
at runtime evaluates**:

1. **"All 74 presets generate a runnable starter" was untrue for six of them.** Build success is
   not install success. `SystemHostImpl.install()` never runs during `tsc`/`vite build`, so the six
   presets requiring `sw2d.puzzle` produced games that built perfectly and then threw
   `TypeError: createInitialState is not a function` the instant a player pressed CONFIRM - taking
   the shell pack down with them through install rollback, leaving no gameplay at all.
2. **"Deterministic frame stepping" was untrue.** The QA harness never stopped Phaser's own
   `requestAnimationFrame` driver, so manual `stepFrames()` was *additive* to a free-running
   real-time loop (measured: ~60 frames/second of drift with zero `stepFrames` calls). Every smoke
   spec was nondeterministic; `top-down-racer` was already failing roughly a third of the time at
   the reviewed baseline, so its `smoke-validated` maturity was not evidence-backed on the day of
   this review.

Both are repaired, with the fix proven by re-running the same evidence that exposed them. Two
smaller falsehoods (`content/tuning.json` validated but never read; `validate`'s browser oracle
checking less than its own comment claimed) were repaired alongside them, and one proven shared
primitive was promoted.

Nothing was rewritten. No new engine paradigm, no universal puzzle DSL, no spatial pointer, no
broad refactor. `@sw2d/contracts` gained exactly one optional field.

---

## 1. Verified architecture strengths

Checked against source, not against the plan.

- **`@sw2d/contracts` is still dependency-free** (`dependencies: {}`, `devDependencies: {}`), and
  the runtime still imports no schema implementation - `PackConfigValidator` remains a bare
  interface and the Gate B repair below threaded code-supplied config through the same
  dependency-inverted seam rather than adding a second one.
- **Package direction holds.** `@sw2d/cli` -> `@sw2d/qa` one-directionally; `@sw2d/qa` has no
  dependency on `@sw2d/cli`. `@sw2d/presets` reaches `@sw2d/packs` only through the side-effect-free
  `@sw2d/packs/ids` subpath (verified at every import site), so `list-presets`/`describe` genuinely
  never load Ajv or Phaser. `@sw2d/cli` keeps `@sw2d/packs`/`@sw2d/runtime`/`phaser` as
  devDependencies only.
- **No generated game and no demo copies runtime source.** Verified by search across
  `demos/*/src` and the templates: every one consumes `@sw2d/*` as workspace dependencies. No
  relative path escapes a game directory.
- **The demos are real.** All twelve drive actual keyboard input through the semantic input layer.
  Across all fourteen committed specs there is exactly one `harness.evaluate` call, and it *reads*
  DOM text (visual-novel choice labels) - no spec sets a hidden pass flag, and none pokes game
  state directly.
- **Composition is genuinely varied.** 74 presets -> 37 distinct `(shell, required pack set)`
  signatures, spread across all six shells (grid 5, platform 7, pointer 5, top-down 11,
  ui-simulation 6, vehicle 4 - never a single dominant class hiding the rest).
- **ADR-0016's aim extension is honest** and did not disturb input ownership (section 7.8).

---

## 2. False or overstated claims found

| Claim | Source | Status |
|---|---|---|
| "All 74 generated source trees ... 74 runnable starters" | Phase 8 handoff §3, `OPERATIONAL_STATE.md` | **False for 6 presets.** Repaired; now true and proven at runtime. |
| "deterministic, not real-time" frame stepping | Phase 8 handoff §11 | **False.** rAF ran throughout. Repaired; now measurably deterministic. |
| `top-down-racer` maturity `smoke-validated` | `packages/presets` | **Not evidence-backed at baseline** (intermittent failure). Repaired at the cause, not the symptom; maturity retained. |
| stealth-game flake "fixed by widening the budget to 500 frames (real margin)" | Phase 8 handoff §11 | **Misdiagnosed.** The cause was free-running rAF, not tight frame math. The widening masked it. |
| `content/tuning.json` "(tuning values)" | generated README | **Was inert.** Validated by every generated game, listed in the README, read by nothing. Repaired. |
| `validate`'s smoke checks "every declared pack installed" | `validate.ts` comment | **Code checked only `installedPacks.length > 0`.** Repaired to match the comment. |
| `materializeStarterPlan` is "the contract Phase 8's file-generating CLI will consume" | `materialize.ts` | **Not consumed.** The generator reads `PresetDefinition` directly. Left in place, recorded below. |
| 14/14 smoke pass | Phase 8 handoff §4 | **13/14 at the reviewed baseline** on this host. Now 14/14 deterministically. |

---

## 3. The 74-preset runtime-composition finding (directive section 5)

A build-only matrix cannot answer this question, so a new one was built:
[`tools/scripts/generated-runtime-matrix.ts`](../../tools/scripts/generated-runtime-matrix.ts).

**Method.** Runtime signatures are derived *mechanically from the catalog*, never hand-listed: a
signature is the pair `(primary controller shell, exact sorted set of required pack ids)`, because
the shell decides which template is copied and the required-pack set decides what
`SystemHostImpl` installs. All 74 presets are mapped onto those signatures; one representative per
signature is generated under `games/` exactly as `sw2d new` would, really built (`tsc --noEmit` +
`vite build`), then really **played** in system Chrome: press CONFIRM, then assert
`scene === 'sw2d.play'` **and** every required pack plus the shell pack is in
`installedPacks` **and** zero console errors. A new preset with a new pack set grows this matrix
automatically.

Coverage: **74 presets -> 37 signatures -> 40 targets.** The extra three are the `sw2d.puzzle`
presets a signature representative did not already pick - every preset selecting that pack is
covered *individually*, because it is the one pack whose config is code. The script also asserts
mechanically that every config-reading pack (`sw2d.progression`, `sw2d.arcade`, `sw2d.puzzle`) is
covered, and fails rather than silently skipping if one is not.

**Result at the reviewed baseline: 34/40.** All six failures were exactly the `sw2d.puzzle`
presets - `sokoban`, `puzzle-platformer`, `match-puzzle`, `falling-block-puzzle`, `physics-puzzle`,
`escape-room` - each with:

```
required pack(s) never installed: sw2d.puzzle, <shell>
[sw2d] system pack "sw2d.puzzle" failed to install: TypeError: e.createInitialState is not a function
```

Note the second missing entry on every line: install rollback meant the **shell pack never
installed either**, so those six generated games had no gameplay whatsoever, not merely a missing
puzzle service. Phase 8's `sokoban` demo did not hit this only because it worked around the
generator entirely - which is why the gap survived a phase.

**Result after repair: 40/40.** Every distinct generated runtime composition in the catalog now
really enters play.

---

## 4. Demo-authenticity finding (directive section 6)

All twelve demos were inspected against the six criteria. **Eleven pass outright; one needed its
cause repaired rather than its claim withdrawn.**

- Generated origin is inspectable: every demo carries the generated scaffolding
  (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `tests/content.test.ts`) and
  differs from `sw2d new` output only in `src/game-specific/**` and, where needed, its own level.
- Defining mechanics are real runtime behaviour, not metadata: verified in the shell-pack sources
  (chase pressure advancing in `update()` and stopping because Phaser does not tick a paused
  scene; metroidvania's unlock flag genuinely changing jump velocity; sokoban's push/undo/solved
  operating on real state; visual-novel's DOM dialogue driven through `uiSimulationController`
  with no second input owner; idle-incremental persisting across a real browser navigation).
- Smokes drive real user-facing input. No spec sets a hidden pass flag.
- No runtime source is copied into any demo.

**`top-down-racer` is the exception.** Its maturity was not evidence-backed at the baseline: the
spec failed 1-3 times in 5 on this host. The cause was *not* the demo and not the assertion - it
was the harness (section 7.11). Its "equal-and-opposite steering taps" have the tightest margin of
any spec, so it was simply the first to expose free-running rAF: extra real frames leaked into a
`keyTap`, leaving a residual steering angle of +/-3 degrees, which drifted the car off the
checkpoint line so the lap never completed inside the frame budget. After the harness repair the
spec produces **byte-identical results across six consecutive runs** (`left:-6, right:0,
iters:46, x:881` every time). Maturity retained, now genuinely backed.

`sokoban` deserves one honest narrowing: its `smoke-validated` status was earned by a demo that
**bypasses `sw2d.puzzle` entirely** and reimplements the same semantics game-specifically. That is
disclosed in its own source and in the Phase 8 handoff, and the mechanic it proves is real - but it
proved the *demo*, never the generated composition. The section 3 matrix is what now covers the
generated path.

---

## 5. Targeted repairs made

Five repairs, all in the "smallest cohesive" band, each closing a falsehood or a proven duplication.

### 5.1 `sw2d.puzzle` generator compatibility - `configSource` (directive 7.4: **option A+B, bounded**)

The directive forbids leaving a required reusable pack the generator cannot configure, and forbids
inventing a universal puzzle DSL. The repair does neither: it makes the code/JSON boundary
**machine-readable and enforced**, then gives code-configured packs a real seam.

- `@sw2d/contracts`: `SystemPackDefinition` gained one optional field,
  `configSource?: 'json' | 'code'` (default `'json'`).
- `@sw2d/packs`: `puzzlePack` declares `configSource: 'code'`. The classification is now a property
  the system evaluates, not a sentence in a doc comment.
- `@sw2d/runtime`: `createGame({ packConfig })` - a code-supplied config map keyed by pack id,
  threaded through `PlayScene` to `SystemHostImpl`. `SystemHostImpl` consults it **only** for a
  pack declaring `configSource: 'code'`, so JSON-configured packs stay where content authors can
  reach them and this is not a general escape hatch. A code-configured pack with no code config is
  refused *by name, at install*, with an actionable message - instead of being handed `{}` and
  tripping over it several frames later inside the pack.
- `@sw2d/cli`: every generated game now gets `src/game-specific/packConfig.ts`, and `main.ts`
  always passes `packConfig: PACK_CONFIG` (so `main.ts` stays byte-identical across all 74
  presets - only `packConfig.ts` varies). For the six puzzle presets it contains a **working**
  deterministic placeholder puzzle; for the other 68 it is an empty, documented map.

Why the seam rather than simply dropping the pack from the manifest: dropping it would have removed
the lie but also removed the capability, leaving all six presets permanently in sokoban's
hand-rolled workaround. Generating a real editable default in `src/game-specific/` - *normal game
work* - keeps the pack usable, keeps deterministic state/undo/reset/solved semantics intact, keeps
schema and runtime separated (a code-configured pack has no `configSchemaId` because there is
nothing a JSON Schema could validate), and keeps `TState` opaque. **No puzzle DSL was invented.**

Covered by new tests: install refusal is named and actionable; install succeeds and publishes
`puzzle.state` when the composition root supplies config; a selection's JSON config is ignored
entirely for a code-configured pack; and every one of the 74 presets is asserted to generate a
`packConfig.ts` whose contents match whether it needs one.

### 5.2 QA harness determinism (directive 7.11)

`gotoAndWaitForRuntime` now calls `phaser.loop.stop()`, tearing down Phaser's rAF driver while
leaving `step()` callable. `stepFrames` is now the *only* thing that advances the loop.

Measured before: 30 frames per 500 ms with zero `stepFrames` calls (~60 fps of drift).
Measured after: **0 frames of drift across a full second**, and `stepFrames(10)` advances exactly 10.

### 5.3 `content/tuning.json` made live

The platform and top-down shell templates now read `moveSpeed`/`jumpVelocity`/`gravity` from the
`tuning` content document (with the generator's own numbers as fallbacks) instead of hard-coding
them. Editing `content/tuning.json` now changes the game, which is what the generated README always
claimed. Guarded by a test asserting the shells read the document and that the generated document
supplies exactly the keys they read.

### 5.4 `validate`'s browser oracle tightened

`validate` now reads the game's own `content/game.json` in Node and asserts every declared pack id
appears in `installedPacks`, instead of `installedPacks.length > 0`. This is precisely the oracle
that should have caught the puzzle defect, and it now would.

### 5.5 `ProjectilePool` promoted (directive 7.5)

Moved from three **byte-identical** copies to `packages/runtime/src/game-support/projectilePool.ts`,
exported from `@sw2d/runtime`. See section 7.5 for the reasoning.

Also: `npm run qa:smoke` now prints a failing spec's recorded `details` and first console error.
At the baseline a failure printed only `failed:  consoleErrors=0 externalRequests=0`, which named
nothing.

---

## 6. Generated-game architecture (directive 7.2)

**KEEP** (with 5.1/5.3 applied).

`buildGameFiles()` returns an in-memory `Map`; `writeGameFiles()` is the only disk touch;
determinism is asserted for all 74. Generated packages are self-contained (`tsconfig.json` does not
extend the repo base, so a game typechecks outside `games/`), depend on `@sw2d/*` as workspace
packages, and never copy runtime source.

The edit boundary - `content/**`, `themes/**`, `src/game-specific/**` - is now **truthful in both
directions**, which it was not at the baseline: `content/tuning.json` was inert (5.3) and the one
pack that could not be configured from `content/**` had no code seam either, so its games simply
crashed (5.1). Both gaps are closed inside the sanctioned surfaces. No runtime edit is required for
normal game work.

Residual, recorded not repaired: `defaultConfig`, `starterScene` and `validationProfile` are
carried on every preset and evaluated by nothing (`validationProfile` is printed by `describe` and
selects no behaviour; nine profiles exist and differ only by name). `shared.ts` discloses this for
`defaultConfig`. `materializeStarterPlan`/`StarterPlan` has no production consumer at all - the
generator reads `PresetDefinition` directly - so its docstring's claim that the CLI consumes it is
now false. None of these can produce a wrong runtime result; all are dead weight rather than lies
about behaviour, and removing public API is not a Gate B necessity. **Trigger:** if Phase 10 needs
per-preset validation behaviour, `validationProfile` must become a real dispatch or be deleted; if
Phase 10 does not consume `materializeStarterPlan`, delete it in Phase 11.

---

## 7. Required architecture questions

### 7.1 74 preset composition reality - **KEEP**

Materially compositional, now verified rather than asserted. 74 presets resolve to 37 distinct
runtime signatures across all six shells; required packs really install (section 3, 40/40); the
extension seams are truthful after 5.1/5.3; `systemPacks` equals required packs plus the shell pack
exactly, with optional packs never auto-enabled. Six shells is not the problem it looked like -
the shell is the *movement* template, and what varies across signatures is the installed capability
set, which is where genre identity actually lives.

### 7.2 Generated-game architecture - **KEEP** (repairs 5.1, 5.3 applied). See section 6.

### 7.3 CLI/package boundaries - **KEEP**

Dynamic `loadCommand()` keyed by command name keeps metadata paths side-effect-free; Ajv and Phaser
load only on the commands that reach them; `@sw2d/cli` -> `@sw2d/qa` is one-directional; filesystem
safety is centralized in `assertValidSlug`/`resolveUnder`/`assertDoesNotExist` with `REPO_ROOT`
resolved from the file's own location and no `--force` anywhere. Prefer-clarity holds; nothing here
is clever.

Two cosmetic notes, neither a boundary violation: `@sw2d/qa` declares `dependencies: {}` and takes
`playwright-core` from devDependencies while `@sw2d/cli` depends on it in production (works because
the monorepo hoists; would need attention only if these were ever published separately), and
`@sw2d/qa` mirrors `DebugSnapshot` structurally rather than importing the type, so the Phase 8
handoff's "depends on `@sw2d/contracts` types" is inaccurate. Both recorded, neither repaired.

### 7.4 `sw2d.puzzle` generator compatibility - **REPAIR NOW** (done; option A+B, section 5.1)

### 7.5 `ProjectilePool` - **REPAIR NOW: promote to a bounded shared game-support helper**

Not a capability, not a pack, not a weapon framework.

The evidence for promotion is semantic stability, exactly as the directive asks: the three
consumers are **byte-identical** (`md5` equal across `twin-stick-shooter`, `bullet-hell`,
`tower-defense`), differing only in constructor arguments. Three independent consumers converging
on the same interface with *zero* divergence is the strongest available signal that the interface
is settled. Phase 10's twin-stick arena and tower-defense micro-map add consumers four and five;
deferring again would mean five copies of an interface already proven stable, which is the
"duplicated mechanics past their promotion threshold" failure this gate exists to catch.

It is promoted as **game support, not a system pack**, and lives in
`packages/runtime/src/game-support/` beside the controllers rather than in `@sw2d/packs` - for a
hard reason: it manipulates Phaser sprites and Arcade bodies, and every `@sw2d/packs` core is
renderer-independent by contract. It has no capability id, no `configSchemaId`, no install order,
no persistence. The unproven semantics a `sw2d.projectiles` *capability* would have to decide -
pooling policy, collision integration, whether damage-on-hit is first-class or caller-wired -
were deliberately **not** promoted; consumers still wire their own overlap/damage callbacks exactly
as the three demos already do.

### 7.6 Platform movement duplication - **KEEP**

The generated platform shell already supplies the shared movement cleanly, and what the three
platform demos "duplicate" is six lines that are not actually identical: `traditional-platformer`
and `chase-platformer` share them, while `metroidvania` selects jump velocity from an unlock flag -
i.e. the duplication ends exactly where the game-specific decision begins. Extracting a movement
capability here would either encode metroidvania's progression into movement (forbidden by the
directive, and wrong) or stay so thin it renames `platformController.read()`. Repair 5.3 removes
the one real defect in this area: the numbers now come from `content/tuning.json` rather than being
hard-coded in three places.

### 7.7 Grid cursor pattern - **DEFER WITH TRIGGER**

There are not three consumers - there are two. `sokoban` has no cursor at all: `gridController`
moves the *player*, and CONFIRM/CANCEL mean reset/undo. Only `tower-defense` and
`turn-based-tactics` maintain a cursor, and in both it is a four-line switch on `intent.step` plus
a bounds clamp, where CONFIRM means something structurally different (place-with-currency vs.
select-then-act). An abstraction over that today would merely rename `gridController.read()` -
precisely what the directive warns against.

**Trigger:** extract only when a third *cursor* consumer (not merely a third grid-family game)
needs cursor movement **and** clamping **and** a selection-state machine, or when two consumers
need identical cursor rendering. Phase 10's proofs C and D do not meet this bar - D (Sokoban) is
the no-cursor shape.

### 7.8 Aim and spatial pointer - **KEEP** (aim) / **DEFER WITH TRIGGER** (spatial pointer)

`TopDownIntent.aimX/aimY/aimMagnitude` is correct and does not break input ownership: it is
computed from `input.axis('AIM_LEFT','AIM_RIGHT')` and `input.axis('AIM_UP','AIM_DOWN')` with the
same magnitude clamp movement already uses. It reads no new input surface, owns no listener, claims
no press, and touches neither `consumePress()` nor the single-frame-owner rule. Independent digital
aim genuinely works - `twin-stick-shooter` proves it under real-browser QA.

Spatial pointer/hover/click targeting stays deferred, and **Phase 10 does not require it**: proof C
(tower-defense micro-map) places towers through the existing keyboard-driven grid cursor, which the
Phase 8 directive explicitly sanctioned and which now runs deterministically. Building it in
Phase 9 would be speculative surface area.

**Trigger:** build spatial pointer when a *required* proof or preset cannot be honestly built
without world-space hit-testing - concretely, when `point-and-click`, `drawing-game`, or
`physics-puzzle` is promoted past `recipe`. At that point it needs its own ADR answering whether it
fits inside `ActionInput` (as aim did) or genuinely needs new input-ownership surface; on present
evidence it needs the latter, because hover has no press to claim.

### 7.9 Pack boundaries / hidden monolith risk - **KEEP**

Packs are scoped and honest. No pack imports another pack's implementation module (`aiPack`
consumes combat by capability id, with `CombatService` imported as a type only). Capability ids
stay namespaced `<family>.<service>` per ADR-0011; pack ids stay vendor-prefixed `sw2d.*` and
generated shells `game.*`.

The reusable layer is **not** decorative: across the 40-target matrix every required pack in every
signature really installs and really publishes its capability. The demos do bypass packs for
mechanics no pack claims to own (hand-authored routes, grids, checkpoint sequences) - that is
correct, since those are game-specific data, not capabilities. The one genuine bypass of a
*selected required* pack was sokoban's, and the reason it existed is repaired in 5.1.

### 7.10 Schema/config evolution - **REPAIR NOW (boundary made explicit) + DEFER WITH TRIGGER (content roles)**

The JSON-configured vs code-configured boundary is now explicit and enforced rather than implied:
`configSource` is a real field, `SystemHostImpl` routes on it, the generator emits the correct seam
for each, and a violation fails at install with a named error. Phase 10 therefore cannot create
incompatible parallel config paths five times - there are exactly two paths and the pack declares
which one it uses.

One real gap is recorded and **not** repaired: `requiredContentRoles` is claimed by every preset
and evaluated by nothing. Nine distinct roles are claimed across the catalog, but only `tuning` and
`levels` have a generated document, a schema, or a pipeline; `dialogue` (4 presets), `characters`,
`items`, `puzzles`, `recipes`, `microgames` and `exhibits` have none. Repairing this properly means
designing content schemas, which is real new pipeline work and outside a gate's bounded scope.
**Trigger:** any Phase 10 proof that needs authored content beyond `tuning`/`levels` - concretely,
proof E (tiny management toy) if its production chain is meant to be content-authored rather than
game-specific TypeScript - must either add the schema and pipeline for that role or drop the claim
from the preset. Do not let a proof invent a private content format.

### 7.11 QA architecture - **REPAIR NOW** (done, section 5.2) - then **KEEP**

After the repair, the harness is what it always claimed to be:

- **Deterministic**: measured 0 frames of drift across a full second; `stepFrames(n)` advances
  exactly `n`; `top-down-racer` returns byte-identical results across six consecutive runs.
- **Meaningful**: real `KeyboardEvent`s through the semantic input layer, plus two universal
  oracles (zero console errors, zero cross-origin requests) folded in on top of each spec's own
  assertions by the one shared `runSmoke()` runner.
- **CI-usable**: `runAll.ts` builds every target with a real `vite build` (no stale-`dist`
  dependence), OS-assigned port 0 (no fixed-port collisions), non-zero exit on any failure, and -
  now - a failure line that actually names what failed.
- System Chrome remains a documented prerequisite via `findSystemChrome()` and `doctor`. That is
  acceptable and disclosed.

**Deterministic frame stepping is not real-time performance evidence, and this gate does not treat
it as any.** Nothing in the repository claims a frame-rate or performance result from it. Real
performance evidence remains unmeasured, which is the honest position.

### 7.12 Phase 10 proof readiness - see section 8.

---

## 8. Phase 10 proof-readiness matrix

| Proof | Existing reusable pieces | Expected game-specific pieces | Missing reusable prerequisite | Architecture blocker? |
|---|---|---|---|---|
| **A. Cloud Chaser-style chase mini-level** | `platform` shell + `platformController`; `sw2d.world` + `sw2d.world-entities`; Tiled pipeline + entity registry (ADR-0014); `content/tuning.json` now live; `chase-platformer` demo as the worked reference | Chase-pressure model, fail/finish conditions, level authoring | Chase/pursuit pressure is not a reusable system (`LIMITATIONS.chasePressure`) - correctly disclosed, and game-specific is the right home until a second consumer | **No** |
| **B. Twin-stick arena** | `top-down` shell + `topDownController` with independent digital aim (ADR-0016); `sw2d.combat`; **`ProjectilePool` now in `@sw2d/runtime`**; `twin-stick-shooter` demo | Wave/spawn logic, enemy behaviour, scoring, arena layout | None. Weapons/projectile *systems* stay disclosed-absent, which is correct - do not build a weapon framework for one proof | **No** |
| **C. Tower-defense micro-map** | `grid` shell + `gridController` keyboard cursor; `sw2d.combat` + `sw2d.progression` (currency) + world/entities; `ProjectilePool`; `tower-defense` demo | Route data, tower/wave definitions, placement rules, economy tuning | Spatial pointer stays deferred - explicitly not required (7.8); route/waypoint data stays game-specific (no Tiled class, ADR-0014 catalog unchanged at nineteen) | **No** |
| **D. Sokoban puzzle** | `grid` shell; **`sw2d.puzzle` now really installs from a generated starter** (was the single hardest blocker at baseline); deterministic undo/reset/solved semantics in the pack; `sokoban` demo | The puzzle's own state shape and rules in `src/game-specific/packConfig.ts` + shell; grid/level layout | None. The generated `packConfig.ts` default is a placeholder to replace, not a DSL to fight | **No** (was **yes** at baseline) |
| **E. Tiny management toy** | `ui-simulation` shell + `uiSimulationController`; `sw2d.simulation` + `sw2d.progression`; `SaveStore` persistence proven under real browser reload; `idle-incremental` demo | Production/economy model, job queue, upgrades, DOM presentation | **Only if the production chain is meant to be content-authored**: `requiredContentRoles` claims `recipes`, and no schema or pipeline exists for it (7.10). Building it as game-specific TypeScript has no blocker | **No** - but see the 7.10 trigger before claiming content-authored production |

No proof is blocked. Proof D was blocked at the reviewed baseline and is not blocked now.

---

## 9. Deferred decisions and their triggers

| Deferred | Trigger |
|---|---|
| Shared grid-cursor abstraction (7.7) | A third *cursor* consumer needing movement + clamping + selection state, or two needing identical cursor rendering. Phase 10 C and D do not meet it. |
| Spatial pointer / hover / click targeting (7.8) | A required proof or a preset promoted past `recipe` that cannot be honestly built without world-space hit-testing (`point-and-click`, `drawing-game`, `physics-puzzle`). Needs its own ADR on input ownership - hover has no press to claim. |
| Content schemas for `dialogue`/`characters`/`items`/`puzzles`/`recipes`/`microgames`/`exhibits` (7.10) | Any proof needing authored content beyond `tuning`/`levels`. Add the schema and pipeline, or drop the claim from the preset - never invent a private format inside a proof. |
| `sw2d.projectiles` as a real capability (7.5) | A consumer needing pooling policy, collision integration, or damage-on-hit as shared semantics rather than caller-wired callbacks. |
| Removing `materializeStarterPlan` / making `validationProfile` real (section 6) | Phase 11 if Phase 10 does not consume them; sooner if Phase 10 needs per-preset validation behaviour. |
| Real-time performance evidence (7.11) | Deterministic stepping cannot supply it. A separate, honestly-labelled measurement is needed before any performance claim is made anywhere. |

---

## 10. Validation

| Check | Baseline (`5907344`) | After repairs |
|---|---|---|
| `npm run typecheck` | pass | pass |
| `npm test` | 1589 tests, 65 files, pass | pass (new tests added) |
| `npm run build` + `check:offline` | pass, no external request construct | pass, no external request construct |
| `npm run validate` | **pass** | **pass** |
| `npm run qa:smoke` | **FAIL - 13/14** (`top-down-racer`, reproduced 1-3 failures in 5) | **PASS - 14/14**, deterministic |
| Generated-runtime signature matrix (new) | **FAIL - 34/40** (all six `sw2d.puzzle` presets) | **PASS - 40/40** |
| All-74 static generation (`packages/cli/test/generate.test.ts`) | pass | pass, plus new code-seam and tuning-consumption assertions across all 74 |
| Representative real-build matrix (`tools/scripts/build-matrix.ts`) | 13/13 | re-run after generator change |

The baseline was established **before** any edit, exactly so no failure could be misattributed to
this phase - and that is how the pre-existing `top-down-racer` failure was found.

---

## 11. Why this is a PASS

Gate B's question is whether Phase 10 can begin without multiplying a known architectural
falsehood. At the reviewed baseline it could not: five of the six proof games would have been built
on a QA harness whose central determinism claim was untrue, and one of them (D) sat directly on a
pack that no generated game could install. Both were invisible to every check that existed,
because every existing check either stopped at `vite build` or ran against a clock nobody owned.

Both are now closed at the cause, with the closure proven by re-running the evidence that exposed
them, and both are guarded by tests that fail if they regress. The compositional claim - the one
that decides whether this is a factory - survived the hardest test available: 37 distinct generated
runtime compositions, each really built and really played. The remaining findings are dead metadata
and undesigned content pipelines, which are honest gaps rather than false claims, and each carries
a named trigger.
