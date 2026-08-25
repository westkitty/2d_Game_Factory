# Operational State

Project: **Stinky Weasel 2D Browser Game Factory** (`sw2d`)
Repository: `westkitty/2d_Game_Factory`
State revision: **4**
Updated: 2026-08-25

Read this before doing anything. Governing spec: [`MASTER_PROJECT.md`](MASTER_PROJECT.md).
Workflow: [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md).

---

## Current phase

**Phase 4 - Reusable System Pack Core - COMPLETE (Sonnet 5).**

Next owner: **Opus 5, Phase 5** (Architecture Integration Gate A). See
[Next bounded action](#next-bounded-action).

## Current baseline

| Item | Value |
|---|---|
| Branch | `main` |
| Workspaces | `@sw2d/contracts`, `@sw2d/runtime`, `@sw2d/schemas`, `@sw2d/packs`, `@sw2d/starter` |
| Node (supported) | `>=22.12.0`; target 24.x LTS (`.nvmrc` = 24) |
| Node (dev host used) | 26.7.0, npm 11.19.0 |
| Phaser | 4.2.1 (MIT) |
| TypeScript | 7.0.2 (Apache-2.0) |
| Vite | 8.2.2 (MIT) |
| Vitest | 4.1.11 (MIT) |
| Ajv | 8.20.0 (MIT) |
| ajv-formats | 3.0.1 (MIT) |
| Runtime version constant | `0.1.0` |
| Debug snapshot version | `1` |
| Settings schema version | `1` |
| Schema versions (all Phase 2 schemas) | `v1` (encoded in each schema's `$id`, e.g. `urn:sw2d:schema:game-definition:v1`) |

Full rationale: [`docs/architecture/DEPENDENCY_BASELINE.md`](docs/architecture/DEPENDENCY_BASELINE.md).

## Verified capabilities

Backed by the evidence in [`docs/qa/PHASE1_VALIDATION.md`](docs/qa/PHASE1_VALIDATION.md) (Phase 1)
and this revision's validation run (Phase 4).

- `npm install`, `npm run typecheck`, `npm test` (200 tests), `npm run build` and
  `npm run check:offline` all pass.
- Boot -> title -> start -> controllable placeholder actor -> pause -> resume -> restart works
  end to end in a real browser against the production build. **(Phase 3)** Re-verified against the
  platform-controller-driven mover specifically: horizontal movement and jump were confirmed
  through real Arcade Physics (`vx`, `vy`, `onGround` read from the live debug snapshot), not
  just "no console error." **(Phase 4)** Re-verified again after `SystemHostImpl`'s constructor
  gained an optional validator parameter: the starter's own `PlayScene` (unchanged, still
  constructs its host with two arguments) still boots, moves, pauses, resumes and restarts
  cleanly with zero console errors and flat listener/GameObject counts.
- Restart is clean: 8 consecutive restarts via the pause menu plus a quit-to-title and a fresh run
  left every live-resource counter flat (input adapters, context disposables, scene disposables,
  installed packs, debug contributions) **and, newly checked this revision, every live Phaser
  GameObject count flat too** (`playScene.children.list.length` stayed at 5 across all 8
  restarts). Quitting to the title released all counters to zero.
- Semantic input drives gameplay from both keyboard and DOM touch controls, with no duplicated
  game logic for touch.
- One press produces one effect across overlapping scenes (`consumePress`).
- Settings persist across reload, namespaced by game id and version-stamped.
- The accessibility projection is live and derived, not copied (reduced motion forces screen
  shake to zero without a second setting).
- Audio stays locked until a real user gesture; no autoplay is attempted; Web Audio absence
  degrades to `unavailable` rather than throwing.
- The production build loaded exactly two resources, both same-origin (re-verified this
  revision; still true with `@sw2d/schemas` bundled in).
- Mobile viewport (375x812) shows unclipped 56x56 touch controls and a scaled canvas.
- **(Phase 2)** `@sw2d/schemas` validates GameDefinition, PresetDefinition, SystemPackSelection,
  ActionBindings, GameSettings and a `tuning` content document via Ajv, with located errors
  (`documentId` + `instancePath` + `message`; e.g. `/player/jumpVelocity must be number`).
  29 tests across `validator.test.ts`, `parity.test.ts`, `contentDocuments.test.ts`,
  `presetComposition.test.ts`.
- **(Phase 2)** Schema/type parity is enforced mechanically: each schema's declared property-key
  set is asserted equal to `Object.keys()` of a TypeScript object literal typed
  `satisfies <ContractInterface>` against the real `@sw2d/contracts` type. A field added to or
  removed from a contracts interface without updating the schema (or vice versa) fails
  `parity.test.ts`. See the residual-limitation note in that file.
- **(Phase 2)** `ContentBundle.data` is now `Readonly<Record<string, ContentDocumentEnvelope>>`
  (`schemaId`, `valid`, `value`), not an ungoverned `Record<string, unknown>`. Zero runtime code
  read `.data` before this change (confirmed by search), so the edit required no
  `packages/runtime/**` changes.
- **(Phase 2)** The starter runs from validated JSON: `starter/content/game.json` (validated
  against the GameDefinition schema before `STARTER_GAME` exists) and
  `starter/content/content.json` + `starter/content/tuning.json` (the latter validated through
  the content-document registry) replace the Phase 1 inline TypeScript literals. Verified in a
  real browser: the built starter boots to a title screen rendering the exact JSON-sourced UI
  copy, with zero console errors - proof the validation ran and passed before Phaser
  initialised. `packages/runtime/**` has zero changes (confirmed: `git diff --stat -- packages/runtime/`
  is empty).
- **(Phase 2)** Malformed content fails before runtime use: `starter/test/content.test.ts`
  asserts a `game.json` missing `viewport` and a `tuning.json` with a wrong-typed field both
  throw `SchemaValidationError` from the content loader, not from wherever gameplay code first
  touches the bad field.
- **(Phase 3)** Six controller families exist (`platform`, `top-down`, `vehicle`, `grid`,
  `pointer-action`, `ui-simulation`), each a stateless `Controller<TIntent>` in
  `packages/runtime/src/controllers/` reading only `@sw2d/contracts`'s `ActionInput`. 35 focused
  tests across seven files in `packages/runtime/test/controllers/`. Every controller's declared
  own-keys are exactly `['read']` (asserted directly) - no controller owns a listener, a timer or
  frame advancement to leak.
- **(Phase 3)** The platform family has a real consumer:
  `starter/src/game-specific/placeholderMoverPack.ts` now calls `platformController.read(context.input)`
  instead of reading `ActionInput` directly, and supplies only "how the body moves" (velocity,
  gravity, the jump-vs-grounded decision) - verified in a real browser through actual Arcade
  Physics state, not just a passing build.
- **(Phase 3)** The pause/resume double-consumption regression class (ADR-0003) is covered at the
  controller layer, not just the scene layer: `uiSimulationController`'s `confirmPressed` /
  `cancelPressed` / `pausePressed` claim their edge via `consumePress`, and
  `uiSimulationController.test.ts` asserts a second same-frame reader sees `false`. Re-verified
  live in-browser this revision too (see "Restart is clean" above and the fixed-bug note below).
- **(Phase 3)** `topDownController`'s diagonal-movement bound is enforced and tested: pressing two
  cardinal directions at once produces a `(moveX, moveY)` vector whose length is <= 1, not
  `sqrt(2)` - `moveMagnitude` and the vector components are asserted numerically in
  `topDownController.test.ts`.
- **(Phase 3) Bug found and fixed, not merely discovered.** Restarting through the pause menu
  (`SECONDARY_ACTION` inside `PauseScene`) throws inside
  `starter/src/game-specific/placeholderMoverPack.ts`'s `dispose()`:
  `SceneRouterImpl.restartRun()` queues a stop and an immediate start of the same scene in one
  batch, so by the time the pack's teardown runs, the scene's physics world/groups can already be
  gone. The old code (`scene.physics.world.removeCollider(collider); player.destroy(); ...`)
  threw on the first line and silently skipped `player.destroy()`/`ground.destroy()` for every
  such restart - a real per-restart GameObject leak that the existing flat-disposable-count
  evidence never caught, because `SystemHostImpl.dispose()` and `DisposableBagImpl.dispose()`
  both clear their own bookkeeping *before* iterating, so their counters read flat regardless of
  whether an individual pack's `dispose()` throws partway through. Fixed by wrapping each
  physics-touching teardown step independently (`safely()` helper, game-specific file only); a
  real browser check across 8 pause-menu restarts now shows zero console errors and a flat
  GameObject count (previously: one caught-and-logged error per restart). This was pre-existing
  Phase 1 code, unrelated to the `update()` refactor - `dispose()` was untouched by the platform
  controller change and had carried this defect since Phase 1's manual validation, which checked
  disposable counts but not console output during restart.
- **(Phase 4)** `@sw2d/packs` created: nine reusable, renderer-independent system pack cores -
  combat, AI, world, progression, arcade, puzzle, simulation, narrative, strategy - each a typed
  `SystemPackDefinition<TConfig, GameContext>` publishing one capability through
  `context.capabilities`. No pack imports another pack's implementation module; `aiPack` consumes
  `combat` only by capability id (`context.capabilities.require<CombatService>('combat')`), with
  `CombatService` imported as a type only. 69 per-family unit tests (installation, capability
  publication, core behaviour, invalid/edge input, disposal, determinism) plus 9 composition
  tests in `packages/runtime/test/packsComposition.test.ts` using the *real*
  `SystemHostImpl`/`resolveInstallOrder`/`CapabilityRegistryImpl` - not fakes - to install all
  nine together, exercise a real cross-pack interaction (AI reading combat health), tick
  `update(deltaMs)` for the two time-based packs (arcade, simulation), and dispose cleanly
  (`capabilities.list()` returns `[]` afterward). Also proves missing-dependency (`ai` without
  `combat`), duplicate-capability (two packs both providing `combat`) and install-rollback
  failure paths against real pack definitions, not just Phase 1's synthetic fakes.
- **(Phase 4)** `SystemPackDefinition.configSchemaId` enforcement exists, dependency-inverted
  (ADR-0010): `@sw2d/contracts` gained a `PackConfigValidator` interface;
  `SystemHostImpl`'s constructor takes one as an optional third argument and, when supplied,
  validates a pack's config before `install()` runs, rolling back on failure through the existing
  partial-install rollback path. `@sw2d/runtime`'s own dependency graph is unchanged - still only
  `@sw2d/contracts` + `phaser` (verified: `packages/runtime/package.json`'s `dependencies` field
  did not change; `@sw2d/schemas`/`@sw2d/packs` are `devDependencies`, test-only).
  `@sw2d/schemas` supplies the concrete implementation (`packConfigValidator`), built on a new
  general-purpose `registerSchema`/`validateBySchemaId` pair. Two packs have real config schemas
  this phase - `progressionPack` (`startingCurrency`/`startingXp`) and `arcadePack`
  (`startingLives`/`comboWindowMs`) - proven both ways in `packsComposition.test.ts`: unenforced
  (no validator supplied) lets an out-of-range config install silently; enforced
  (`packConfigValidator` supplied) rejects it before install and rolls back any pack already
  installed in the same batch.
- **(Phase 4)** Time-based packs are deterministic under supplied `deltaMs`, never the wall
  clock: `arcadePack.elapsedMs()` and `simulationPack`'s job countdown both advance only through
  `update(deltaMs)`, asserted numerically in their unit tests and in the composition test.
  `combatPack`'s invulnerability window and damage/heal clamping take `nowMs` as an explicit
  caller-supplied argument, never `Date.now()`.

## Implemented but unverified

These exist in source and type-check, but have **no** executed evidence yet. Do not treat as
working.

- `PresetDefinition` - schema-validated as of Phase 2, but no preset instance exists yet and
  nothing in the runtime consumes one. Preset *dependency ordering* (topological sort, cycle
  detection) is exercised only for `SystemPackDefinition` via `resolveInstallOrder`
  (`@sw2d/runtime`, Phase 1 coverage, unchanged); `PresetDefinition.requiredSystemPacks` /
  `optionalSystemPacks` carry no dependency edges of their own; the only cross-field rule
  checked so far is duplicate/empty pack references (`validatePresetComposition`,
  `@sw2d/schemas`).
- `SystemPackDefinition.configSchemaId` - enforcement now exists (Phase 4, ADR-0010), but is
  **opt-in per `SystemHostImpl` instance**. The starter's own `PlayScene` still constructs its
  host with two arguments (no validator), so `starter.placeholder-mover`'s `configSchemaId`
  remains declared-but-unenforced in the actual running game. Only `progressionPack` and
  `arcadePack` have real config schemas; the other seven Phase 4 packs declare no
  `configSchemaId` at all (either no config, or - `puzzlePack` - config that is inherently
  non-serializable functions, which correctly has no schema to validate against).
- Image-backed (`kind: 'image'`) assets - code path exists, unused; no theme/asset pipeline yet
  (Phase 6).
- `starter/src/content.ts`'s `assets`/`ui` fields have **no JSON Schema**, only a TypeScript
  `satisfies`-then-assert against `AssetDescriptor`/`UiCopy` at the JSON import site (JSON
  imports infer widened primitives, e.g. `role: string` not `AssetRole`, so `satisfies` alone
  cannot narrow them - see the comment in `starter/src/content.ts`). A malformed
  `content.json` asset entry is not currently rejected at the content boundary the way
  `game.json` and `tuning.json` are. Deliberately out of scope: an asset/theme schema belongs to
  Phase 6's Tiled/theme pipeline, not Phase 2's five named contract types.
- `InputDeviceAdapter.poll()` - unit-tested for call cadence; no polling device (gamepad) exists.
- `WebAudioBus.musicNode` - wired into the gain graph, nothing plays through it.
- `SaveStore.migrate` - unit-tested; never exercised against a real schema change.
- `AccessibilityStateImpl.refreshEnvironment()` - no caller re-reads media queries yet.
- `highContrast` - persisted and projected; nothing renders differently for it.
- Reduced motion is honoured by the title prompt only; no other motion exists to suppress.
- **(Phase 3)** `topDownController`, `vehicleController`, `gridController`,
  `pointerActionController`, `uiSimulationController` - each has focused deterministic unit
  coverage against a real `ActionInputHost`, per the Phase 3 acceptance contract (only the
  platform family required a real in-game consumer). None is wired into the starter or any scene
  yet. Do not treat "tested" as "exercised by a real game" for these five.
- **(Phase 3)** Spatial pointer state (world-space cursor position, hover targets, drag vectors)
  is explicitly **not** implemented. `ActionInput` has no cursor coordinates today, and
  `pointerActionController` only exposes the press-style actions the current semantic layer
  honestly supports (`primaryPressed`, `secondaryPressed`, `interactPressed`, `confirmPressed`,
  `cancelPressed`). A full pointer/placement controller (needed for tower-defense-style placement,
  drag-drop, hover feedback) needs a spatial pointer service added to `@sw2d/contracts`/
  `@sw2d/runtime` first - a bounded future capability, not a Phase 3 gap to silently work around.
  See `PROJECT_BIBLE.md`'s Phase 3 entry for the reasoning.
- **(Phase 3, superseded)** ~~`SystemPackDefinition.configSchemaId` remains declared-but-unenforced~~
  - see the Phase 4 entry above: enforcement now exists but is opt-in.
- **(Phase 4)** None of the nine Phase 4 packs are wired into the starter or any scene. Per the
  phase's own acceptance contract (only Phase 3's platform family required a real starter
  consumer), all nine are proven only through unit tests and the real-`SystemHostImpl`
  composition test - not through an actual running game. `combat`/`ai`/`world`/etc. are real,
  tested, capability-publishing packs; they are not yet anything a player has touched.
- **(Phase 4)** Cross-pack event consumption is one-directional and shallow: `aiPack` reads
  `combat`'s *service* directly (`isAgentAlive`), but nothing yet *subscribes* to
  `combat:entityDamaged`/`combat:entityDied` (or any of the other eight Phase 4 events) to react
  to them. The events exist, are typed, and are asserted to fire with the right payload in each
  pack's own tests - but no cross-pack event *subscription* is exercised yet, only direct
  capability calls.

## Known failures / gaps

- **The browser journey is not automated.** It was driven manually and does not re-run on
  commit. Highest-value QA debt. See [ADR-0008](docs/architecture/adr/0008-phase1-validation-strategy.md).
  Still true after Phase 3; this revision's manual pass was the most thorough since Phase 1
  (boot, title-confirm, movement, jump, pause, resume, 8x restart-via-pause-menu, quit-to-title,
  fresh run, all read from the live debug snapshot and Phaser's own scene object list, not just a
  screenshot) because the controller refactor touched the real gameplay consumer - but it is still
  a manual script run once by hand, not a re-runnable check.
- **Frames in that journey were clocked manually** via `game.loop.step(t)`, because the
  automation surface keeps the browser pane hidden and rAF is throttled there. The code path is
  the production one; the clock is not wall-clock. FPS under real pacing is unmeasured. The same
  throttling was observed this revision (a `space` keypress did not visibly advance past the
  title scene in the hidden automation pane); not investigated further, as it is pre-existing QA
  debt out of Phase 2's scope, not a regression.
- **Bundle size**: 1.5387 MB minified (407.08 kB gzip), up from 1.4 MB / 366 kB in Phase 1 because
  `@sw2d/schemas` (Ajv + ajv-formats) is bundled into the starter, which validates its own content
  at boot in production too. Grew by ~120 bytes this revision even though the starter does not
  import `@sw2d/packs` at all - `@sw2d/schemas`' `validator.ts` (already imported by the starter)
  gained `registerSchema`/`validateBySchemaId`/`UnregisteredSchemaError`, sharing the module with
  code the starter already pulls in, so Rollup keeps the whole file rather than tree-shaking the
  unused additions individually. Benign; not investigated further. No code splitting. Acceptable
  for a self-contained static game; revisit only against a real target.
- **Phaser 4.2.1 typings gap** patched locally in `packages/runtime/src/phaser-augmentations.d.ts`.
  Delete it when upstream declares those `SceneManager` methods.
- JSON Schema validation now exists for GameDefinition, PresetDefinition, SystemPackSelection,
  ActionBindings, GameSettings and the `tuning` content document. It does **not** yet exist for
  asset/theme documents (see "Implemented but unverified" above) or for any document type beyond
  those six - by design; inventing schemas without a Phase 2 consumer was out of scope.

## Unknown

- Whether Phaser 4 can run headlessly under Vitest well enough to automate the journey without
  degrading product code (`generateTexture` needs a renderer). Investigate before committing to
  a headless approach.
- Real-device touch behaviour; only synthetic touch-type pointer events were used.
- Gamepad adapter feasibility against the current `InputDeviceAdapter` shape.
- Whether arcade physics suffices for every planned preset, or whether the optional advanced
  physics pack becomes necessary (`MASTER_PROJECT.md` §9.16).
- Final project software license. Still a user decision; `package.json` says `UNLICENSED`.
- **(Phase 4, for Phase 5 Opus)** Whether combat's health clamping, simulation's resource ledger,
  arcade's score/lives and progression's currency/XP/items should share one low-level
  "bounded-counter-with-change-event" primitive. All four independently reimplement the same
  shape (`Math.max(0, value + delta)`, emit an event on change) this phase. Not unified now -
  four small, correct, independent implementations were judged safer than a shared abstraction
  invented before a second real consumer proved the abstraction's boundary. See
  `PROJECT_BIBLE.md`'s Phase 4 entry for the full list of items flagged for Opus review.

## Protected invariants

Breaking one of these is an architecture change, not a bug fix. Escalate rather than work around.

1. `westkitty/c_chase` is read-only. Never modified, never pushed to, its architecture never
   transplanted, its assets never copied (unlicensed - see the extraction report).
2. `westkitty/2d_Game_Factory` is the only authorised remote. No force-push, no history rewrite.
3. **Machine vs game.** Ordinary game work touches `content/`, `public/`, `themes/`,
   `src/game-specific/`. It does not touch `@sw2d/runtime` or `@sw2d/contracts`.
4. `@sw2d/contracts` imports nothing - no Phaser, no DOM library, no dependency at all.
5. Gameplay consumes semantic actions. No `KeyboardEvent.code` outside an input adapter.
6. Input advances exactly once per frame, owned by `ActionInputHost`, driven from `prestep`.
   Discrete mode-changing reads use `consumePress`.
7. Only `SceneRouter` touches Phaser's scene manager.
8. Every system that allocates a listener, timer, body, DOM node, audio node or subscription
   has a disposal path, and restart must leave every snapshot counter flat.
9. No module-level mutable state in the runtime.
10. Zero required external network requests at runtime. No CDN, webfont, telemetry, analytics
    or remote config.
11. Saves are namespaced by game id and carry `schemaVersion`. No silent cross-loading, no
    silent reinterpretation.
12. Accessibility architecture is never removed by a preset or a theme; a preset may hide rows.
13. No game identity, lore or wording in runtime code. Copy comes from the content bundle.
14. No new package or abstraction without a real consumer.
15. Preset maturity labels stay honest. `proof-validated` requires an end-to-end proof.
16. System packs depend on capability ids, never another pack's implementation module. A pack
    may import another pack's *service interface* as a type only.
17. `@sw2d/runtime` never imports a schema validator library or `@sw2d/schemas` directly.
    `configSchemaId` enforcement happens only through the dependency-inverted
    `PackConfigValidator` interface (ADR-0010), supplied optionally at composition time.

## Validation matrix

| Layer | State | Command |
|---|---|---|
| Static / schema | TypeScript passing; JSON Schema exists for 5 contract types + 1 content document + 2 pack config schemas | `npm run typecheck` |
| Unit | 200 tests passing (58 Phase 1 + 29 Phase 2 + 35 Phase 3 + 78 Phase 4) | `npm test` |
| Build | passing | `npm run build` |
| Offline (static guard) | passing | `npm run check:offline` |
| Runtime integration | proven manually in-browser, **not automated** | see ADR-0008 |
| Browser journeys | not automated; boot/move/pause/resume/restart re-verified manually this revision after the `SystemHostImpl` constructor change | Phase 2+ (QA package still unbuilt) |
| Proof regression | none - no proof games exist | Phase 10 |
| Pack composition | real `SystemHostImpl` + `resolveInstallOrder` + `CapabilityRegistryImpl` installing all nine Phase 4 packs together, automated | `packages/runtime/test/packsComposition.test.ts` |

`npm run validate` runs typecheck + test + build + offline guard. All four passed this revision.

## Pending work

Phase 5 (Opus, architecture integration gate) is next; Phases 6-12 are unstarted. See
`MASTER_PROJECT.md` §38 for the routed plan and owners.

## Next bounded action

**Phase 5 - Opus 5 - Architecture Integration Gate A.**

Not executed this revision. Per `MASTER_PROJECT.md`, Opus should inspect the state since Phase 1,
the core contracts, schemas, registries, the six controller families and now the nine Phase 4
system-pack cores and their dependency/capability discipline, plus representative tests, and
judge whether the original boundaries are holding before the project multiplies into dozens of
presets. See "Opus Phase 5 handoff" material below for the specific concerns this phase surfaced.

## Revision history

### Revision 4 - 2026-08-25 (Sonnet 5)
Phase 4 complete. Created `@sw2d/packs`: nine reusable, renderer-independent system pack cores
(combat, AI, world, progression, arcade, puzzle, simulation, narrative, strategy), each a typed
`SystemPackDefinition<TConfig, GameContext>` publishing exactly one capability. `aiPack` depends
on `combat` by capability id only (type-only import of `CombatService`), demonstrating the
"packs depend on capabilities, never each other's modules" rule against a real cross-pack case,
not a synthetic one. Closed the `configSchemaId` enforcement gap left open since Phase 2/3 -
dependency-inverted (ADR-0010): `@sw2d/contracts` gained `PackConfigValidator`;
`SystemHostImpl`'s constructor takes one as an optional third argument (backward compatible - the
starter's `PlayScene` is unchanged and unaffected); `@sw2d/schemas` supplies the concrete
implementation plus a new general-purpose `registerSchema`/`validateBySchemaId` pair.
`progressionPack` and `arcadePack` have real config schemas and are proven both unenforced and
enforced (including rollback of an already-installed pack when a later one's config fails).
`@sw2d/runtime`'s own dependency graph is unchanged (`@sw2d/schemas`/`@sw2d/packs` are
`devDependencies`, test-only). 78 new tests: 69 per-family unit tests plus 9 composition tests
using the real `SystemHostImpl`/`resolveInstallOrder`/`CapabilityRegistryImpl` - not fakes - to
install all nine packs together, exercise a real cross-pack interaction, tick two time-based
packs deterministically, dispose cleanly, and prove missing-dependency/duplicate-capability/
install-rollback failure paths. A live browser regression (boot, move, pause, resume, restart)
confirmed the `SystemHostImpl` change has zero effect on the starter's actual running behaviour.
`npm run validate` passed (typecheck, 200 tests, build, offline guard). None of the nine packs
are wired into the starter or any scene - proven only through tests, per the phase's own
acceptance contract.

### Revision 3 - 2026-08-25 (Sonnet 5)
Phase 3 complete. Added `Controller<TIntent>` and six intent types
(`PlatformIntent`/`TopDownIntent`/`VehicleIntent`/`GridIntent`/`PointerActionIntent`/
`UiSimulationIntent`) to `@sw2d/contracts` (small, dependency-free, per §4's own permission); six
stateless controller implementations under `packages/runtime/src/controllers/`, exported from
`@sw2d/runtime`. `platformController` has a real consumer: refactored
`starter/src/game-specific/placeholderMoverPack.ts` to read platform intent instead of raw
`ActionInput`, preserving observable behaviour except for one deliberate, analyzed cleanup
(dropped a `consumePress('CONFIRM')` fallback in the jump trigger that was proven inert - see
`PROJECT_BIBLE.md`). The other five families got focused deterministic unit coverage (35 new
tests total) rather than a real consumer, per the phase's own acceptance contract.
`uiSimulationController` reproduces and passes the pause/resume double-consumption regression
test the phase required. `topDownController` enforces and tests the diagonal-magnitude bound.
`pointerActionController` deliberately does not invent spatial pointer data. Along the way, a
real, pre-existing Phase 1 defect was found and fixed: restarting through the pause menu threw
inside the placeholder mover's `dispose()` because Phaser's physics world can already be torn
down by the time a batched stop+restart's teardown runs, which silently skipped
`player.destroy()`/`ground.destroy()` on every such restart - a leak the existing flat-counter
evidence could not see. Fixed with per-step disposal guards in the game-specific file only; a
manual browser regression across 8 pause-menu restarts, a quit-to-title and a fresh run now shows
zero console errors and a flat live-GameObject count, in addition to the flat listener counts
Phase 1 already checked. `npm run validate` passed (typecheck, 122 tests, build, offline guard).

### Revision 2 - 2026-08-25 (Sonnet 5)
Phase 2 complete. `@sw2d/schemas` created: JSON Schema (draft-07) for GameDefinition,
PresetDefinition, SystemPackSelection, ActionBindings, GameSettings, plus a `tuning` content
document; Ajv 8.20.0 + ajv-formats 3.0.1 validator with located errors (`documentId` +
`instancePath` + `message`); a schema/type parity test keyed off `satisfies`-typed fixtures
against the real contracts interfaces; a small content-document registry
(`validateContentBundleData`) closing the `ContentBundle.data` type hole via a new
`ContentDocumentEnvelope<T>` contracts type; a `validatePresetComposition` semantic check for
duplicate/empty pack references (JSON Schema alone cannot express cross-array uniqueness). The
starter now runs from validated JSON (`starter/content/game.json`, `content.json`,
`tuning.json`) instead of inline TypeScript literals; `packages/runtime/**` received zero edits
(verified via `git diff --stat`). 29 new tests; full `npm run validate` ladder passed; a real
browser smoke check confirmed the built starter boots to title rendering the JSON-sourced UI
copy with no console errors. Known residual gap: `assets`/`ui` fields have no JSON Schema yet
(compile-time `satisfies` only) - deliberately deferred to Phase 6's theme/asset pipeline rather
than invented early. `SystemPackDefinition.configSchemaId` remains declared-but-unenforced;
enforcing it needs a `packages/runtime` edit Phase 2 was not permitted to make.

### Revision 1 - 2026-08-24 (Opus 5)
Phase 1 complete. Repository established; master plan installed; contracts, runtime and the
starter vertical slice implemented; dependency baseline pinned and recorded; eight ADRs written;
`c_chase` extracted read-only; validation ladder run and recorded. Two defects found and fixed
during validation (input edge double-consumption on resume; boot scene never stopping).
