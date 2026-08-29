# Operational State

Project: **Stinky Weasel 2D Browser Game Factory** (`sw2d`)
Repository: `westkitty/2d_Game_Factory`
State revision: **14**
Updated: 2026-08-26

Read this before doing anything. Governing spec: [`MASTER_PROJECT.md`](MASTER_PROJECT.md).
Workflow: [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md).

---

## Current phase

**Phase 12 - Final Cross-System Acceptance and Cold-Start Gate - COMPLETE (Opus 5).**

**Phase 12 complete. Initial MASTER_PROJECT accepted.**

Final verdict: **Complete.** Full acceptance record, including the A01-A20 ledger, the F01-F13
failure-condition audit, the independent reconciliation of Phase 11's highest-risk claims, and the
repository-only cold-start challenge:
[`docs/architecture/PHASE12_FINAL_ACCEPTANCE.md`](docs/architecture/PHASE12_FINAL_ACCEPTANCE.md).

- **Pending work under MASTER_PROJECT: None.**
- **Next bounded action: None - the initial master contract is complete.**
- **No Phase 13 exists.** Future work requires a separately scoped task/project with its own
  acceptance contract.

Phase 12 was an evidence gate, not a feature phase. It ran the full validation ladder on the final
tree (`validate` PASS, `npm test` 1787/1787, `qa:smoke` 14/14, `qa:proof` 5/5, `qa:responsive`
19/19, `release:verify` 6/6, `qa:matrix` 40/40), independently re-derived the matrix's coverage of
all 74 presets (74 -> 37 runtime signatures -> 40 targets, 0 uncovered, all 6 `sw2d.puzzle` presets
individually targeted), and re-proved rather than re-read Phase 11's release, responsive,
reproducibility and cold-start claims - including verifying a packed artifact's checksums with the
standard system `shasum` tool and confirming tamper detection independently.

It used its one permitted targeted repair pass on three findings, all documentation/provenance-level
(no gameplay, no mechanics, no polish):

1. `docs/resources/CODE_RESOURCE_MANIFEST.json` - the record `resource-policy.json` designates as
   *the* machine-readable code-dependency inventory - omitted two real declared direct dependencies,
   `playwright-core@1.62.1` (Apache-2.0, `@sw2d/qa`) and `@types/node@24.13.3` (MIT, root), which
   MASTER_PROJECT section 20.2 requires a record for. Provenance was never *unknown*
   (`playwright-core` has been documented in `docs/architecture/DEPENDENCY_BASELINE.md` since Phase
   8) and no release artifact was ever wrong (shipped notices are mechanically derived and neither
   package ships) - the designated manifest simply disagreed by omission. Both recorded, the
   dev-tooling notices table extended, and `packages/cli/test/codeResourceManifest.test.ts` (6 new
   tests) now derives the required set mechanically from every workspace `package.json`, so the
   omission cannot recur. The guard was verified load-bearing by temporarily removing a record and
   watching it fail.
2. This document's "Current phase" section named `packages/cli/src/release/{checksums,notices}.ts`,
   a path Phase 11 renamed to `releasePackaging/` in the same commit. Corrected. The same path
   inside Revision 13's history entry was deliberately left unchanged as protected historical text.
3. The generated-runtime matrix had **no documented invocation anywhere** - no `npm run` alias, only
   a file path - so a cold-start agent could not discover how to run a mandatory acceptance command
   (and `npx tsx` fails here: `tsx` is not a dependency of this repository). Now
   `npm run qa:matrix`, documented in `README.md`, `docs/qa/QA_MATRIX.md` and
   `docs/handoff/COLD_START_HANDOFF.md`.

Unchanged by Phase 12, deliberately: the 5 `proof-validated` / 7 `smoke-validated` / 62 `recipe` /
0 `experimental` maturity split; the technical release state; `UNLICENSED`; unmeasured performance;
the physical-device-touch and gamepad unknowns; and every deferred optional capability with its
recorded trigger. No deployment, GitHub Release, package publication, or licensing decision was
performed.

---

**Phase 11 - Release, Hardening, Documentation, and Cold-Start Preparation - COMPLETE (Sonnet 5).**

Full report: [`docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md`](docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md);
cold-start entry point: [`docs/handoff/COLD_START_HANDOFF.md`](docs/handoff/COLD_START_HANDOFF.md);
QA command reference: [`docs/qa/QA_MATRIX.md`](docs/qa/QA_MATRIX.md).

Phase 11 was not a feature-expansion phase - no new genre mechanics, no spatial pointer, no
gamepad, no new controller families. It made the existing factory release-verifiable,
mobile-hardened, and recoverable by a new agent with no chat memory:

- **Release packer hardened** (`sw2d pack`, `packages/cli/src/commands/pack.ts`): a per-game
  `resources/RESOURCE_MANIFEST.json` (new - `generateResourceManifest()`) now records every
  generated game's placeholder assets as honestly project-owned/generated, and `pack` validates it
  against `resource-policy.json` *before* building - a missing, invalid, or non-`approved` record
  blocks release packaging outright. A successful pack now also writes a deterministic
  `RELEASE_MANIFEST.json`, a SHA-256 `SHA256SUMS` (`packages/cli/src/releasePackaging/checksums.ts`),
  and a mechanically-derived `THIRD_PARTY_NOTICES.txt` (`packages/cli/src/releasePackaging/notices.ts`, walks the
  real `@sw2d/*` → npm dependency graph rather than hand-listing packages). Proven via
  `npm run release:verify`: 6/6 controller-shell families (fresh-generate → validate → pack →
  verify manifest/checksums/resources → serve the packed dir through real Chrome → enter play →
  verify every declared pack installs → zero console errors/external requests), plus one candidate
  packed twice from identical source and diffed byte-identical.
- **A real, confirmed responsive/mobile defect was found and fixed**, not merely tested for: the
  new `npm run qa:responsive` (19 committed surfaces × 375x812 portrait / 844x390 landscape, real
  Chromium touch/coarse-pointer emulation) failed 0/19 on its first run - `#app`'s `min-height:
  100%` never gave the flex column a *definite* height, so the canvas's percentage-based
  `max-height` never resolved and Phaser's `Scale.FIT` (`packages/runtime/src/core/createGame.ts`)
  measured its parent's box before the browser's own layout had settled, sizing/centering the
  canvas for the wrong box (touch controls clipped off-screen in landscape on every one of the 19
  surfaces). Fixed with two small, well-scoped changes propagated identically to all 18 committed
  `styles.css` copies plus the CLI template, and one `requestAnimationFrame(() => game.scale.
  refresh())` in the shared runtime: `#app { height: 100% }` (was `min-height`) and
  `requestAnimationFrame(() => game.scale.refresh())` after game construction. Re-ran
  `qa:responsive` (19/19 pass), then the full regression ladder since this touched shared runtime
  code and every generated game's CSS: 1781 unit tests, `qa:smoke` 14/14, `qa:proof` 5/5,
  generated-runtime matrix 40/40 - all still green.
- **A stale/inaccurate `THIRD_PARTY_NOTICES.md` was found and corrected**: it claimed "Phaser is
  the only third-party code in the shipped artefact", but `@sw2d/schemas` (a `dependencies` entry
  of every generated game) imports `ajv`/`ajv-formats` at runtime (`validateDocumentOrThrow`,
  `packConfigValidator`), both of which are present in the actual built bundle
  (`grep ajv starter/dist/assets/*.js` confirms it). Corrected in both
  `docs/resources/THIRD_PARTY_NOTICES.md` and `docs/resources/CODE_RESOURCE_MANIFEST.json`, and
  guarded going forward by `packages/cli/test/notices.test.ts` plus `pack`'s own
  mechanically-derived notices, so this class of drift cannot recur silently.
- **`OPERATIONAL_STATE.md`'s current-state sections were reconciled** against Phase 8-10 evidence
  that had already superseded them but was never removed - see Revision 13 below for the exact
  stale claims closed.
- Cold-start documentation, a clean-build reproducibility proof, release-readiness documentation,
  and the Phase 12 handoff packet were all produced this phase; see the linked documents above.

Next owner at the time Phase 11 closed: **Opus 5, Phase 12** (Final Cross-System Acceptance and
Cold-Start Gate) - since executed and complete; see the Phase 12 block above.

## Current baseline

| Item | Value |
|---|---|
| Branch | `main` |
| Workspaces | `@sw2d/contracts`, `@sw2d/content-pipeline`, `@sw2d/runtime`, `@sw2d/schemas`, `@sw2d/packs`, `@sw2d/presets`, `@sw2d/cli`, `@sw2d/qa`, `@sw2d/starter`, plus `games/*` (generated, gitignored) and `demos/*` (twelve committed representative demos) |
| Node (supported) | `>=22.12.0`; target 24.x LTS (`.nvmrc` = 24) |
| Node (dev host used) | 26.7.0, npm 11.19.0 |
| Phaser | 4.2.1 (MIT) |
| TypeScript | 7.0.2 (Apache-2.0) |
| Vite | 8.2.2 (MIT) |
| Vitest | 4.1.11 (MIT) |
| Ajv | 8.20.0 (MIT) |
| ajv-formats | 3.0.1 (MIT) |
| @types/node | 24.13.3 (MIT, dev-only) |
| playwright-core | 1.62.1 (Apache-2.0, dev-only, no bundled browser download) |
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
- **(Phase 7A)** `@sw2d/presets` exists with exactly 27 registered `PresetDefinition` recipes -
  Family A Platforming (10), Family B Top-down action (10), Family C Shooter (7), the exact ids
  MASTER_PROJECT.md section 21 names, in deterministic catalog order. Every recipe is
  `maturity: 'recipe'`; every recipe schema-validates against `preset-definition:v1` and passes
  `validatePresetComposition`; every referenced pack id is real and every recipe's full
  required+optional selection set resolves through the real, unduplicated `resolveInstallOrder`;
  every referenced controller family is one of the six real ones; no recipe claims `gamepad`
  input support. 232 tests across seven files in `packages/presets/test/`.
- **(Phase 7A)** The Phase 5 pack-metadata/Ajv deferred trigger fired, twice, and was closed both
  times with an additive `package.json` "exports" subpath pointing at an already-existing,
  genuinely side-effect-free file - no metadata duplication, no new abstraction. `@sw2d/packs`
  gained `./ids` (`PACK_IDS`/`CAPABILITY_IDS`, zero imports); `@sw2d/runtime` gained
  `./composition` (`resolveInstallOrder`, Phaser-free but previously reachable only through the
  Phaser-loaded barrel - confirmed by a test that failed with `window is not defined` before the
  fix). `@sw2d/presets`' own `package.json` proves the resulting shape declaratively:
  `dependencies` is exactly `@sw2d/contracts` + `@sw2d/packs`; `@sw2d/schemas`/`@sw2d/runtime` are
  `devDependencies`, used only by tests. Full rationale:
  [ADR-0015](docs/architecture/adr/0015-preset-catalog-and-pack-metadata-boundary.md).
- **(Phase 7A)** A shared starter-materialization path (`materializeStarterPlan`) exists and is
  pure/deterministic: all 27 recipes reshape into a `StarterPlan` (identity, controllers, both
  pack lists, content roles, starter scene, validation profile) through the same function, proven
  by `packages/presets/test/materialize.test.ts`. This is the contract Phase 8's file-generating
  CLI will consume - not itself a CLI, and not a functional demo.
- **(Phase 7A)** `docs/presets/PRESET_CATALOG.md` and `docs/presets/PRESET_CAPABILITY_MATRIX.md`
  were generated directly from a real catalog dump (not hand-typed) and are kept from drifting by
  `packages/presets/test/docsSync.test.ts`, which asserts every preset id, display name, and
  referenced pack/validation-profile string still appears in both files.
- **(Phase 7B)** `@sw2d/presets` extended from 27 to exactly 49 recipes - Family D Vehicle/
  movement (5), Family E Puzzle/arcade (10), Family F Strategy/defense (7), the exact ids
  MASTER_PROJECT.md section 4 names, appended after the untouched Phase 7A 27
  (`packages/presets/test/catalog.test.ts` asserts the first 27 entries are byte-identical in id
  and order to the Phase 7A list). Every new recipe is `maturity: 'recipe'`, schema-valid, passes
  `validatePresetComposition`, references only real pack ids and real controller families, and
  resolves through the real `resolveInstallOrder` against the real ten pack definitions - `aiPack`'s
  one real dependency (`combat.health`) is honoured by every recipe selecting `sw2d.ai` anywhere.
  `sw2d.strategy` and `sw2d.simulation` had zero Family A-C consumers (Phase 7A's own "Known
  failures/gaps" entry); Family F is `sw2d.strategy`'s first real consumer (four recipes:
  `auto-battler`, `simple-rts`, `turn-based-tactics`, `territory-control`) - `sw2d.simulation`
  remains unreferenced, honestly noted in `docs/presets/PRESET_CAPABILITY_MATRIX.md` as belonging
  to a genre Phase 7C registers. 179 new tests across the existing seven `packages/presets/test/`
  files (no new test files - Phase 7A's suites are already generic over `PRESETS` and needed only
  their hardcoded id/count/profile expectations updated).
- **(Phase 7B)** Three new validation profiles registered (`vehicle-movement-recipe`,
  `puzzle-arcade-recipe`, `strategy-defense-recipe`), bringing the bounded total to six - still one
  per registered family, never one per recipe (MASTER_PROJECT.md section 14/6, unchanged rule).
- **(Phase 7B)** The ADR-0015 package boundary held with zero changes: no new subpath was needed,
  no barrel was imported, `@sw2d/presets`' `package.json` dependency shape
  (`@sw2d/contracts` + `@sw2d/packs`'s `./ids` subpath only, in production code) is unchanged and
  still proven by `packages/presets/test/packageBoundary.test.ts`. Confirmed by evidence, not
  assumption: `npm run build`'s emitted chunk hashes are byte-identical to Phase 7A's.
- **(Phase 7B)** `materializeStarterPlan` and both preset docs now cover all 49 recipes, still
  through the exact same code path Phase 7A wrote - no second materializer, no second doc
  generator. `docs/presets/PRESET_CATALOG.md` and `PRESET_CAPABILITY_MATRIX.md` were regenerated
  from a fresh 49-entry catalog dump (not hand-edited into their Phase 7A shape), grouped by family
  with a "(Phase 7A)"/"(Phase 7B)" label per section.
- **(Phase 7C)** `@sw2d/presets` reaches its final size: 74 presets, exactly the catalog
  MASTER_PROJECT.md section 21 names, no more and no fewer. Family G Simulation/management (8),
  Family H Narrative/exploration (7), Family I Party/toy/weird (10) - the exact ids section 4
  names - appended after the untouched Phase 7A+7B 49
  (`packages/presets/test/catalog.test.ts` asserts the first 49 entries are byte-identical in id
  and order to the frozen Phase 7A/7B list). Every new recipe is `maturity: 'recipe'`, schema-valid,
  passes `validatePresetComposition`, references only real pack ids and real controller families,
  and resolves through the real `resolveInstallOrder`. No recipe in Family G/H/I selects `sw2d.ai`
  - MASTER_PROJECT.md section 9's explicit instruction not to select AI "merely to simulate
  customers/animals if the current AI capability does not actually represent those behaviors" -
  so the `aiPack`-requires-`combatPack` rule has no new cases to satisfy this phase. 279 new tests
  across the existing seven `packages/presets/test/` files (no new test files, the third phase in a
  row to extend rather than duplicate the suites).
- **(Phase 7C)** `sw2d.simulation` - the one pack with zero preset consumers through Phase 7A and
  7B - now has 9 required and 10 total (required + optional) consumers, all in Family G, whose
  identity is genuinely "a resource ledger plus timed jobs" (`simulationPack`'s own scope). **All
  ten current packs now have at least one preset consumer** -
  `docs/presets/PRESET_CAPABILITY_MATRIX.md`'s "Full pack-consumer coverage" table reports the
  exact required/total count for every pack across all 74 recipes, not just a pass/fail claim.
- **(Phase 7C)** Three new validation profiles registered (`simulation-management-recipe`,
  `narrative-exploration-recipe`, `party-toy-weird-recipe`), bringing the bounded total to nine -
  exactly one per registered family, matching the nine families exactly, and the catalog's own
  final size (MASTER_PROJECT.md section 14/6/8, unchanged rule applied a third time).
- **(Phase 7C)** The ADR-0015 package boundary held with zero changes for the third phase running:
  no new subpath, no barrel import, `@sw2d/presets`' `package.json` dependency shape unchanged and
  still proven by `packages/presets/test/packageBoundary.test.ts`. `npm run build`'s emitted chunk
  hashes are byte-identical to Phase 7B's.
- **(Phase 7C)** `materializeStarterPlan` and both preset docs now cover the complete 74-preset
  catalog, still through the exact same code path Phase 7A wrote. `docs/presets/PRESET_CATALOG.md`
  and `PRESET_CAPABILITY_MATRIX.md` were regenerated from a fresh 74-entry catalog dump, grouped by
  family with a "(Phase 7A/7B/7C)" label per section; the capability matrix gained a dedicated
  "Full pack-consumer coverage" table (required-count and total-reference-count per pack) that did
  not exist before this phase, since Phase 7A/7B never had a reason to report full coverage while a
  zero-consumer pack remained.

## Implemented but unverified

These exist in source and type-check, but have **no** executed evidence yet. Do not treat as
working.

- **(Phase 2, partially closed in Phase 7A)** ~~`PresetDefinition` - no preset instance exists
  yet~~ - 27 now exist (`@sw2d/presets`), schema-valid, composition-valid, and their real pack
  selections are proven to resolve through the real `resolveInstallOrder`
  (`packages/presets/test/catalogPackIntegrity.test.ts`). Still true: nothing in the runtime or
  the starter *consumes* a `PresetDefinition` yet - no generated game has ever been composed from
  one. That is Phase 8's job (the file-generating CLI), not Phase 7A's.
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
- **(Phase 7A/7B/7C, closed)** ~~Every current pack is now selected by at least one recipe except
  `sw2d.simulation`~~ - closed in Phase 7C: Family G gives `sw2d.simulation` 9 required consumers.
  **All 74 presets are `maturity: 'recipe'`** and stay that way, by design - a registered recipe is
  not a smoke-validated genre or a proof-validated one (MASTER_PROJECT.md section 5). None has
  generated an actual starter shell (no file-generating CLI exists - Phase 8), none has been
  smoke-tested in a browser (12 representative demos - also Phase 8), and none has an end-to-end
  proof journey (five deep proofs - Phase 10).
- **(Phase 7A/7B/7C)** `materializeStarterPlan`'s output (`StarterPlan`) has never been consumed by
  anything that writes a file or renders content - proven only to be pure, deterministic, and
  structurally complete for all 74 recipes. Whether its shape is actually sufficient for Phase 8's
  CLI to generate a running game is untested until Phase 8 tries.

## Known failures / gaps

- **(Phase 2, closed in Phase 8/9)** ~~The browser journey is not automated. It was driven
  manually and does not re-run on commit~~ - closed. Every committed surface now runs through
  real system Chrome on every `npm run qa:smoke`/`qa:proof`/`release:verify`/`qa:responsive`
  invocation, not a manual script run once by hand: 14 smoke targets (12 demos + 2 starter
  pages), 5 deep proofs, 6 fresh-generated release candidates (one per controller-shell family),
  and 19 surfaces across two viewport contexts (Phase 11). See ADR-0008 for the original decision
  record and the Validation matrix below for current commands. Frame stepping is deterministic
  (`packages/qa/src/harness.ts`'s virtual clock, hand the loop a fixed 16.67ms step per frame) -
  that proves repeatable *behaviour*, never wall-clock performance; **FPS/frame-pacing under real
  wall-clock timing remains genuinely unmeasured** (moved to Unknown below, where an unmeasured
  fact belongs rather than a "known failure" - automation itself is no longer a gap).
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

- **(Phase 2, superseded in Phase 8)** ~~Whether Phaser 4 can run headlessly under Vitest well
  enough to automate the journey without degrading product code~~ - a different path was taken
  instead of answering this directly: `@sw2d/qa` drives a real, visible-headed-capable system
  Chrome via `playwright-core` (`packages/qa/src/harness.ts`), not headless Vitest. That closes
  the automation gap this question was blocking without needing an answer to the original
  question, which remains untried and moot.
- **Real wall-clock performance/FPS is unmeasured.** Every automated browser journey
  (`qa:smoke`/`qa:proof`/`release:verify`/`qa:responsive`) uses the QA harness's deterministic
  fixed-step clock (`stepFrames()`, a fixed 16.67ms per stepped frame) - that proves repeatable
  *behaviour*, not real-time frame pacing. No FPS claim exists anywhere in this repository's QA
  evidence, and Phase 11 explicitly did not add one (out of scope by its own instructions).
- Real-device touch behaviour; only synthetic touch-type pointer events (Chromium's
  `hasTouch`/`isMobile` emulation, Phase 1's original manual pass, and Phase 11's `qa:responsive`
  suite) have been exercised. No physical phone or tablet has touched this factory's output.
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
23. `@sw2d/presets`' production code depends on `@sw2d/contracts` and `@sw2d/packs`'s
    side-effect-free `./ids` subpath only - never `@sw2d/schemas`, never `@sw2d/runtime`, never
    either package's main barrel (ADR-0015). A package needing one pure export from a Phaser/Ajv-
    loaded barrel gets a named subpath pointing at the real file, not a metadata mirror.

## Validation matrix

| Layer | State | Command |
|---|---|---|
| Static / schema | TypeScript passing; JSON Schema exists for 5 contract types + 1 content document + 6 Phase 6 content-pipeline documents (asset-descriptor, ui-copy, content-assets, theme-manifest, resource-record/-manifest, level-document) + 3 pack config schemas (progression, arcade, starter placeholder-mover); all 74 presets validate against `preset-definition:v1` | `npm run typecheck` |
| Unit | 1787 tests passing (58 Phase 1 + 29 Phase 2 + 35 Phase 3 + 78 Phase 4 + 13 Phase 5 + 66 Phase 6 + 232 Phase 7A + 179 Phase 7B + 279 Phase 7C + 620 Phase 8 + Phase 9/10 additions + 17 Phase 11 - checksums, per-game resource manifest, mechanically-derived shipped-dependency resolution + 6 Phase 12 - code-dependency provenance completeness, derived mechanically from every workspace `package.json`) | `npm test` |
| Build | passing (two-page build: `index.html` + `tiled-proof.html`) | `npm run build` |
| Offline (static guard) | passing | `npm run check:offline` |
| Release packaging | `sw2d pack` produces a self-contained static pack with a deterministic `RELEASE_MANIFEST.json`, SHA-256 `SHA256SUMS`, and mechanically-derived `THIRD_PARTY_NOTICES.txt`; blocks packaging on missing/invalid/non-approved per-game resource manifests; one candidate proven byte-identical across two packs from identical source (Phase 11) | `npm run sw2d -- pack <game-id>` |
| Release verification matrix | **6/6 controller-shell families pass**: fresh-generate → validate → pack → verify manifest/checksums/resource state → serve the packed dir (not `dist/`) through real Chrome → enter play → verify every declared pack installs → zero console errors → zero external requests (Phase 11) | `npm run release:verify` |
| Responsive/mobile | **19/19 committed surfaces pass** at 375x812 portrait and 844x390 landscape (coarse-pointer/touch emulation via Chromium, not real hardware): no page overflow, canvas fits its box, touch controls visible/unclipped/>=44x44 (project standard 56x56), no duplicate DOM nodes across an in-page viewport switch, zero console errors. Found and fixed one real shared defect this way (see Revision 13) (Phase 11) | `npm run qa:responsive` |
| Runtime integration | proven manually in-browser **and** automated via real Chrome (Phase 8) | see ADR-0008, `@sw2d/qa` |
| Browser journeys | **automated for the first time this revision**: both starter pages (boot/title/play, movement, pause/resume, restart, and - for `tiled-proof.html` - a full Tiled-sourced checkpoint/collectible/hazard/exit walk) run through real system Chrome via `packages/qa/specs/starterFoundation.ts`/`starterTiledProof.ts`, replacing the manual checklist `docs/qa/PHASE1_VALIDATION.md` originally described | `npm run qa:smoke` |
| Demo smoke (12 representative demos) | **all 12 pass real-browser smoke** - one demo per genre family, each proving its preset's defining mechanic via a committed Playwright spec against a real production build | `npm run qa:smoke`, `packages/qa/specs/*.ts`, see `docs/demos/DEMO_MATRIX.md` |
| Factory CLI | 9 commands (`doctor`, `list-presets`, `describe`, `new`, `add-level`, `add-theme`, `validate`, `build`, `pack`), all manually and automatically exercised; `new`'s determinism and per-preset content validity proven for all 74 presets, real build evidence for a 13-instance representative matrix (12 demos + the one uncovered controller-family class) | `packages/cli/test/**`, `tools/scripts/build-matrix.ts`, `docs/cli/CLI_REFERENCE.md` |
| Proof regression | **5/5 deep end-to-end proof games pass** (Phase 10's bar, distinct from Phase 8's smoke bar) | `npm run qa:proof`, `docs/proofs/PROOF_MATRIX.md` |
| Generated-runtime matrix | **40/40 generated games really entered play** - each really generated, `tsc`-checked, `vite build`-ed, then served and driven in real Chrome (CONFIRM -> `sw2d.play`, every required pack plus the shell pack installed, zero console errors). Mechanically covers all 74 presets: 74 -> 37 distinct `(controller shell, required-pack set)` signatures -> 40 targets (37 representatives + every `sw2d.puzzle` preset individually), 0 presets uncovered - independently re-derived at the Phase 12 gate | `npm run qa:matrix` |
| Pack composition | real `SystemHostImpl` + `resolveInstallOrder` + `CapabilityRegistryImpl` installing all ten packs together, plus config-validation, declared-`provides` and throwing-teardown failure paths, automated | `packages/runtime/test/packsComposition.test.ts` |
| Capability-id governance | pattern, uniqueness and pack-id/capability-id split, automated for all ten packs including Phase 6's `entityRegistryPack` | `packages/packs/test/capabilityIds.test.ts` |
| Tiled/theme/resource content pipeline | normalization, object-class catalog, entity-registry dispatch, theme resolution and resource governance, all automated; the real `docs/resources/VISUAL_ASSET_MANIFEST.json` and the real `starter/content/levels/intro.json` are both exercised directly, not only synthetic fixtures | `packages/content-pipeline/test/**`, `packages/schemas/test/contentPipeline.test.ts`, `packages/schemas/test/resourceGovernance.test.ts`, `packages/packs/test/entityRegistry.test.ts`, `starter/test/tiledProofContent.test.ts`, `starter/test/resourceGovernance.test.ts` |
| Preset catalog integrity | **complete**: exact shape (74/74, exact ids, family counts, deterministic order), schema/composition validation, real pack-id and controller-family checks, real `resolveInstallOrder` dependency resolution, maturity/gamepad/limitation honesty, deterministic materialization, docs-sync, full pack-consumer coverage, **exactly 5 presets `proof-validated` (Phase 10's five deep proofs), 7 `smoke-validated` (the remaining Phase 8 demo ids), 62 `recipe`, 0 `experimental`**, all automated | `packages/presets/test/**` |

`npm run validate` runs typecheck + test + build + offline guard. `npm run qa:smoke` runs the
14-target real-browser suite (12 demos + 2 starter journeys) separately - it is not part of
`npm run validate` because it builds every demo fresh and launches a real browser, which is
proportionate to run on demand, not on every typecheck. All passed this revision.

## Pending work

**None.** Phase 12 is complete and the initial MASTER_PROJECT contract is accepted - see
[`docs/architecture/PHASE12_FINAL_ACCEPTANCE.md`](docs/architecture/PHASE12_FINAL_ACCEPTANCE.md)
for the full A01-A20 / F01-F13 evidence ledger. All twelve routed phases in `MASTER_PROJECT.md` §38
have been executed.

## Next bounded action

**None - the initial MASTER_PROJECT contract is complete.**

Phase 12 accepted it at the final gate; the full evidence ledger is
[`docs/architecture/PHASE12_FINAL_ACCEPTANCE.md`](docs/architecture/PHASE12_FINAL_ACCEPTANCE.md).
**No Phase 13 exists.** Future work requires a separately scoped task/project with its own
acceptance contract - it is not a continuation of this plan.

What "complete" does and does not mean, so nobody has to infer it:

- It **does** mean every one of MASTER_PROJECT.md section 54's twenty criteria is satisfied and
  evidenced, and none of section 46's thirteen failure conditions is present.
- It **does not** mean every possible mechanic exists, every preset is proof-validated, real-device
  performance is benchmarked, or public licensing is granted.

Carried forward unchanged, and all explicitly non-blocking against the master contract (each
adjudicated individually in the Phase 12 acceptance document):

- Spatial pointer, a universal puzzle DSL, a shared grid-cursor abstraction, tile-image rendering,
  the image-backed asset branch, and content-role schemas beyond `tuning`/`levels` all remain
  deferred with the same triggers Phase 9 recorded. Phase 12 fired none of them; it was an
  evidence gate, not a feature phase.
- Performance/FPS under real wall-clock timing remains **unmeasured**; deterministic frame stepping
  is determinism evidence only, never a performance claim. No FPS number appears anywhere in this
  repository, and Phase 12 added none.
- Real-device touch remains **unverified**: `qa:responsive` emulates touch/coarse-pointer via
  Chromium, which is not a physical phone or tablet. Closing it needs hardware, not code.
- Gamepad feasibility against the current `InputDeviceAdapter` shape remains **untried**. No preset
  claims gamepad support, and the catalog honesty test enforces that.
- Exact Node 24.x execution remains an explicit unverified compatibility detail. Phase 12 ran on
  Node v26.7.0 (the only line on the host), inside the documented `>=22.12.0` supported range; no
  runtime was downloaded solely to tick a box.
- Do not implement any of the missing mechanics named across the 62 `recipe` presets'
  `knownLimitations` merely because the project is accepted (MASTER_PROJECT.md section 23
  unchanged, section 47's anti-overengineering rules unchanged).
- The project software license remains the explicit, unresolved **user** decision it has always
  been: `UNLICENSED`. The factory is technically release-ready (see
  [`docs/release/RELEASE_READINESS.md`](docs/release/RELEASE_READINESS.md)); it is **not** cleared
  for public distribution, and no phase chose a license or claimed redistribution authorization.
- `games/`, `demos/*/dist|pack|node_modules` and `proofs/*/dist|pack|node_modules` all stay
  gitignored; Phase 12 added no exception.

## Revision history

### Revision 21 - 2026-08-29 (Sonnet 5) - Capability program Phase 6

**Data-driven puzzle rules (ADR-0023).** Sixth phase of the ten-phase program. Full detail in
[`docs/architecture/CAPABILITY_PROGRAM_STATE.md`](docs/architecture/CAPABILITY_PROGRAM_STATE.md).

- **New capability.** `sw2d.puzzle-rules` pack -> `puzzle.rules`, alongside (not replacing)
  `sw2d.puzzle` / `puzzle.state`. `PuzzleRules` is a **bounded discriminated union** of five
  built-in kinds (`sokoban`, `switch-sequence`, `match`, `falling-block`, `physics-goal`) with a
  fixed `PuzzleOp` vocabulary - not a DSL. `content/puzzles.json` (schema `puzzle-rules`,
  document `puzzles`) is always emitted; one small pure engine per kind owns
  `load`/`apply`/`undo`/`reset`/`isSolved`/`snapshot`. Renderer-neutral, no new dependency.
  `main.ts` + `content.ts` templates load it; `gridShellPack` / `platformShellPack` consume it
  when present. Fifteen packs now.
- **Proofs.** `proofs/sokoban/` revised - the whole push/goal ruleset is now the validated
  `content/puzzles.json` document (`packConfig.ts` is `{}`); frozen `PROOF_CONTRACT.md` revised.
  New `proofs/puzzle-platformer/` - a `switch-sequence` gate (switch set, `a`->`d` link,
  press-order completion) driven from the same document by a platform shell. `qa:proof`
  14/14 -> 15/15.
- **Limitations.** `LIMITATIONS.puzzleConfigIsCode` removed from `sokoban` (now
  `knownLimitations: []`, stays `proof-validated`) and `puzzle-platformer`; rewritten to be
  accurate for `match-puzzle` / `falling-block-puzzle` / `physics-puzzle` / `escape-room`, which
  keep it for a kind the union does not cover. Maturity split unchanged (5/7/62).
- **Validation:** typecheck PASS; `npm test` 2299/2299; builds + `check:offline` PASS; `qa:proof`
  15/15; `qa:matrix` / `qa:starter-kits` / `release:verify` - see the ledger.

### Revision 20 - 2026-08-29 (Sonnet 5) - Capability program Phase 5

**Navigation & pathfinding (ADR-0022).** Fifth phase of the ten-phase program. Full detail in
[`docs/architecture/CAPABILITY_PROGRAM_STATE.md`](docs/architecture/CAPABILITY_PROGRAM_STATE.md).

- **New capability.** `sw2d.navigation` pack -> `world.navigation` - deterministic project-owned
  A* + Dijkstra reachable-range flood, renderer-neutral, no new dependency. `NavGrid`:
  `findPath` (stable tie-breaking, diagonal + corner-cutting options), `reachable(from, budget)`,
  dynamic `setWalkable` / `setCost`, `defineGridFromSolids`. `createRouteFollower` /
  `advanceAlongPath` (pure) in `@sw2d/contracts`. No content doc / schema (grids derive from
  level data); `main.ts` template gains `navigationPack`. Fourteen packs now.
- **Proofs.** New `proofs/turn-based-tactics/` (deterministic reachable movement range + route
  following) and `proofs/lane-defense/` (continuous route-following + dynamic re-path, a
  route-destroying blocker rejected). `qa:proof` 12/12 -> 14/14.
- **Limitations.** Pathfinding limitations removed/narrowed on `tower-defense`,
  `turn-based-tactics`, `lane-defense`, `simple-rts`, `colony-lite`; `LIMITATIONS.stealthAi`
  narrowed (patrol navigation now covered). `tower-defense` proof keeps its hand-authored route
  (nav retrofit deferred). Maturity split unchanged (5/7/62).
- **Validation:** typecheck PASS; `npm test` 2198/2198; builds + `check:offline` PASS; `qa:proof`
  14/14; `qa:matrix` / `qa:starter-kits` / `release:verify` - see the ledger.

### Revision 19 - 2026-08-29 (Sonnet 5) - Capability program Phase 4

**Combat / encounter orchestration (ADR-0021).** Fourth phase of the ten-phase program. Full
detail in [`docs/architecture/CAPABILITY_PROGRAM_STATE.md`](docs/architecture/CAPABILITY_PROGRAM_STATE.md).

- **New capability.** `sw2d.encounters` pack -> `combat.encounters` (renderer-neutral
  `EncounterService`: phases, spawn groups with `point`/`rect`/`edge` spawn points, bounded
  `FirePattern` emitters - aimed/fixed/fan/ring/spiral/sweep - via the pure `expandFirePattern`,
  bounded `completeWhen` conditions - elapsed/spawns-cleared/entity-health-below/flag). Validated
  by the new `encounter-catalog` schema. Renderer bridge: `createEncounterRuntime`
  (`@sw2d/runtime/game-support`) materialises spawn requests via a game callback and fires
  patterns through Phase 3's `createProjectileRuntime` (new `spawnRaw`); applies `onEnterInvulnMs`
  / `onEnterFlag` from the definition. Thirteen packs now.
- **Generation.** `content/encounters.json` always emitted; `content.ts` / `main.ts` templates
  load it.
- **Proofs.** New `proofs/bullet-hell/` (bounded deterministic ring+spiral choreography, exact
  bullet count) and `proofs/boss-rush/` (one boss, three mechanically distinct phases,
  health-threshold transitions, invuln windows, final-phase flag). `qa:proof` 10/10 -> 12/12.
- **Limitations.** `LIMITATIONS.bossOrchestration` deleted; `bullet-hell` / `boss-rush` full
  orchestration limitations removed; `arena-combat` / shmups / `survivor-like` / `base-defense`
  narrowed to their real remaining gaps. Maturity split unchanged (5/7/62).
- **Validation:** typecheck PASS; `npm test` 2168/2168; builds + `check:offline` PASS; `qa:proof`
  12/12; `qa:matrix` / `qa:starter-kits` / `release:verify` - see the ledger.

### Revision 18 - 2026-08-29 (Sonnet 5) - Capability program Phase 3

**Weapons & projectiles (ADR-0020).** Third phase of the ten-phase program. Full detail in the
durable ledger [`docs/architecture/CAPABILITY_PROGRAM_STATE.md`](docs/architecture/CAPABILITY_PROGRAM_STATE.md).

- **New capability.** `sw2d.weapons` pack -> `combat.weapons` (renderer-neutral `WeaponsService`:
  cooldown, `single`/`auto`/`burst` fire modes, burst timing, pellet spread, muzzle offset, ammo
  and reload; deterministic `ProjectileSpawn` output). `content/weapons.json` validated by the new
  `weapon-catalog` schema (reuses the Phase 2 effect union for `onHitEffects`). Renderer-coupled
  half: `createProjectileRuntime` (`@sw2d/runtime/game-support`) - renders spawns, per-projectile
  overlap, damage via `combat.health`, pierce/bounce, on-hit effects via `sw2d.items`. Twelve
  packs now.
- **Generation.** `content/weapons.json` always emitted; `content.ts` / `main.ts` templates load
  it; the shared `platform` + `top-down` shells wire `bindStarterWeapon` capability-guarded.
- **Proofs.** `proofs/twin-stick-shooter/` upgraded (raw pool -> reusable model+bridge);
  `proofs/run-and-gun/` new (platform). `qa:proof` 9/9 -> 10/10.
- **Limitations.** `weaponsProjectiles` removed from 8 top-down/platform-shell presets (each
  narrowed to its real remaining gap - Phase 4 orchestration, melee); `gallery-shooter`,
  `rail-shooter`, `asteroids-shooter` keep a narrowed version. Maturity split unchanged (5/7/62).
- **Validation:** typecheck PASS; `npm test` 2154/2154; builds + `check:offline` PASS; `qa:proof`
  10/10; `qa:matrix` / `qa:starter-kits` / `release:verify` - see the ledger for results at phase
  close.

### Revision 17 - 2026-08-28 (Sonnet 5) - Capability program Phase 2

**Data-driven items / effects / pickups (ADR-0019).** Second phase of the ten-phase program.
Full detail in the durable ledger
[`docs/architecture/CAPABILITY_PROGRAM_STATE.md`](docs/architecture/CAPABILITY_PROGRAM_STATE.md).

- **New capability.** `sw2d.items` pack → `items.state`. `@sw2d/contracts/items.ts`:
  `ItemDefinition` / `ItemCatalog`, a bounded `EffectDefinition` union (8 leaf kinds +
  non-nesting `chain`), `ItemsService`. `content/items.json` validated by the new
  `item-catalog` schema (registered alongside `tuning`/`levels`); `items-config` schema
  (`{ persist?: boolean }`, default in-memory). `bindCollectiblePickups`
  (`@sw2d/runtime/game-support`) wires `Collectible` level objects to the service with no
  per-pickup code; the shared `platform` + `top-down` shells call it capability-guarded.
- **Generation.** `content/items.json` always emitted; `content.ts` / `main.ts` templates
  updated. Eleven packs now.
- **Proofs.** New `proofs/collectathon-platformer/` (arcade + chain effects, no
  game-specific pickup code) and `proofs/top-down-adventure/` (world-flag + progression
  currency/xp + a real `consume()`). `qa:proof` 7/7 → 9/9.
- **Limitations.** `collectathon-platformer`'s `itemDefinitions` limitation removed
  (`LIMITATIONS.itemDefinitions` deleted). Phase-1 doc debt in `PRESET_CATALOG.md` swept.
  Maturity split unchanged (5/7/62).
- **Validation:** typecheck PASS; `npm test` 2139/2139; builds + `check:offline` PASS;
  `qa:proof` 9/9; `qa:matrix` 40/40; `release:verify` 6/6; `qa:starter-kits` all 14 sub-suites
  PASS.

### Revision 16 - 2026-08-28 (Sonnet 5) - Capability program Phase 1

**Reusable spatial pointer & interaction (ADR-0018).** First phase of the ten-phase
capability-completion program. Durable, resumable program state — goal, all ten phases, per-phase
status, SHAs, proof consumers, validation, limitation changes — lives in
[`docs/architecture/CAPABILITY_PROGRAM_STATE.md`](docs/architecture/CAPABILITY_PROGRAM_STATE.md);
that ledger is authoritative for the program and is not duplicated here.

- **New capability.** `@sw2d/contracts/spatial.ts` (renderer-neutral: `SpatialPointerState`,
  `HitShape` rect/circle/polygon + `hitTestPoint`, `aimFromPointer`, `InteractionService`);
  `@sw2d/runtime` `SpatialPointerHost` (single frame owner, advanced in the existing PRE_STEP
  handler) and `InteractionServiceImpl` (`game-support/`; hover, click, drag→drop, pointer
  capture, priority). Exposed on `SceneContext` (`spatialPointer`, `interaction`); `GameContext`
  unchanged. Every generated `pointer`-primary game consumes it (rewritten
  `pointerShellPack.ts` template).
- **Proofs.** New `proofs/gallery-shooter/` (world-space click targeting) and
  `proofs/point-and-click/` (hover/click/drag-drop); `proofs/twin-stick-shooter/` upgraded to
  use pointer aim as an optional source. `npm run qa:proof` 5/5 → 7/7.
- **Limitations.** Spatial-pointer limitation removed from `gallery-shooter`, `rail-shooter`;
  narrowed on `point-and-click`, `drawing-game`, `dress-up-character-toy`, `escape-room`.
  Grid-primary placement presets (`tower-defense`, `simple-rts`) untouched. Preset `maturity`
  labels unchanged (5/7/62 split preserved); formal `proof-validated` promotion of the two new
  proof presets is a deferred, dedicated catalog pass.
- **Validation:** typecheck PASS; `npm test` 2114/2114; workbench/starter build + `check:offline`
  PASS; `qa:proof` 7/7; `qa:matrix` 40/40; `release:verify` 6/6; `qa:starter-kits` all 14
  sub-suites PASS. This revision is the Phase 1 commit itself.

### Revision 15 - 2026-08-28 (Sonnet 5)

**Start / Confirm UX repair - the title screen no longer leaves a player at an opaque
"PRESS CONFIRM TO START" with no visible way to start.**

- **Defect.** A desktop player saw `PRESS CONFIRM TO START` (the internal semantic action name)
  with no key named and no visible clickable control - the DOM `A`/CONFIRM button lives in the
  `#touch-controls` cluster, which stays `hidden` unless `pointer: coarse`.
- **Keyboard hint is now honest and physical.** `TitleScene` derives the prompt from the game's
  *effective* `CONFIRM` keyboard bindings via a new pure `packages/runtime/src/input/keyLabels.ts`
  (`humanizeKeyCode` / `describeKeys` / `startPromptFor`). Default bindings render
  `PRESS ENTER OR SPACE TO START`; a rebind (e.g. `KeyX`) renders `PRESS X TO START`; an explicit
  `content.ui.startPrompt` still wins verbatim. `DEFAULT_UI_COPY.startPrompt` in
  `packages/contracts/src/ui.ts` changed from `PRESS CONFIRM TO START` to
  `PRESS ENTER OR SPACE TO START` (fallback only).
- **Visible Start control in the generated game.** A `<button id="start-overlay"
  data-sw2d-action="CONFIRM">Start</button>` sits inside `#game-root`, shown on the title and
  hidden by `src/main.ts` on `scene:changed` / `run:started`. It is a semantic `CONFIRM` press
  through the existing `PointerAdapter` - **no second start path, no new transition logic**
  (ADR-0003 preserved: `consumePress('CONFIRM')` still claims the edge exactly once). It is not
  gated on `pointer: coarse`, so a desktop mouse user sees it. It belongs to the runtime
  experience, so it survives build/pack/offline/opening outside the Workbench. Touch controls
  and Enter/Space/Numpad Enter are unchanged.
- Applied to the authoritative surfaces: `packages/cli/src/templates/{index.html.template,
  styles.css.template, src/main.ts.template}` (every newly generated game), the hand-maintained
  foundation slice `starter/{index.html, src/styles.css, src/main.ts}` and its
  `starter/{tiled-proof.html, src/tiledProofMain.ts}`. The workbench preview placeholder hint
  (`workbench/src/views/previewPane.ts`) now names the in-game Start button / Enter-Space
  instead of "start it". Checked-in `demos/*` and `proofs/*` are generated snapshots and were
  **not** mass-edited; they still start via Enter/Space and will gain the visible overlay on
  their next intentional regeneration through `tools/scripts/generate-demos.ts`.
- **Tests.** `packages/runtime/test/keyLabels.test.ts` (prompt derivation, no "CONFIRM",
  content-override, fallback), `packages/runtime/test/startControls.test.ts` (a
  `data-sw2d-action="CONFIRM"` DOM element routes to the CONFIRM action, claimed once, no
  double-fire), `packages/cli/test/generate.test.ts` additions (generated `index.html` /
  `styles.css` / `main.ts` carry the overlay + wiring; no generated file says "PRESS CONFIRM"),
  and the real-browser proof `tools/scripts/qa-start-controls.ts` on a freshly generated game:
  title says `PRESS ENTER OR SPACE TO START`, `#start-overlay` visible on title / hidden in
  play, **Enter starts, Space starts, clicking Start starts**, touch CONFIRM button preserved,
  pause/resume clean, zero console errors / external requests, lockfile unchanged.
- **Validation on the final tree:** `npm run typecheck` PASS, `npm run validate` PASS,
  `npm test` **2078/2078**, `npm run qa:smoke` **14/14**, `npm run qa:proof` **5/5**,
  `tools/scripts/qa-frame-group-animation.ts` PASS, `tools/scripts/qa-start-controls.ts` PASS,
  `npm run release:verify` **6/6** (deterministic pack, 0 external requests),
  `npm run qa:matrix` **40/40**, `npm run qa:responsive` **19/19**.
- This revision is the repair commit itself; pushed to `origin/main` (see `git log`).

### Revision 14 - 2026-08-26 (Opus 5)

**Phase 12 - Final Cross-System Acceptance and Cold-Start Gate - COMPLETE. Verdict: Complete.**
Full record: [`docs/architecture/PHASE12_FINAL_ACCEPTANCE.md`](docs/architecture/PHASE12_FINAL_ACCEPTANCE.md).

An evidence gate, not a feature phase. Nothing about the factory's capabilities changed; what
changed is that every claim about them was independently re-established, and three
documentation/provenance defects were found and repaired.

- **A01-A20 all PASS; F01-F13 all NO.** Each state is backed by a command run or a file read during
  this phase, never by quoting a prior phase's handoff. Notable independent checks rather than
  re-reads: the generated-runtime matrix's coverage of all 74 presets was **re-derived from the
  catalog** (74 -> 37 distinct `(controller shell, required-pack set)` signatures -> 40 targets,
  0 uncovered, all 6 `sw2d.puzzle` presets individually targeted); a packed artifact's checksums
  were verified with the **standard system `shasum -a 256 -c` tool** and tamper detection confirmed
  by corrupting a copy; the `#app { height: 100% }` responsive repair was confirmed present in all
  19 committed `styles.css` files **and** the CLI template; and every `](path)` markdown link in
  every tracked `.md` file was checked to resolve (zero broken).
- **Final validation on the final tree:** `npm run validate` PASS, `npm test` **1787/1787**,
  `npm run qa:smoke` **14/14**, `npm run qa:proof` **5/5**, `npm run qa:responsive` **19/19**,
  `npm run release:verify` **6/6**, `npm run qa:matrix` **40/40**.
- **Cold-start challenge passed independently** in a `git checkout-index` snapshot (3.2 MB, no
  `node_modules`/`dist`/`pack`/`games`/`.git`), following only `README.md` ->
  `docs/handoff/COLD_START_HANDOFF.md` and the links they name: `npm ci` -> `doctor` ->
  `list-presets` (74) -> `sw2d new` -> `sw2d validate` -> `sw2d pack` -> system-tool checksum
  verification -> tamper check -> real-Chrome play on the **packed** directory
  (`sw2d.title` -> CONFIRM -> `sw2d.play`, declared packs installed, zero console errors, zero
  external requests). Snapshot removed; nothing leaked into the primary worktree.
- **One targeted repair pass, three findings, all docs/provenance-level:**
  1. `docs/resources/CODE_RESOURCE_MANIFEST.json` omitted `playwright-core@1.62.1` (Apache-2.0,
     `@sw2d/qa`) and `@types/node@24.13.3` (MIT, root) - real declared direct dependencies that
     MASTER_PROJECT section 20.2 requires a record for. Provenance was never *unknown*
     (`playwright-core` is documented in `docs/architecture/DEPENDENCY_BASELINE.md` from Phase 8)
     and no release artifact was ever wrong (shipped notices are mechanically derived, and neither
     package ships) - but `resource-policy.json` designates this file as *the* machine-readable
     record, and it disagreed by omission. Both recorded; the dev-tooling table in
     `docs/resources/THIRD_PARTY_NOTICES.md` extended; and
     **`packages/cli/test/codeResourceManifest.test.ts` added (6 tests)**, deriving the required
     set from every workspace `package.json` on disk rather than a hand-list, and asserting
     completeness, non-staleness, version accuracy, section-20.2 field completeness,
     license-acceptability against `resource-policy.json`, and absence of install-script/network/
     telemetry dependencies. Verified load-bearing by temporarily deleting a record and watching it
     fail.
  2. This document's "Current phase" section named `packages/cli/src/release/{checksums,notices}.ts`
     - a path Phase 11 renamed to `releasePackaging/` in the same commit. Corrected. The identical
     stale path inside Revision 13's entry below was **deliberately left unchanged**: it is
     historical revision text, the rename is narrated in `PROJECT_BIBLE.md`, and rewriting past
     revisions to look tidier in hindsight is what this repository's additive-history rule forbids.
  3. The generated-runtime matrix had **no documented invocation anywhere** - no `npm run` alias,
     only a file path - so a cold-start agent could not discover how to run a mandatory acceptance
     command. (`npx tsx` is not a working substitute here: `tsx` appears in no `package.json` and no
     lockfile entry, so it triggers an undeclared registry download; every other TypeScript tool in
     this repository runs under plain `node`.) Added `npm run qa:matrix` and documented it in
     `README.md`, `docs/qa/QA_MATRIX.md` and `docs/handoff/COLD_START_HANDOFF.md`.
- **Preserved deliberately:** the 5 `proof-validated` / 7 `smoke-validated` / 62 `recipe` /
  0 `experimental` maturity split; the technical release state; `UNLICENSED`; unmeasured
  performance; the physical-device-touch, gamepad and exact-Node-24.x unknowns; and every deferred
  optional capability with its recorded trigger. No deployment, GitHub Release, package
  publication, tag, or licensing decision was performed, and no feature phase was started.
- **Pending work: none. Next bounded action: none. No Phase 13.**

### Revision 13 - 2026-08-26 (Sonnet 5)

**Phase 11 - Release, Hardening, Documentation, and Cold-Start Preparation. Status: COMPLETE.**
Full report: [`docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md`](docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md).

Not a feature-expansion phase. Summary in [Current phase](#current-phase) above; full detail in
the linked handoff. Stale current-state claims found and reconciled this revision (with the
specific evidence that supersedes each):

- **"The browser journey is not automated"** (Known failures/gaps, dated to Phase 2) contradicted
  this same document's own Validation matrix, which already said browser journeys were automated
  "for the first time this revision" back in an earlier phase, and had stayed contradicted through
  every subsequent revision since. Closed: real Chrome now drives every committed surface on every
  `qa:smoke`/`qa:proof`/`release:verify`/`qa:responsive` run - not a one-off manual script.
- **"Whether Phaser 4 can run headlessly under Vitest..."** (Unknown, dated to Phase 2) was never
  actually answered - a different, already-shipped path (real Chrome via `playwright-core`) made
  the question moot rather than resolving it. Marked superseded rather than left implying an open
  investigation nobody intends to run.
- `docs/resources/THIRD_PARTY_NOTICES.md`'s Phase 1 baseline claim ("Phaser is the only
  third-party code in the shipped artefact") was checked against the real built bundle and found
  false: `ajv`/`ajv-formats` are also shipped (via `@sw2d/schemas`, a `dependencies` entry of
  every generated game, imported at runtime). Corrected in both that document and
  `docs/resources/CODE_RESOURCE_MANIFEST.json` (which had also never been updated after those two
  packages moved from `verifiedButNotInstalled` to actually-shipped), and now guarded by a
  standing test plus `pack`'s own mechanically-derived notices.

Genuinely real, still-open unknowns were **not** touched: real-device touch, gamepad feasibility,
real wall-clock performance/FPS, the unresolved software-license decision, and every deferred
architectural trigger from Phase 9/10 (spatial pointer, universal puzzle DSL, shared grid-cursor
abstraction) all remain exactly as open as before - Phase 11 made them more explicit (moving the
FPS claim out of "Known failures" and into "Unknown", where an unmeasured fact belongs), not
resolved.

Engineering work this revision (all verified with real command output, not asserted):

- **Release packer hardened**, not replaced: `sw2d pack` (`packages/cli/src/commands/pack.ts`)
  gained a resource-governance gate (blocks on a missing/invalid/non-`approved` per-game
  `resources/RESOURCE_MANIFEST.json` - new, `generateResourceManifest()` in
  `packages/cli/src/generator/contentDocuments.ts`, wired into every `sw2d new`), a deterministic
  `RELEASE_MANIFEST.json`, a SHA-256 `SHA256SUMS` (`packages/cli/src/release/checksums.ts` - Node
  `node:crypto`, no new dependency), and a mechanically-derived `THIRD_PARTY_NOTICES.txt`
  (`packages/cli/src/release/notices.ts` - walks the real `@sw2d/*` → npm dependency graph from a
  generated game's own `package.json`, not a hand-maintained list). New `npm run release:verify`
  (`tools/scripts/release-verify.ts`) proves this end-to-end for one fresh-generated game per
  controller-shell family (`traditional-platformer`/platform, `top-down-adventure`/top-down,
  `asteroids-shooter`/vehicle, `sokoban`/grid+code-configured puzzle path, `gallery-shooter`/
  pointer, `idle-incremental`/ui-simulation): 6/6 pass, including one candidate packed twice from
  identical source and diffed byte-identical.
- **Found and fixed a real responsive/mobile defect**, not merely tested for one: `npm run
  qa:responsive` (new, `tools/scripts/qa-responsive.ts`, 19 committed surfaces × 375x812 portrait /
  844x390 landscape via real Chromium touch/coarse-pointer emulation) failed 0/19 on its first
  run - every surface's touch controls were clipped off-screen in landscape. Root cause (found by
  direct DOM/computed-style inspection, not guessed): `#app { min-height: 100% }` never gave the
  flex column a *definite* height for percentage-based `max-height` to resolve against, and
  `Phaser.Scale.FIT` (`packages/runtime/src/core/createGame.ts`) measured its parent element's box
  synchronously during `new Phaser.Game(...)` - before the browser had finished laying out the
  canvas alongside its `#touch-controls` sibling - so it sized/centered the canvas for the wrong
  box. Fixed with two small changes: `#app { height: 100% }` (was `min-height`), propagated
  identically to the CLI template and all 18 committed `styles.css` copies (starter, 12 demos, 5
  proofs - confirmed byte-identical after the change), plus one
  `requestAnimationFrame(() => game.scale.refresh())` in the shared runtime to force a
  re-measurement once layout is guaranteed settled. Re-ran `qa:responsive`: 19/19 pass. Because
  this touched shared runtime code and every generated game's CSS, reran the full regression
  ladder afterward: 1781 unit tests (`npm test`), `qa:smoke` 14/14, `qa:proof` 5/5,
  generated-runtime matrix 40/40 - all still green, all preserved exactly.
- New documentation: `docs/qa/QA_MATRIX.md`, `docs/handoff/COLD_START_HANDOFF.md`,
  `docs/handoff/COLD_START_AUDIT.md`, `docs/release/CLEAN_BUILD_REPRODUCIBILITY.md`,
  `docs/release/RELEASE_READINESS.md`, `release/README.md`,
  `docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md`. `README.md` completed into a full cold-start
  workflow reference. `PROJECT_BIBLE.md` gained an additive Phase 11 entry.

Regression evidence preserved exactly: `npm run validate` PASS, `qa:smoke` 14/14, `qa:proof` 5/5,
generated-runtime matrix 40/40, preset maturity split unchanged at 5 proof-validated /
7 smoke-validated / 62 recipe / 0 experimental (74 total). Zero required external runtime network
- reconfirmed by every offline guard run this revision, plus `release:verify`'s and
`qa:responsive`'s own zero-external-request assertions.

### Revision 12 - 2026-08-26 (Sonnet 5)

**Phase 10 - Five Deep Proof Games. Status: COMPLETE.**
Full report: [`docs/architecture/PHASE10_PROOF_HANDOFF.md`](docs/architecture/PHASE10_PROOF_HANDOFF.md);
per-proof detail: [`docs/proofs/PROOF_MATRIX.md`](docs/proofs/PROOF_MATRIX.md).

Five proof games built end-to-end from the real factory generation path, each frozen behind its
own `PROOF_CONTRACT.md` before implementation began, in the bounded order the phase spec required
(A chase-platformer -> B twin-stick-shooter -> C tower-defense -> D sokoban -> E idle-incremental):

- **A - chase-platformer**: coyote time, jump buffer, double jump (all bounded game-specific
  movement policy, deliberately not promoted into `platformController` - no second consumer
  exists to trigger that), a content-derived collectible quota, real chase pressure (frozen during
  pause and during a post-respawn spawn-grace window, through two independent mechanisms),
  checkpoint respawn via `sw2d.world`, hazard death via `sw2d.combat`. Automated journey reaches
  `outcome: 'escaped'`.
- **B - twin-stick-shooter**: independent digital aim (ADR-0016) proven by holding movement and
  aim in different directions simultaneously, two content-authored enemy waves (via the `Enemy`
  Tiled class already in the closed 19-class catalog - no catalog change), the shared
  `ProjectilePool`, contact damage, score, pause/restart (restart goes through the real
  `SceneRouter.restartRun()` scene reinstall, proven by a fresh `ProjectilePool`'s counters
  returning to zero, not a game-specific reset flag).
- **C - tower-defense**: the smoke-validated demo's route/placement/currency/targeting design
  plus one new mechanic the deep-proof bar requires beyond it - a real tower upgrade
  (`SECONDARY_ACTION` on the tower's own grid cell) that doubles projectile damage, load-bearing
  for the win (the second enemy dies in one hit instead of two).
- **D - sokoban**: the one proof the architecture doc flagged by name. The Phase 8 demo
  smoke-validated the *mechanic* by reimplementing push/undo/reset in parallel to `sw2d.puzzle`,
  never installing the real pack. This proof does not repeat that gap - `PuzzleService` (via
  `packConfig.ts`'s `configSource: 'code'` seam) is the single source of truth; `shellPack.ts`
  holds no parallel state or undo stack.
- **E - idle-incremental**: deterministic production, one job/queue, one upgrade, and a real
  browser-reload persistence round-trip (`harness.gotoAndWaitForRuntime` against the same URL -
  genuine navigation, not an in-memory reset), closely following the reference demo's
  already-approved design rather than redesigning working mechanics to appear different.

**One shared-architecture repair**, made under the phase's own "identify earliest failing check,
make one bounded repair" rule: Proof A's journey needed to poll the QA harness one frame at a time
for tight coyote-time/jump-buffer timing (a legitimate technique - see
`packages/qa/proof-specs/chasePlatformer.ts`'s `stepUntil`), which exposed that `harness.stepFrames`
reseeded its virtual clock from real `performance.now()` on every call. Two calls close together in
real wall-clock time computed a delta close to that small real gap instead of the intended fixed
16.67ms per frame, so repeated small `stepFrames` calls barely advanced the game. Fixed by moving
the virtual clock onto `window`, seeded once, advanced only by frame count thereafter - real
elapsed time between calls now plays no part in the computed delta, which strengthens rather than
weakens the Phase 9 "no additive real-time + manual stepping" lock. Regression evidence: `qa:smoke`
stayed 14/14 (every existing smoke spec always called `stepFrames` once per interaction with one
large count, never several small calls in a row, so none were exercising the broken path) and the
generated-runtime matrix stayed 40/40.

All five presets promoted to `maturity: 'proof-validated'`
(`packages/presets/src/catalog/{platforming,topDownAction,strategyDefense,puzzleArcade,simulationManagement}.ts`);
`packages/presets/test/honesty.test.ts` updated to assert the new exact split (5 proof-validated, 7
smoke-validated, 62 recipe, 0 experimental) rather than the old "no proof-validated preset yet" bar.

`npm run validate` passes; `npm run qa:smoke` 14/14; `npm run qa:proof` (new, 5/5) via a new
`packages/qa/src/runProofs.ts` runner mirroring `runAll.ts`; generated-runtime matrix 40/40
unaffected. 1764 unit tests passing (up from 1589 - the honesty-test rewrite plus Phase 9's own
additions).

Next bounded action set to **Phase 11 - Sonnet 5 - Release, Hardening, Documentation, and
Cold-Start Preparation**; not executed this revision.

### Revision 11 - 2026-08-26 (Opus 5)

**Phase 9 - Architecture Integration Gate B. Verdict: PASS WITH TARGETED REPAIRS.**
Full report: [`docs/architecture/PHASE9_ARCHITECTURE_GATE_B.md`](docs/architecture/PHASE9_ARCHITECTURE_GATE_B.md).

New evidence built this revision:
[`tools/scripts/generated-runtime-matrix.ts`](tools/scripts/generated-runtime-matrix.ts) - the
generated-**runtime** composition matrix. `tools/scripts/build-matrix.ts` proves generated games
build; building never runs `SystemHostImpl.install()`, so it cannot prove they enter play. The new
matrix derives runtime signatures mechanically from the catalog - the pair
`(primary controller shell, exact required pack set)`, which is **37 distinct values across the 74
presets** - generates one real game per signature under `games/`, really builds it, then really
plays it in system Chrome: press CONFIRM and assert `scene === 'sw2d.play'`, every required pack
plus the shell pack present in `installedPacks`, and zero console errors. Every preset selecting
`sw2d.puzzle` is covered individually (40 targets), and the script fails rather than skipping if a
config-reading pack is uncovered.

Claims corrected:

- **"74 runnable starters" was false for six presets.** At the Phase 8 baseline the matrix scored
  **34/40**: `sokoban`, `puzzle-platformer`, `match-puzzle`, `falling-block-puzzle`,
  `physics-puzzle` and `escape-room` all threw
  `TypeError: createInitialState is not a function` at install, and rollback then removed the shell
  pack too - those games had no gameplay at all. Now **40/40**.
- **"Deterministic frame stepping" was false.** Measured at baseline: the Phaser loop advanced ~60
  frames per second with zero `stepFrames()` calls, because nothing stopped its
  `requestAnimationFrame` driver. `npm run qa:smoke` was **13/14** at the reviewed baseline
  (`top-down-racer`, reproduced 1-3 failures in 5) - not the 14/14 Phase 8 recorded. Phase 8's
  stealth-game "hairline frame math" diagnosis was wrong for the same reason. Now 0 frames of
  drift across a full second, and `top-down-racer` returns byte-identical results across six
  consecutive runs. `qa:smoke` is **14/14**.
- `content/tuning.json` was generated, schema-validated and README-advertised for all 74 presets -
  and read by nothing. Its numbers were hard-coded in the shell templates.
- `validate`'s browser oracle asserted `installedPacks.length > 0` while its own comment claimed
  "every declared pack installed".
- `materializeStarterPlan`'s docstring claims the CLI consumes it; the generator reads
  `PresetDefinition` directly. Recorded, not repaired.

Repairs (five, all bounded):

1. **ADR-0017 - `SystemPackDefinition.configSource?: 'json' | 'code'`.** `puzzlePack` declares
   `'code'`. `createGame({ packConfig })` carries code-supplied config through `PlayScene` to
   `SystemHostImpl`, which routes on the declaration and refuses a missing code config **by name at
   install** instead of letting the pack throw an opaque `TypeError` frames later. The generator
   emits `src/game-specific/packConfig.ts` for every game (with a working placeholder puzzle for
   the six presets that need one) and `main.ts` always passes it, so `main.ts` stays byte-identical
   across all 74. No universal puzzle DSL was created.
2. **QA harness owns the frame clock.** `gotoAndWaitForRuntime` calls `phaser.loop.stop()`,
   leaving `step()` callable, so `stepFrames` is the only thing advancing the loop.
3. **`content/tuning.json` made live.** The platform and top-down shells read
   `moveSpeed`/`jumpVelocity`/`gravity` from the tuning document, with the generator's own numbers
   as fallbacks. Guarded by a test.
4. **`validate`'s oracle tightened** to compare `installedPacks` against the game's own
   `content/game.json`; `qa:smoke` failures now print the spec's recorded `details` and first
   console error instead of an empty reason.
5. **`ProjectilePool` promoted** from three byte-identical demo copies to
   `packages/runtime/src/game-support/projectilePool.ts`, exported from `@sw2d/runtime`.
   Deliberately game support, not a system pack: no capability id, no config schema, no install
   order - it manipulates Phaser sprites, and every `@sw2d/packs` core is renderer-independent by
   contract. Pooling policy, collision integration and damage-on-hit were **not** promoted.

Decisions recorded without code change: 74-preset composition **KEEP**; generated-game architecture
**KEEP**; CLI/package boundaries **KEEP**; platform-movement duplication **KEEP** (six lines, and
metroidvania's differs where its progression begins); grid cursor **DEFER** (two consumers, not
three); ADR-0016 aim **KEEP**; spatial pointer **DEFER** with trigger; content-role schemas
**DEFER** with trigger; QA architecture **KEEP** after repair.

Maturity unchanged: exactly twelve `smoke-validated`, 62 `recipe`, zero `proof-validated`.
`top-down-racer` retains its status because the cause of its intermittent failure - the harness -
was repaired, not the assertion.

Validation: `npm run typecheck`, `npm test` (**1743** tests, 65 files), `npm run build`,
`npm run check:offline`, `npm run validate`, `npm run qa:smoke` (**14/14**), the generated-runtime
signature matrix (**40/40**) and the representative real-build matrix all pass. The baseline was
established before any edit, which is how the pre-existing `top-down-racer` failure was found.

### Revision 10 - 2026-08-26 (Sonnet 5)
Phase 8 complete: Factory CLI, Generated Starters, Browser QA, and 12 Representative Demos. Full
detail in [`docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md`](docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md);
summarized here.

Built `@sw2d/cli` (nine commands: `doctor`, `list-presets`, `describe`, `new`, `add-level`,
`add-theme`, `validate`, `build`, `pack`) - the first real consumer of `materializeStarterPlan()`.
`new` generates an actual runnable game from any of the 74 presets via six fixed controller-family
shell templates, deterministic and byte-identical across repeated calls (proven for all 74 in
`packages/cli/test/generate.test.ts`). Built `@sw2d/qa`, a real-browser smoke harness on
`playwright-core` driving system-installed Chrome - no bundled-browser download, satisfying the
phase's explicit dependency policy. Generated and hand-extended twelve representative demo games
(`demos/<preset-id>/`, one per genre family), each with a committed Playwright spec proving its
preset's defining mechanic against a real production build; `npm run qa:smoke` builds and smokes
all twelve plus two newly-automated starter journeys (replacing the Phase 1 manual checklist) in
one reproducible run - **14/14 pass**.

ADR-0016 records the one durable architecture decision: `TopDownIntent` gained
`aimX`/`aimY`/`aimMagnitude`, a same-shape second digital-axis pair (`AIM_LEFT/RIGHT/UP/DOWN`),
resolving `twin-stick-shooter`'s independent-movement-and-aim requirement without building a
spatial pointer service - spatial pointer/hover/click targeting remains fully deferred.
`tower-defense`'s tower placement uses the existing keyboard-driven `gridController` cursor
instead, per the phase's own explicit allowance.

Two real architectural findings surfaced and are recorded in the handoff doc for Phase 9 to weigh,
not silently worked around: (1) `sw2d.puzzle`'s config requires TypeScript functions, incompatible
with the JSON-only `content/game.json` composition root every other pack uses - `sokoban` works
around it by implementing equivalent grid/push/undo/solved state directly rather than selecting
the pack; (2) a real regression class was caught and closed by strengthening `validate`'s browser
smoke to actually start a run and check every declared pack installed, not just that the title
screen renders - the original shallow oracle would have let a broken pack selection ship silently
(the same "metadata that declares a contract nothing evaluates" failure shape Phase 5's own gate
found once already).

`ProjectilePool`, a small bounded projectile-lifecycle helper, is used by three demos
(`twin-stick-shooter`, `bullet-hell`, `tower-defense` - the exact three-consumer trigger named in
the phase's own directive) but was deliberately **not** promoted to `@sw2d/packs` - copied, not
shared, with the promotion question left open for Phase 9.

Exactly the twelve demo preset ids are now `maturity: "smoke-validated"`
(`packages/presets/test/honesty.test.ts` enforces the exact 12/62/0 split); the other 62 remain
`recipe`; zero are `proof-validated`. 74/74-preset generation evidence is two-tier: exhaustive
static/schema/token/pack checks for all 74 (part of 1589 total repo tests, up from 892), plus real
`npm install`+`tsc`+`vite build` evidence for a 13-instance representative matrix (the twelve demo
presets plus the one controller-family class - `pointer` - not otherwise covered), built via
`tools/scripts/build-matrix.ts` inside `games/` (matching real `sw2d new` usage) and fully cleaned
up afterward - **13/13 real builds passed**. Neither `games/matrix-*` nor any demo's
`dist/`/`pack/`/`node_modules/` is committed.

Documentation: `docs/cli/CLI_REFERENCE.md`, `docs/demos/DEMO_MATRIX.md`,
`docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md`, and `docs/architecture/adr/0016-*.md` are new;
`README.md`, `docs/presets/PRESET_CATALOG.md`, `docs/presets/PRESET_CAPABILITY_MATRIX.md`, and
`docs/architecture/DEPENDENCY_BASELINE.md` (recording `@types/node@24.13.3` and
`playwright-core@1.62.1`, both dev-only with no postinstall network activity) were updated in
place.

Next bounded action set to **Phase 9 - Opus 5 - Architecture Integration Gate B**; not executed
this revision.

### Revision 9 - 2026-08-25 (Sonnet 5)
Phase 7C complete: Preset Catalog Families G-I - **the 74-preset catalog is finished**. Extended
`@sw2d/presets` from 49 to exactly 74 recipes - Family G Simulation/management (8), Family H
Narrative/exploration (7), Family I Party/toy/weird (10), the exact ids MASTER_PROJECT.md
section 4 names, appended after the untouched Phase 7A+7B 49. No ADR this revision - the ADR-0015
package boundary held with zero changes for the third phase in a row, the strongest evidence yet
that the repair generalises: three different families, three different authors' worth of
reasoning about controllers and packs, and the same `@sw2d/contracts` + `@sw2d/packs`'s `./ids`
subpath dependency shape every time.

The catalog's one standing gap closed this phase: `sw2d.simulation` had zero preset consumers
through Phase 7A and 7B (flagged honestly in both phases' own "Known failures/gaps" entries rather
than forced early). Family G gives it 9 required and 10 total consumers, because a management/
simulation loop is genuinely built from `simulationPack`'s resource ledger - not manufactured for
coverage; `sw2d.ai` was correspondingly *never* selected anywhere in Families G-I, honouring
MASTER_PROJECT.md section 9's explicit instruction not to select AI "merely to simulate customers/
animals if the current AI capability does not actually represent those behaviors." **All ten
current packs now have at least one preset consumer** - `docs/presets/PRESET_CAPABILITY_MATRIX.md`
gained a "Full pack-consumer coverage" table reporting the exact required/total count per pack
across all 74 recipes, the first time this needed reporting (Phase 7A/7B always had a known
zero-consumer exception to name instead of a table to build).

Two shared `LIMITATIONS` constants added (`customerEconomy` across `shopkeeper`/`tycoon-lite`/
`restaurant`, `creatureSimulation` across `pet-creature`/`virtual-pet`/`aquarium-terrarium` -
`creatureSimulation` is this phase's one *cross-family* reuse, shared between Family G and Family
I); every other Phase 7C limitation is a single-use inline string, the same "two or more recipes"
bar Phase 7B established. Three new validation profiles
(`simulation-management-recipe`/`narrative-exploration-recipe`/`party-toy-weird-recipe`) bring the
bounded total to exactly nine - one per registered family, matching the catalog's own final family
count for the first time (nine families, nine profiles).

Controller routing followed MASTER_PROJECT.md section 6's per-recipe guidance precisely rather
than defaulting broadly: Family G stayed `ui-simulation`-only throughout (confirm/cancel/navigate
already covers shop/farm/pet menu interaction honestly; adding `pointer` to "customer-facing"
recipes was considered and rejected as an unjustified claim over what `ui-simulation` alone already
provides). Family H used the master plan's own per-recipe assignments exactly (`top-down` for
`exploration-game`, `pointer`+`ui-simulation` for `point-and-click`/`escape-room`,
`top-down`+`pointer` for `investigation-game`/`museum-exhibit` where both are separately
justified). Family I applied the same restraint Family H modelled: `pointer` only where a
recipe's identity is genuinely pointer-shaped (`physics-toy`, `drawing-game`,
`dress-up-character-toy`, `sandbox-playground`, `photography-game`), `ui-simulation` everywhere
else (`microgame-collection`, `local-party-game`, `virtual-pet`, `fishing-game`, `cooking-game`).

Catalog validation, materialization and both docs all extended through the exact same paths Phase
7A wrote, the third phase running - no second validator, no second materializer, no second doc
generator. `packages/presets/test/catalog.test.ts` now asserts the first 49 entries are
byte-identical in id and order to the frozen Phase 7A+7B list, alongside the pre-existing first-27
check. `docs/presets/PRESET_CATALOG.md` and `PRESET_CAPABILITY_MATRIX.md` were regenerated in
full from a fresh 74-entry catalog dump (the same disposable-test-harness technique every prior
phase used, removed from the tree afterward), covering all nine families with "(Phase
7A)"/"(Phase 7B)"/"(Phase 7C)" labels.

279 new tests (892 total, up from 613), all in the seven `packages/presets/test/` files Phase 7A
already created - no new test files, the third phase in a row where every suite was already
generic enough over `PRESETS` to need only its hardcoded id/count/profile/foundational-pack-set
expectations updated (`catalog.test.ts`'s exact-id list and family counts, `honesty.test.ts`'s 25
new required-limitation cases plus `sw2d.simulation`/`sw2d.narrative` added to the
"foundational, non-genre-complete" pack set, `schemaValidation.test.ts`'s profile count 6 -> 9).
`npm run validate` passed (typecheck, 892 tests, build, offline guard); build output
byte-identical to Phase 7B's, so neither starter browser journey was re-run - Phase 7C touched
only `packages/presets/**` and `docs/presets/**`, nothing the starter imports.

`GameContext` untouched. No new controller, system-pack family, or engine capability was added to
satisfy any recipe; every recipe that would need one (offline-progress/prestige economy balancing,
customer/colonist/creature AI, crop-growth systems, branching-dialogue rendering, spatial pointer
targeting/hover/drag, text-command parsing, evidence-linking, exhibit presentation,
escape-room puzzle grammar, microgame scheduling, local multiplayer input routing, advanced
physics, wardrobe drag/drop, sandbox authoring, canvas drawing, casting/fishing, cooking
sequencing, camera/photography scoring) states the gap in `knownLimitations` instead, per the
phase's own explicit non-goals list. This closes the preset-catalog arc MASTER_PROJECT.md sections
21-24 describe: **74 registered recipes, honestly labelled, real compositions of real packs and
controllers, materializable through one shared path** - the input Phase 8's CLI and 12
representative demos now consume.

### Revision 8 - 2026-08-25 (Sonnet 5)
Phase 7B complete: Preset Catalog Families D-F. `@sw2d/presets` extended from 27 to exactly 49
recipes - Family D Vehicle/movement (5), Family E Puzzle/arcade (10), Family F Strategy/defense
(7), the exact ids MASTER_PROJECT.md section 4 names, appended after the untouched Phase 7A 27.
No ADR this revision - Phase 7B extended ADR-0015's package boundary and Phase 7A's shared
authoring pattern without changing either, confirmed rather than assumed: zero `package.json`
changes anywhere in the repository, and `npm run build`'s emitted chunk hashes are byte-identical
to Phase 7A's.

Reused every Phase 7A pattern rather than rebuilding: `definePreset`/`pack` for all 22 new
recipes, `BASE_INPUT_MODES`/`POINTER_INPUT_MODES` unchanged, four new shared `LIMITATIONS`
constants added only where wording is genuinely reused two or more times
(`vehicleIntentOnly`/`raceOrchestration` across all five Family D recipes,
`advancedPhysics` across `physics-puzzle`/`pinball-lite`, `ballPaddleSystem` across
`breakout`/`pong`) - every other Phase 7B limitation is a single-use inline string, per the
phase brief's own instruction not to over-generalise wording nothing else repeats. Three new
validation profiles (`vehicle-movement-recipe`, `puzzle-arcade-recipe`, `strategy-defense-recipe`)
bring the bounded total to six, still one per registered family.

`sw2d.strategy` and `sw2d.simulation` had zero Family A-C consumers (Phase 7A's own "Known
failures/gaps" entry, itself now closed for `sw2d.strategy`): Family F gives `sw2d.strategy` its
first four real consumers (`auto-battler`, `simple-rts`, `turn-based-tactics`,
`territory-control`), each stating honestly in `knownLimitations` that the pack is "the minimal
turn/team/selection basis future strategy systems build on" (strategyPack.ts's own doc comment),
not a complete RTS/tactics engine. `sw2d.simulation` remains the one pack with zero consumers
across all 49 recipes - noted honestly in `docs/presets/PRESET_CAPABILITY_MATRIX.md` rather than
forced into a recipe that does not really need it, and flagged as Phase 7C's most likely first
real consumer in "Next bounded action" below.

`tower-defense` and `territory-control` both select `sw2d.ai` only optionally but `sw2d.combat`
*required* - applying Phase 7A's own `aiPack`-dependency rule (any recipe selecting `sw2d.ai`
anywhere must guarantee `sw2d.combat` is present) proactively during authoring rather than
discovering it via a failing test, and verified by the existing
`packages/presets/test/catalogPackIntegrity.test.ts` afterward, unchanged.

Catalog validation, materialization and both docs all extended through the exact same paths Phase
7A wrote - no second validator, no second materializer, no second doc generator, per the phase
brief's explicit instruction. `packages/presets/test/catalog.test.ts` now asserts the first 27
entries are byte-identical in id and order to the frozen Phase 7A list, so a future phase
reordering or mutating them fails immediately. `docs/presets/PRESET_CATALOG.md` and
`PRESET_CAPABILITY_MATRIX.md` were regenerated in full from a fresh 49-entry catalog dump (the
same disposable-test-harness technique Phase 7A used, removed from the tree afterward), grouped by
family with a "(Phase 7A)"/"(Phase 7B)" label per section rather than hand-edited into their prior
shape.

179 new tests (690 total, up from 511), all in the seven `packages/presets/test/` files Phase 7A
already created - no new test files, because every Phase 7A suite was already written generic
over `PRESETS` and needed only its hardcoded id/count/profile expectations updated
(`catalog.test.ts`'s exact-id list, `honesty.test.ts`'s required-limitation cases plus
`sw2d.strategy` added to the "foundational, non-genre-complete" pack set, `schemaValidation.test.ts`'s
profile count 3 -> 6). `npm run validate` passed (typecheck, 690 tests, build, offline guard);
build output byte-identical to Phase 7A's, so neither starter browser journey was re-run - Phase
7B touched only `packages/presets/**` and `docs/presets/**`, nothing the starter imports.

`GameContext` untouched. No new controller, system-pack family, or engine capability was added to
satisfy any recipe; every recipe that would need one (vehicle physics, ball/paddle collision,
falling-block/match-3 board engines, tower placement/targeting, RTS selection/pathfinding, turn-
based movement/attack ranges, wave/base-damage orchestration, territory/capture mechanics) states
the gap in `knownLimitations` instead, per the phase's own explicit non-goals list.

### Revision 7 - 2026-08-25 (Sonnet 5)
Phase 7A complete: Preset Catalog Families A-C. New package `@sw2d/presets` (27 registered
`PresetDefinition` recipes - Platforming 10, Top-down action 10, Shooter 7, the exact ids
MASTER_PROJECT.md section 4/21 names, deterministic catalog order). Every recipe is honestly
`maturity: 'recipe'`, composes only real controller families and real `@sw2d/packs` ids, and
states a real `knownLimitations` entry wherever it depends on a capability that does not fully
exist yet (weapons/projectiles, spatial aim/pointer targeting, stealth vision/awareness,
grappling physics, boss-phase orchestration, procedural generation, a world graph/map,
climbing mechanics) - eleven of these are the exact required-text limitations
MASTER_PROJECT.md section 12 names, asserted verbatim in `packages/presets/test/honesty.test.ts`.
Full rationale: [ADR-0015](docs/architecture/adr/0015-preset-catalog-and-pack-metadata-boundary.md).

The Phase 5 pack-metadata/Ajv deferred trigger fired, twice, investigated before choosing
`@sw2d/presets`' dependency shape as the phase brief required. `@sw2d/packs`' barrel triggers Ajv
registration (progressionPack/arcadePack's `registerSchema()` calls) merely by importing pack
identity; `@sw2d/runtime`'s barrel loads Phaser merely to reach the pure, Phaser-free
`resolveInstallOrder` - confirmed directly (a test importing it from the barrel failed with
`ReferenceError: window is not defined`, thrown from inside Phaser's own module-load code). Both
closed with the smallest possible repair: one additive `package.json` "exports" subpath each
(`@sw2d/packs`'s `./ids`, `@sw2d/runtime`'s `./composition`), each pointing directly at an
already-existing, already-side-effect-free file - no metadata duplication, no new framework,
`sideEffects`/barrel exports unchanged. `@sw2d/presets`' own `package.json` proves the resulting
shape: `dependencies` is exactly `@sw2d/contracts` + `@sw2d/packs`; `@sw2d/schemas`/`@sw2d/runtime`
are `devDependencies`, used only by tests (which may cross package boundaries to verify, the same
precedent `packsComposition.test.ts` already set). `npm run build`'s byte-identical output proves
neither repair touched the starter's actual behaviour.

Catalog-level validation goes well beyond JSON Schema shape checks, all automated, none
duplicating existing logic: every recipe's full required+optional pack selection resolves through
the *real* `resolveInstallOrder` against the *real* ten pack definitions (not a synthetic
registry); every referenced pack id and controller family is real; no recipe claims `gamepad`
input support (OPERATIONAL_STATE.md's own "still unknown" entry); every recipe selecting
`sw2d.ai` also selects `sw2d.combat` as required, satisfying `aiPack`'s one real cross-pack
dependency. A shared, pure `materializeStarterPlan()` reshapes any of the 27 recipes into the same
`StarterPlan` shape Phase 8's file-generating CLI will consume - proven deterministic for all 27,
not itself a CLI or a demo. `docs/presets/PRESET_CATALOG.md` and
`docs/presets/PRESET_CAPABILITY_MATRIX.md` were generated from a real catalog dump, not
hand-typed, and are held to the catalog by a dedicated docs-sync test.

232 new tests (511 total, up from 279): 6 catalog shape/lookup, 6 schema/composition/profile
validation, 5 pack/controller integrity plus the aiPack-dependency rule, 5 maturity/input-mode/
required-limitation honesty, 4 starter-materialization, 6 package-boundary-shape, 5 docs-sync -
across seven files in `packages/presets/test/`. `npm run validate` passed (typecheck, 511 tests,
build, offline guard); build output is byte-identical to Phase 6's, confirmed by diffing the
emitted chunk hashes, so neither starter browser journey was re-run this revision - both changed
files (`packages/packs/package.json`, `packages/runtime/package.json`) only added new "exports"
entries, touching neither package's existing public surface nor anything the starter imports.

`GameContext` untouched - Phase 7A is pure metadata/catalog work with zero runtime consumer yet.
No new controller, system-pack family, or engine capability was added to satisfy any recipe;
every recipe that would need one states the gap in `knownLimitations` instead, per the phase's own
explicit non-goals list.

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
