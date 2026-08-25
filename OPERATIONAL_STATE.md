# Operational State

Project: **Stinky Weasel 2D Browser Game Factory** (`sw2d`)
Repository: `westkitty/2d_Game_Factory`
State revision: **6**
Updated: 2026-08-25

Read this before doing anything. Governing spec: [`MASTER_PROJECT.md`](MASTER_PROJECT.md).
Workflow: [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md).

---

## Current phase

**Phase 6 - Tiled, Theme, Accessibility, and Resource Pipeline - COMPLETE (Sonnet 5).**

Full architecture rationale:
[ADR-0014](docs/architecture/adr/0014-content-pipeline-and-entity-registry.md).

Next owner: **Sonnet 5, Phase 7A** (Preset Catalog Families A-C). See
[Next bounded action](#next-bounded-action). **Do not execute Phase 7A yet** - this revision only
records it as the next bounded action.

## Current baseline

| Item | Value |
|---|---|
| Branch | `main` |
| Workspaces | `@sw2d/contracts`, `@sw2d/content-pipeline`, `@sw2d/runtime`, `@sw2d/schemas`, `@sw2d/packs`, `@sw2d/starter` |
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
| Schema versions (all schemas, Phase 2 and Phase 6) | `v1` (encoded in each schema's `$id`, e.g. `urn:sw2d:schema:game-definition:v1`, `urn:sw2d:schema:theme-manifest:v1`) |
| Starter entry points | `index.html` (Phase 1-5 foundation slice, untouched) + `tiled-proof.html` (Phase 6 content-pipeline proof) - one Vite multi-page build, both covered by `npm run build`/`check:offline` |

Full rationale: [`docs/architecture/DEPENDENCY_BASELINE.md`](docs/architecture/DEPENDENCY_BASELINE.md).

## Verified capabilities

Backed by the evidence in [`docs/qa/PHASE1_VALIDATION.md`](docs/qa/PHASE1_VALIDATION.md) (Phase 1)
and this revision's validation run (Phase 5).

- `npm install`, `npm run typecheck`, `npm test` (213 tests), `npm run build` and
  `npm run check:offline` all pass.
- Boot -> title -> start -> controllable placeholder actor -> pause -> resume -> restart works
  end to end in a real browser against the production build. **(Phase 3)** Re-verified against the
  platform-controller-driven mover specifically: horizontal movement and jump were confirmed
  through real Arcade Physics (`vx`, `vy`, `onGround` read from the live debug snapshot), not
  just "no console error." **(Phase 4)** Re-verified again after `SystemHostImpl`'s constructor
  gained an optional validator parameter. **(Phase 5)** Re-verified again after the starter began
  supplying `packConfigValidator` through `createGame` and `SystemHostImpl` began verifying a
  pack's declared `provides` - see the Phase 5 browser-regression entry below.
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

- **(Phase 5)** Capability ids are namespaced `<family>.<service>`
  ([ADR-0011](docs/architecture/adr/0011-capability-id-governance.md)): `combat.health`,
  `ai.state`, `world.state`, `progression.state`, `arcade.score`, `puzzle.state`,
  `simulation.resources`, `narrative.state`, `strategy.turns`. Enforced by six assertions in
  `packages/packs/test/capabilityIds.test.ts` (pattern, no bare family names, uniqueness,
  vendor-prefixed pack ids, each pack provides exactly the id `ids.ts` records, no pack id reused
  as a capability id). No registry object exists; this is a convention plus a test.
- **(Phase 5)** Gameplay events are declared by the package that raises them
  ([ADR-0012](docs/architecture/adr/0012-gameplay-events-belong-to-their-package.md)).
  `@sw2d/contracts`' `GameEventMap` now holds the eight runtime lifecycle events only; the twelve
  Phase 4 pack events moved verbatim to `packages/packs/src/events.ts` via the declaration merging
  contracts' own doc comment has prescribed since Phase 1. Type-only: no payload, emit site,
  subscriber or assertion changed, and the production bundle is unaffected.
- **(Phase 5)** Pack config validation is a composition-root option
  ([ADR-0013](docs/architecture/adr/0013-composition-root-enforces-pack-declarations.md)):
  `createGame({ packConfigValidator })` threads through `PlayScene` to `SystemHostImpl`, and the
  starter supplies `@sw2d/schemas`' implementation. `@sw2d/runtime`'s dependency graph is
  unchanged - `PackConfigValidator` is a contracts interface and the import is type-only.
  A debug build warns, naming every pack whose `configSchemaId` is going unenforced, so silence
  is no longer a possible state. **Proven in a real browser against the production build**: the
  starter now boots with enforcement on and `starter.placeholder-mover` installs after its config
  is validated.
- **(Phase 5) Defect found and fixed.** `starter.placeholder-mover` declared
  `configSchemaId: 'starter/placeholder-mover.config.json'` - an id no schema in the repository
  carried - with the comment "enforced by the validator Sonnet builds in Phase 2," a phase that
  shipped without touching it. The declaration had been wrong since Phase 1 and was undiscoverable
  because nothing ever resolved it; turning enforcement on would have thrown
  `UnregisteredSchemaError` at boot. Fixed by giving the pack a real
  `starter/schemas/placeholder-mover-config.schema.json` (registered by the pack module, per
  ADR-0010) with meaningful constraints - a positive `jumpVelocity`, a zero `moveSpeed` or an
  unknown field is now rejected before install, asserted in `starter/test/packConfig.test.ts`
  (5 tests).
- **(Phase 5) Second defect found and fixed.** `starter.placeholder-mover` declared
  `provides: ['starter.player']` and never called `context.capabilities.provide()`.
  `resolveInstallOrder` satisfies another pack's `dependencies` from that declaration, so a
  dependent pack would have resolved cleanly and then failed inside its own `require()`, naming
  the wrong pack. `SystemHostImpl` now verifies after `install()` that every declared capability
  was published, failing with a named error through the existing rollback path; the starter drops
  the entry it never published rather than inventing a service no second system consumes.
  Covered by `packsComposition.test.ts`.
- **(Phase 5)** The Phase 3 teardown lesson is now locked at the host level, not just in prose:
  `packsComposition.test.ts` asserts that when one pack's `dispose()` throws, every other pack
  still disposes, every capability is still withdrawn and the host still empties. Previously only
  `DisposableBagImpl` had this coverage - `SystemHostImpl`, where the Phase 3 leak actually
  happened, had none.
- **(Phase 5)** `@sw2d/packs`' `sideEffects` field is truthful: `progressionPack.ts` and
  `arcadePack.ts` register their config schemas at module load, so `sideEffects: false` was wrong.
  No live failure was observed (importing the pack binding keeps the module), but a bundler is
  entitled to act on the declaration.
- **(Phase 5)** Browser regression re-run against the production build after the runtime and
  starter composition changes: boot -> title -> play -> movement (`vx` 220 walking, 385 dashing =
  220 x 1.75) -> jump (`vy` -430, the schema-validated config value, only when `onGround`) ->
  pause -> resume -> 8 pause-menu restarts -> quit-to-title -> fresh run. Zero console errors.
  Every counter flat across all 8 restarts (`input.adapters` 2, `context.disposables` 6,
  `scene.disposables` 1, installed packs 1) and the live Phaser GameObject count flat at 5;
  quit-to-title released every counter to zero. Frames were clocked manually via
  `game.loop.step(t)`, same pre-existing limitation as previous revisions.

- **(Phase 6)** Tiled JSON normalizes to a validated, semantic level document without touching
  Phaser: `@sw2d/content-pipeline`'s `normalizeTiledMap()` transforms `starter/content/levels/intro.json`
  into a `NormalizedLevel`, which `@sw2d/schemas`' `level-document.schema.json` then validates as a
  `ContentBundle.data['levels/intro']` document - the same two-stage gate `tuning.json` has had
  since Phase 2. 17 focused tests (`normalize.test.ts`) cover: tile-layer/solid/object
  normalization; the legacy `type` field as a class-name fallback; rejecting non-orthogonal
  orientation, infinite maps and unsupported layer types by name; rejecting an unknown object class
  in strict mode and skipping it (with a warning) when `strict: false`; rejecting a missing or
  wrong-typed required property, naming the object and property; rejecting malformed top-level
  structure.
- **(Phase 6)** The object-class catalog (`@sw2d/content-pipeline`'s `objectClasses.ts`) recognises
  all eighteen classes `MASTER_PROJECT.md` section 6 requires, plus `Solid` for collision/platform
  geometry - 7 tests, including that every required class is present and that a missing/mistyped
  required or optional property is rejected by name.
- **(Phase 6)** The entity registry (`@sw2d/packs`' tenth capability, `world.entities`,
  `entityRegistryPack`) dispatches a normalized object to a registered factory by class, rejects a
  duplicate registration (`DuplicateEntityFactoryError`), and returns `undefined` - not an error -
  for a recognised class with no registered factory. 6 tests in `entityRegistry.test.ts`; included
  in `capabilityIds.test.ts`'s governance suite alongside the nine Phase 4 packs.
- **(Phase 6)** The theme contract (`ThemeManifest` in `@sw2d/contracts`, validated by
  `theme-manifest.schema.json`) is proven by two real themes (`starter/content/themes/default`,
  `.../neon`) and `resolveTheme()`'s 7 unit tests, **plus a real-browser proof**: the Tiled-proof
  page (`tiled-proof.html`) loads either theme from a `?theme=` query parameter, resolves it to CSS
  custom properties on `document.documentElement`, and a same-scripted playthrough under both
  themes produced identical gameplay state (spawn `{x:60,y:478}`, `checkpointActive:
  "checkpoint-1"`, `collectiblesCollected: 1`, `hazardsTouched: 1` at the same world position) while
  `--sw2d-accent`/`--sw2d-bg` differed (`#65d0a8`/`#0b0d13` default vs `#ff5ad1`/`#0a0014` neon).
  `starter/test/tiledProofContent.test.ts` asserts the same thing without a browser: re-normalizing
  the level directly equals what `tiledProofContent.load()` produces, regardless of which theme is
  selected.
- **(Phase 6)** The known asset/UI schema gap (flagged in Phase 2, re-confirmed in Phase 5's gate
  report) is closed: `content-assets.schema.json`/`ui-copy.schema.json` now validate
  `ContentBundle.assets`/`.ui` for **both** starter games. `starter/src/content.ts` (the original
  foundation-slice content source) now calls `validateDocumentOrThrow('content-assets', ...)`/
  `('ui-copy', ...)` instead of a compile-time-only `satisfies`-then-cast; a malformed asset role or
  UI field now fails at the content boundary - asserted in `starter/test/content.test.ts`'s two new
  tests, and structurally true for the Tiled-proof page too (its theme's `assets`/`ui` are validated
  as part of the whole `theme-manifest` document).
- **(Phase 6)** `highContrast` now renders something real, closing a Phase 1-5 "persisted but
  unrendered" gap: `resolveTheme(theme, accessibility)` swaps a theme's `highContrastTokens` in for
  its base `tokens` exactly when `accessibility.highContrast` is true. **Verified live in a real
  browser**: `settings.patch({ highContrast: true })` changed `--sw2d-accent`/`--sw2d-bg`/
  `--sw2d-text` from the neon theme's own palette to `#ffe14d`/`#000000`/`#ffffff` (both themes
  share the same `highContrastTokens`), with the DOM touch-control panels visibly re-coloured in a
  screenshot at a 375x812 mobile viewport.
- **(Phase 6)** `AccessibilityStateImpl.refreshEnvironment()` has a real caller: `createGame`
  listens for `matchMedia('(prefers-reduced-motion: reduce)')`/`('(pointer: coarse)')` change
  events and re-projects accessibility state live, guarded like `readAccessibilityEnvironment()`
  itself and disposed through the existing `rootBag`. Unit-tested directly
  (`projection.test.ts`'s new test calls `refreshEnvironment()` and asserts the projection updates
  without a settings write); the `matchMedia` wiring itself is browser-only and covered by the
  Phase 6 browser regression, the same disclosure Phase 1's `visibilitychange`/`pointerdown`
  listeners already carry.
- **(Phase 6)** Reduced motion now suppresses a second, newly-introduced motion effect: the
  Tiled-proof page's touch-button active-state CSS transition (`--sw2d-motion-duration`, 120ms ->
  0ms). Verified live: `settings.patch({ reducedMotion: true })` set it to `0ms`. The original
  foundation-slice page (`index.html`/`main.ts`) is unchanged and still only honours reduced motion
  at the title prompt, per Phase 1-5's existing scope.
- **(Phase 6)** Resource governance is executable, not documentary: `validateResourceManifest()`
  (`@sw2d/schemas`) validates a manifest's shape (Ajv) plus duplicate-id, missing-`originalSource`
  and license-policy rules JSON Schema cannot express - 7 unit tests plus 2 tests running it against
  the real `docs/resources/VISUAL_ASSET_MANIFEST.json` (15 records, all `project-owned`/`generated`,
  covering every generated texture the foundation slice and both themes actually ship).
- **(Phase 6)** The Tiled-proof browser journey, run against the production build on port 4188 (not
  4173): boot -> title -> CONFIRM -> play -> player spawns at the level's `PlayerSpawn` object
  (`{x:60, y:478}` after settling, matching the Tiled object at `x:60,y:440`) -> walking right
  triggers, in order and from Tiled data alone: `Checkpoint` (`worldPack.activateCheckpoint`,
  `checkpointActive: "checkpoint-1"`), `Collectible` (`collectiblesCollected: 1`, the sprite
  destroyed), `Hazard` (`hazardsTouched: 1`, deduplicated by object id), `Exit`
  (`world.setFlag('level.cleared.exit-1', true)`, `cleared: true`) -> PAUSE -> resume -> 8
  consecutive pause-menu restarts, every listener count and the live Phaser GameObject count
  (10) flat throughout -> zero console errors -> `performance.getEntriesByType('resource')`
  returned only same-origin `localhost:4188` entries -> a 375x812 mobile viewport showed unclipped,
  correctly re-themed touch controls. The original foundation-slice journey (`index.html`) was
  re-run in full first and remains unchanged: `context.disposables` is now 7 (was 6), the expected
  +1 from the new `matchMedia` listener registration; every other counter, movement/jump values and
  the flat GameObject count (5) matched Phase 5's evidence exactly.

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
- **(Phase 4, superseded)** ~~`configSchemaId` enforcement is opt-in per `SystemHostImpl`
  instance and unenforced in the running starter~~ - closed in Phase 5 (ADR-0013): enforcement is
  now a `createGame` option, the starter supplies it, and the starter's pack has a real schema.
  Still true: only `progressionPack`, `arcadePack` and `starter.placeholder-mover` have config
  schemas; the other seven Phase 4 packs declare no `configSchemaId` (either no config, or -
  `puzzlePack` - config that is inherently non-serializable functions).
- Image-backed (`kind: 'image'`) assets - code path exists (`queueImageAssets`), still unused: both
  Phase 6 themes use `kind: 'generated'` exclusively, matching the project's no-binary-art baseline.
  The theme pipeline (Phase 6) now exists, but nothing has exercised the image-loading branch of it
  yet.
- **(Phase 2/5, closed in Phase 6)** ~~`starter/src/content.ts`'s `assets`/`ui` fields have no JSON
  Schema~~ - see the Phase 6 "known asset/UI schema gap" entry above.
- `InputDeviceAdapter.poll()` - unit-tested for call cadence; no polling device (gamepad) exists.
- `WebAudioBus.musicNode` - wired into the gain graph, nothing plays through it.
- `SaveStore.migrate` - unit-tested; never exercised against a real schema change.
- **(Phase 1-5, closed in Phase 6)** ~~`AccessibilityStateImpl.refreshEnvironment()` - no caller~~ -
  see the Phase 6 entry above. Still unverified: real OS-level `prefers-reduced-motion`/
  `pointer: coarse` *changing* mid-session on real hardware - only `refreshEnvironment()`'s direct
  unit test and the `matchMedia` API's existence were exercised, not a live OS preference flip.
- **(Phase 1-5, closed in Phase 6 for the Tiled-proof page only)** ~~`highContrast` - persisted and
  projected; nothing renders differently for it~~ - see the Phase 6 entry above. The **original**
  foundation-slice page (`index.html`) still renders nothing differently for `highContrast`; only
  `tiled-proof.html`'s theme/CSS layer projects it. Closing it for the foundation slice too was not
  required this phase and was not attempted, to avoid an unforced change to the Phase 1-5 proof.
- **(Phase 1-5, closed in Phase 6 for the Tiled-proof page only)** ~~Reduced motion is honoured by
  the title prompt only~~ - `tiled-proof.html`'s touch-button transition now honours it too (see the
  Phase 6 entry above). `index.html`/`main.ts` is unchanged and still only honours it at the title
  prompt.
- **(Phase 6)** Tile-*image* rendering: `normalizeTiledMap` records a tile layer's name and
  dimensions only; it does not read per-cell GID data, resolve a tileset, or draw tiles. Every
  visual/collidable surface in the Phase 6 proof comes from object-layer `Solid` rectangles. See
  [ADR-0014](docs/architecture/adr/0014-content-pipeline-and-entity-registry.md)'s "Rejected"
  section - a deliberate, documented scope boundary, not an oversight.
- **(Phase 6)** Thirteen of the nineteen object-class catalog entries (`Enemy`, `Powerup`,
  `Spring`, `Updraft`, `DashPanel`, `Trigger`, `CameraZone`, `MusicZone`, `DialogueTrigger`,
  `BossTrigger`, `SpawnZone`, `Objective`, `Interactable`) normalize and validate correctly (proven
  by `objectClasses.test.ts`) but have **no registered entity-registry factory anywhere** - the
  Phase 6 proof level only contains the five classes it actually demonstrates
  (`PlayerSpawn`/`Checkpoint`/`Collectible`/`Hazard`/`Exit`) plus `Solid`. Per the phase's own
  acceptance contract ("not every class needs full gameplay behaviour"), not a gap to close later
  without a real consumer.
- **(Phase 6)** `normalizeTiledMap`'s `strict: false` (skip-unknown-class) mode is unit-tested but
  has no real caller anywhere in the starter - both content sources use the default (`strict:
  true`). A bounded, already-implemented option for whichever phase first needs lenient ingestion.
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
- **Bundle size**: the shared chunk (`@sw2d/schemas` + Ajv/ajv-formats, now six more schemas) is
  1,544.26 kB minified / 407.61 kB gzip - essentially unchanged from Phase 5's 1.5387 MB / 407.08 kB
  (new JSON Schema documents are small relative to Ajv itself). Two page-specific chunks now exist:
  `main` (the foundation slice, 3.98 kB / 2.03 kB gzip - unchanged) and `tiledProof` (15.63 kB /
  5.32 kB gzip - `@sw2d/content-pipeline` plus `@sw2d/packs`' three installed packs plus
  `tiledLevelPack.ts`), both loading the same shared chunk. No code splitting beyond Vite's default
  multi-entry chunking. Acceptable for a self-contained static game; revisit only against a real
  target.
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
- **(Phase 4, answered in Phase 5)** ~~Whether combat/simulation/arcade/progression should share a
  bounded-counter primitive~~ - reviewed at the gate and **deferred with an explicit trigger**: a
  *third* family needing the same clamp **and** the same change-event shape, or the persistence
  phase needing one uniform serialization across all four. Same disposition for world's and
  narrative's flag stores (trigger: a third flag-store consumer, or shared persistence/query
  semantics). Judged on semantic stability, not line count: the events each family emits differ
  enough that a shared primitive would have to be event-agnostic, and therefore less useful than
  it looks. See `docs/architecture/PHASE5_ARCHITECTURE_GATE_A.md`.

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
    `PackConfigValidator` interface (ADR-0010), supplied at the composition root through
    `createGame({ packConfigValidator })` (ADR-0013).
18. Capability ids are namespaced `<family>.<service>` and never a bare family name (ADR-0011).
    Pack ids are vendor-prefixed and are never reused as capability ids.
19. `@sw2d/contracts`' `GameEventMap` holds runtime lifecycle events only. A gameplay event is
    declared by the package that raises it, through declaration merging (ADR-0012). Adding one
    must never require editing `@sw2d/contracts`.
20. A pack publishes every capability id it declares in `provides`, during `install()`
    (ADR-0013). `resolveInstallOrder` satisfies other packs' dependencies from that declaration,
    so it is a contract, not documentation.
21. `@sw2d/content-pipeline` owns Tiled ingestion and theme resolution and stays Phaser-free and
    Ajv-free (ADR-0014). Its object-class catalog is fixed at nineteen classes; add one only for a
    genuine second real consumer, not speculatively.
22. A theme document (`ThemeManifest`) carries only `assets`/`tokens`/`fonts`/`ui` - never
    gameplay, tuning or system-pack data (ADR-0014). `resolveTheme()` is the mechanical guarantee:
    it reads and returns only those four fields.

## Validation matrix

| Layer | State | Command |
|---|---|---|
| Static / schema | TypeScript passing; JSON Schema exists for 5 contract types + 1 content document + 6 Phase 6 content-pipeline documents (asset-descriptor, ui-copy, content-assets, theme-manifest, resource-record/-manifest, level-document) + 3 pack config schemas (progression, arcade, starter placeholder-mover) | `npm run typecheck` |
| Unit | 279 tests passing (58 Phase 1 + 29 Phase 2 + 35 Phase 3 + 78 Phase 4 + 13 Phase 5 + 66 Phase 6) | `npm test` |
| Build | passing (two-page build: `index.html` + `tiled-proof.html`) | `npm run build` |
| Offline (static guard) | passing | `npm run check:offline` |
| Runtime integration | proven manually in-browser, **not automated** | see ADR-0008 |
| Browser journeys | not automated; **both** starter pages re-verified manually this revision on port 4188 - the original boot/title/move/jump/pause/resume/8x-restart/quit/fresh-run journey (unchanged from Phase 5), and the new Tiled-proof journey (boot/title/play/spawn-from-level-data/checkpoint/collectible/hazard/exit/pause/resume/8x-restart/theme-swap/high-contrast/reduced-motion/mobile-viewport) | Phase 2+ (QA package still unbuilt) |
| Proof regression | none - no proof games exist | Phase 10 |
| Pack composition | real `SystemHostImpl` + `resolveInstallOrder` + `CapabilityRegistryImpl` installing all nine Phase 4 packs together, plus config-validation, declared-`provides` and throwing-teardown failure paths, automated | `packages/runtime/test/packsComposition.test.ts` |
| Capability-id governance | pattern, uniqueness and pack-id/capability-id split, automated for all ten packs including Phase 6's `entityRegistryPack` | `packages/packs/test/capabilityIds.test.ts` |
| Tiled/theme/resource content pipeline | normalization, object-class catalog, entity-registry dispatch, theme resolution and resource governance, all automated; the real `docs/resources/VISUAL_ASSET_MANIFEST.json` and the real `starter/content/levels/intro.json` are both exercised directly, not only synthetic fixtures | `packages/content-pipeline/test/**`, `packages/schemas/test/contentPipeline.test.ts`, `packages/schemas/test/resourceGovernance.test.ts`, `packages/packs/test/entityRegistry.test.ts`, `starter/test/tiledProofContent.test.ts`, `starter/test/resourceGovernance.test.ts` |

`npm run validate` runs typecheck + test + build + offline guard. All four passed this revision.

## Pending work

Phases 7-12 are unstarted. See `MASTER_PROJECT.md` §38 for the routed plan and owners.

## Next bounded action

**Phase 7A - Sonnet 5 - Preset Catalog Families A-C** (platforming, top-down action, shooter -
preset recipes 1-27).

Not executed this revision - Phase 6 explicitly stops before it. What Sonnet may assume, and what
is protected, going into Phase 7A:

- Package boundaries and dependency direction are settled through Phase 6: `@sw2d/contracts` keeps
  zero dependencies; `@sw2d/runtime` never imports a schema library or `@sw2d/content-pipeline`;
  `@sw2d/content-pipeline` stays Phaser-free and Ajv-free (ADR-0014).
- `GameContext` is **still closed** - Phase 6 added zero fields to it, the same negative-evidence
  pattern Phase 5's gate found for Phase 4. Level/theme/entity-registry work goes through the
  existing `content`/`assets` fields and the `world.entities` capability, not a new context field.
- A preset's `requiredContentRoles` can now legitimately include a level document
  (`levels/<id>`, validated against `level-document.schema.json`) and a theme
  (`theme-manifest.schema.json`) - both real, schema-validated document types a preset recipe can
  reference starting now.
- The object-class catalog is fixed at nineteen classes (protected invariant 21). If a preset family
  genuinely needs a twentieth, that is the second real consumer the deferral in ADR-0014 was
  written for - not a reason to add speculative classes ahead of one.
- Capability ids follow ADR-0011 and a test enforces it; the `world` family now has two members
  (`world.state`, `world.entities`) as ADR-0011 anticipated - a preset needing camera zones or
  transitions adds `world.camera-zones` etc. alongside them, not a new family.
- Do not build the Playwright/QA package; that is still its own phase.
- Do not attempt tile-*image* rendering (ADR-0014's explicit deferral) unless a preset family
  cannot be represented with `Solid`-object collision geometry - and if so, treat it as a genuine
  Opus-escalation-worthy architecture question (a new resource-governance and rendering path), not
  a Sonnet-local addition.

## Revision history

### Revision 6 - 2026-08-25 (Sonnet 5)
Phase 6 complete: Tiled, Theme, Accessibility, and Resource Pipeline. New package
`@sw2d/content-pipeline` (Tiled JSON normalization, the nineteen-class object-class catalog, theme
resolution - Phaser-free, Ajv-free, depends on `@sw2d/contracts` only) plus three new shared data
types in `@sw2d/contracts` (`NormalizedLevel`, `ThemeManifest`, `ResourceRecord`/`ResourceManifest`)
and a tenth `@sw2d/packs` capability, `world.entities` (`entityRegistryPack`), sitting alongside
`worldPack`'s `world.state` exactly where ADR-0011 reserved room for it. Full rationale:
[ADR-0014](docs/architecture/adr/0014-content-pipeline-and-entity-registry.md).

Closed the known asset/UI schema gap flagged in Phase 2 and re-confirmed in Phase 5's gate report:
six new `@sw2d/schemas` documents (`asset-descriptor`, `ui-copy`, `content-assets`,
`theme-manifest`, `resource-record`/`-manifest`, `level-document`) now validate `ContentBundle`'s
`assets`/`ui` fields and the new Tiled/theme/resource document types at the content boundary, the
same guarantee `game-definition`/`tuning` have had since Phase 2. Resource governance is now
executable (`validateResourceManifest`, duplicate-id/license-policy checks JSON Schema cannot
express) and proven against a real manifest, `docs/resources/VISUAL_ASSET_MANIFEST.json` (15
records covering every generated texture the project actually ships, all `project-owned`).

Built a real Tiled-JSON-to-playable-level pipeline: `starter/content/levels/intro.json` (a
hand-authored, valid Tiled export - ground + two platforms as `Solid` objects, `PlayerSpawn`,
`Checkpoint`, two `Collectible`s, a `Hazard`, an `Exit`) normalizes through
`@sw2d/content-pipeline`, validates through `@sw2d/schemas`, and drives an entirely new system pack,
`starter/src/game-specific/tiledLevelPack.ts` - a second worked example of the protected boundary
alongside `placeholderMoverPack.ts`, reading `platformController` intent exactly the same way, with
level layout, spawn point and every semantic object sourced from Tiled JSON rather than a
TypeScript coordinate array. Two tiny local themes (`default`, `neon`) prove theme/gameplay
separation: loading the same level under either theme produces byte-identical `ContentBundle.data`,
asserted directly (`starter/test/tiledProofContent.test.ts`) and confirmed live in a browser
(identical spawn position, checkpoint id, collectible/hazard counts across a scripted playthrough
under both themes, with only `--sw2d-accent`/`--sw2d-bg`/etc. differing). `highContrast` now
projects a real visual change for the first time since Phase 1 (theme `highContrastTokens`, browser
-verified live via `settings.patch`); reduced motion now suppresses a second motion effect (a touch
-button CSS transition); `AccessibilityStateImpl.refreshEnvironment()` finally has a caller
(`createGame` now listens for `matchMedia` change events, guarded and disposed the same way every
other environment-sourced listener in that file already is).

Deliberately shipped as a **second, separate static page** (`tiled-proof.html`, one more entry in
`starter/vite.config.ts`'s multi-page build) rather than a change to `index.html`/`main.ts`/
`placeholderMoverPack.ts` - MASTER_PROJECT.md section 8 explicitly allows a dedicated fixture, and
this way the already-verified Phase 1-5 browser journey carries zero risk from Phase 6's changes.
Proven: the full original journey (boot, title, movement `vx 220`/dash `385`, jump `vy -430` only
when grounded, pause, resume, 8 pause-menu restarts, quit-to-title, fresh run) was re-run against
the production build and matched Phase 5's evidence exactly, with one expected, explained change -
`context.disposables` is now 7 (was 6), the new `matchMedia` listener registration.

The Tiled-proof page's own journey was run in full against the production build (port 4188, not
4173): boot -> title -> play -> player spawns at the level's `PlayerSpawn` position -> walking
right triggers `Checkpoint`/`Collectible`/`Hazard`/`Exit` in sequence, each from Tiled data through
the entity registry, `Checkpoint` and `Exit` both driving Phase 4's previously-unwired `worldPack`
for the first real time -> pause -> resume -> 8 restarts with every listener count and the live
Phaser GameObject count (10) flat -> zero console errors -> only same-origin network requests -> a
375x812 mobile viewport showed correctly re-themed, unclipped touch controls.

66 new tests (279 total, up from 213): 10 Tiled normalization, 7 object-class catalog, 7 theme
resolution (`@sw2d/content-pipeline`); 6 entity registry (`@sw2d/packs`, plus inclusion in the
existing capability-id governance suite); 14 schema/type parity plus 7 resource-governance
(`@sw2d/schemas`); 2 asset/UI content-boundary rejection tests plus 10 Tiled-proof-content plus 2
real-manifest resource-governance tests (starter); 1 `refreshEnvironment()` unit test (runtime).
`npm run validate` passed (typecheck, 279 tests, two-page build, offline guard).

Object-class catalog is deliberately fixed at nineteen (the required eighteen plus `Solid`), not an
extensible registry - `@sw2d/content-pipeline` has exactly one real consumer this phase. Tile-*image*
rendering is explicitly out of scope and documented as such, not silently dropped: every
visual/collidable surface in the proof comes from object-layer `Solid` rectangles and the existing
generated-texture pipeline. `GameContext` reviewed and left unchanged - the entity registry, theme
resolution and resource governance all compose through existing `content`/`assets` fields and one
new capability id, adding zero fields, the same negative-evidence pattern the last two gates found.

### Revision 5 - 2026-08-25 (Opus 5)
Phase 5 complete. Architecture Integration Gate A: **PASS WITH TARGETED REPAIRS**
(`docs/architecture/PHASE5_ARCHITECTURE_GATE_A.md`). The Phase 1-4 boundaries hold in the actual
implementation, not just in the ADRs describing them - contracts dependency-free, runtime free of
a validator, packs depending on capability ids rather than modules, one host per scene owning
teardown, controllers stateless. Five defects were found, all the same shape: metadata declaring a
contract nothing evaluates, or a rule stated in a doc comment the code beside it does not follow.
All five repaired, none by rewriting anything: capability ids namespaced `<family>.<service>` plus
a governance test (ADR-0011, closing a live three-convention drift where flat `combat`/`world`
would have blocked Phase 6's own world systems and §9.7's fuller combat family); the twelve Phase 4
pack events moved out of `@sw2d/contracts` into `@sw2d/packs` via the declaration merging contracts
itself prescribes (ADR-0012, so raising an event no longer requires editing a protected package);
pack config validation promoted to a `createGame` option with a debug warning when a declared
schema is going unenforced (ADR-0013); `SystemHostImpl` now verifying that a pack publishes what
its `provides` declares (ADR-0013); and `@sw2d/packs`' `sideEffects` field made truthful. Two real
pre-existing defects surfaced through those repairs, both in the one running game:
`starter.placeholder-mover` declared a `configSchemaId` naming a schema that existed nowhere
(undiscoverable precisely because nothing resolved it - enforcement would have thrown at boot), and
declared a `provides` capability it never published (which `resolveInstallOrder` would have used to
satisfy a dependent pack). Both fixed. Lifecycle coverage gained the test the Phase 3 leak
deserved: one pack's `dispose()` throwing must not stop the others. `GameContext` reviewed and
explicitly left unchanged - nine new pack families across nine domains added zero fields, which is
the strongest evidence the surface is bounded. Shared-primitive extraction, the generic puzzle API
shape, the spatial pointer service and schema-as-data export were all deferred with named triggers
rather than built. `npm run validate` passed (typecheck, 213 tests, build, offline guard), and a
full browser regression against the production build (boot, title, movement, jump, dash, pause,
resume, 8 pause-menu restarts, quit-to-title, fresh run) showed zero console errors with every
counter and the live Phaser GameObject count flat.

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
