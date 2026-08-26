# Architecture Overview

Status: Phase 6 (Sonnet 5) complete - Tiled/theme/accessibility/resource content pipeline. Gate A
(Phase 5, Opus 5) passed with targeted repairs; see [`PHASE5_ARCHITECTURE_GATE_A.md`](PHASE5_ARCHITECTURE_GATE_A.md).
Governing spec: [`MASTER_PROJECT.md`](../../MASTER_PROJECT.md).

## The thesis

> One reusable runtime + composable system packs + controller families + data-driven content
> + genre preset recipes + theme packs + proof-driven QA.

The single invariant everything else serves:

```text
RUNTIME / SYSTEM CODE  = the reusable machine
CONTENT / THEME / GAME-SPECIFIC CODE = the individual game
```

Making a normal new game must not require editing the machine.

## Packages that exist today

```text
packages/contracts/   @sw2d/contracts   engine-agnostic interfaces. No dependencies at all.
packages/runtime/     @sw2d/runtime     the reusable machine. Depends on contracts + phaser.
packages/schemas/     @sw2d/schemas     JSON Schema + Ajv validation + content-document registry
                                        + generic schema/pack-config-validator registration.
                                        Depends on contracts + ajv + ajv-formats. No Phaser.
packages/packs/       @sw2d/packs       ten reusable system pack cores (combat, AI, world,
                                        world-entities, progression, arcade, puzzle, simulation,
                                        narrative, strategy). Depends on contracts + schemas. No
                                        Phaser.
packages/content-pipeline/ @sw2d/content-pipeline  Tiled JSON normalization, the semantic
                                        object-class catalog, theme resolution. Depends on
                                        contracts only. No Phaser, no Ajv - see ADR-0014.
starter/              @sw2d/starter     two games composing the runtime: the Phase 1-5 foundation
                                        slice (index.html) and the Phase 6 Tiled/theme proof
                                        (tiled-proof.html), both loading validated JSON content
                                        through @sw2d/schemas.
tools/scripts/                          repository-level checks (offline build guard).
```

Only packages with a real consumer exist. Empty directories that merely match a diagram are
worse than no directory, because they imply work that has not happened.

### Why `contracts` is separate from `runtime`

`@sw2d/contracts` has **zero dependencies** and imports nothing from Phaser or the DOM. That
is load-bearing, not tidiness:

- the CLI (Phase 8) and schema tooling (Phase 2) must read preset and pack definitions in
  Node without instantiating a renderer;
- the QA harness can assert against `DebugSnapshot` without a browser;
- generated JSON Schemas and TypeScript types have one shared source of shape.

Engine specifics stop at `SceneContext` in `@sw2d/runtime`, which extends `GameContext` with
a `Phaser.Scene`. Packs that render are typed against `SceneContext`; packs that only
simulate can be typed against plain `GameContext`.

### Packages later phases will add

Reserved names and boundaries, so later phases do not have to relitigate them:

```text
packages/presets/   @sw2d/presets   the 74 preset recipes and the catalogue.
packages/cli/       @sw2d/cli       the `sw2d` factory CLI.
packages/qa/        @sw2d/qa        browser journeys and proof-game harness.
```

Rule for creating one: it exists when it has a consumer, not when it appears in a plan.

## The runtime, by responsibility

```text
core/       GameContext assembly, event bus, capability registry, system host,
            pack dependency resolution, disposable bags, createGame().
input/      Semantic action host + keyboard and pointer/touch adapters.
controllers/  Six stateless controller families interpreting ActionInput into intent.
scenes/     Boot / Title / Play / Pause, the scene router, SceneContext.
persistence/  Storage driver, namespaced versioned save store, settings store.
accessibility/ Live projection of settings + device capability.
audio/      Web Audio bus with gesture-safe unlock and synthesised cues.
content/    Asset catalogue (semantic role -> texture key), placeholder generation.
debug/      Stable pull-based snapshot API for humans and automated QA.
```

No module-level mutable state exists anywhere in the runtime. Two games can boot on one page,
and a disposed game leaves nothing behind.

## GameContext: the one dependency surface

Systems never import each other and never reach for globals. They receive a `GameContext`:

```text
gameId  definition  events  input  settings  saves  audio
accessibility  assets  content  capabilities  router  debug  disposables
```

Core services (input, persistence, audio, accessibility, content, debug, events, routing) live
on the context and are always present. Optional capabilities are **system packs**. That split
is deliberate: a pack may be absent, so anything a scene cannot function without belongs on
the context instead.

## System packs

```ts
interface SystemPackDefinition<TConfig, TContext extends GameContext> {
  id; version; provides; dependencies; optionalDependencies?; configSchemaId?;
  configSource?: 'json' | 'code';   // default 'json'
  install(context: TContext, config: TConfig): InstalledSystemPack;
}
```

**A pack declares where its config comes from** ([ADR-0017](adr/0017-pack-config-source-json-or-code.md)).
`'json'` (the default, and every pack but one) means config is data: it travels in
`content/game.json`'s `systemPacks[].config`, a `configSchemaId` may validate it, and the factory
generator can serialize it. `'code'` means config carries functions and can only be supplied at the
composition root, through `createGame({ packConfig })` - `sw2d.puzzle`'s
`createInitialState`/`isSolved` are the one case today. `SystemHostImpl` routes on the declaration
and consults `packConfig` **only** for a code-configured pack, so this is not a general escape
hatch: a JSON-configurable pack's tuning stays in `content/**` where content authors reach it. A
code-configured pack with no code config is refused by name at install, not left to throw a
`TypeError` from inside itself several frames later.

Phase 9 added this because the distinction had been prose. The generator wrote `config: {}` for
every required pack, so all six presets requiring `sw2d.puzzle` produced games that built cleanly
and crashed on the first CONFIRM - proven, and then re-proven fixed, by
[`tools/scripts/generated-runtime-matrix.ts`](../../tools/scripts/generated-runtime-matrix.ts).

Packs depend on **capability ids**, never on another pack's module. `resolveInstallOrder()` is
a pure function: it sorts by dependency, rejects cycles, duplicate ids, duplicate capabilities
and unknown packs, and names the offending pack in the message. Being pure means pack composition
is testable without a browser - which is why Phase 1 could ship real coverage for it before any
pack existed.

**Capability ids are namespaced `<family>.<service>`** ([ADR-0011](adr/0011-capability-id-governance.md)):
`combat.health`, `world.state`, `arcade.score`. The segment before the dot claims a family; the
segment after it claims one capability within that family, so the fuller family systems
`MASTER_PROJECT.md` §9 describes (combat weapons, world tilemaps and camera zones) can publish
alongside these foundational cores instead of colliding with them. No id may be a bare family
name. Pack ids are separate, vendor-prefixed strings (`sw2d.combat`) and are never reused as
capability ids, so an implementation can be swapped without its consumers' id changing.
Game-specific capabilities carry their own owner segment (`starter.player`).
`packages/packs/test/capabilityIds.test.ts` enforces this - it is a convention and a test, not a
registry.

`SystemHostImpl` owns one scene's packs. It installs in dependency order, tears down in
reverse, and rolls back a partial install. One host per scene lifetime is the whole leak story:
disposing the scene disposes the host, which disposes every pack.

**Nine reusable pack cores exist in `@sw2d/packs`** (Phase 4): combat, AI, world, progression,
arcade, puzzle, simulation, narrative, strategy - plus a tenth, Phase 6's `world.entities` entity
registry, alongside `worldPack`'s `world.state` (see "Content pipeline" below and
[ADR-0014](adr/0014-content-pipeline-and-entity-registry.md)). Each Phase 4 core is a foundational
capability - a health/
damage model, an agent-state vocabulary, a resource ledger - not a full genre system; see each
file's doc comment for the exact line drawn (e.g. combat has no weapons or projectiles, AI has no
pathfinding). Every pack publishes exactly one capability and depends on other packs only by
capability id: `aiPack` reads combat's service (`context.capabilities.require<CombatService>('combat.health')`)
with `CombatService` imported as a *type* only, never `combatPack.ts`'s implementation. None
imports Phaser; all are typed against plain `GameContext`, not `SceneContext`.

**Config validation is dependency-inverted** (Phase 4, [ADR-0010](adr/0010-pack-config-validation.md)).
`@sw2d/contracts` declares `PackConfigValidator { validate(configSchemaId, packId, config): unknown }`;
`SystemHostImpl`'s constructor takes one as an optional third argument and, when supplied,
validates a pack's config (rolling back on failure through the same path a failed `install()`
already used) before that pack's `install()` runs. `@sw2d/schemas` supplies the concrete
implementation (`packConfigValidator`); `@sw2d/runtime` itself still imports neither Ajv nor
`@sw2d/schemas` - its dependency graph is unchanged. **A game turns enforcement on at the composition root** (Phase 5,
[ADR-0013](adr/0013-composition-root-enforces-pack-declarations.md)):
`createGame({ packConfigValidator })` threads a validator through `PlayScene` to the host, and the
starter supplies `@sw2d/schemas`' implementation. It stays optional - a test harness or a CLI
dry-run legitimately has no schema layer - but a debug build warns, naming every pack whose
`configSchemaId` is going unenforced, so "declared but silently unenforced" is no longer a state a
generated game can be in without knowing. Only packs with real, JSON-serializable config get a
schema (`progressionPack`, `arcadePack`, and the starter's own `placeholder-mover`);
`puzzlePack`'s config is functions (`createInitialState`, `isSolved`) and correctly has none.

**A pack's `provides` list is verified after install** (ADR-0013). `resolveInstallOrder` satisfies
another pack's `dependencies` from that declaration, so a pack that declares a capability and
never publishes it must fail at install - with a named error, through the same rollback path a
throwing `install()` and a failed config validation already use - rather than surfacing later
inside the dependent pack's `require()`.

## Semantic input

Gameplay reads `MOVE_LEFT`, `JUMP`, `PAUSE`. It never reads `KeyboardEvent.code`. Adapters
translate devices into actions; keyboard and pointer/touch exist today, gamepad slots in
behind the same `InputDeviceAdapter` interface.

Two rules make this more than an indirection layer:

1. **One owner advances the frame.** `ActionInputHost.update()` runs exactly once per game
   step, from Phaser's `prestep`, before any scene updates. Two systems reading `justPressed`
   in the same frame always agree.
2. **A press can be claimed.** `consumePress(action)` returns whether the action was pressed
   and, if so, removes the edge for the rest of the frame. This is how one physical press
   produces one effect when several layers are alive - see
   [ADR-0003](adr/0003-semantic-input-ownership.md) for the concrete bug that forced it.

Phaser's own keyboard plugin is disabled (`input: { keyboard: false }`) so nothing else can
consume a key behind the semantic layer's back.

## Controller families

A layer between semantic input and gameplay:

```text
physical adapters  ->  semantic actions  ->  controllers  ->  gameplay / system packs
   (keyboard, pointer)     (ActionInput)      (intent)          (bodies, AI, UI, economy)
```

```ts
interface Controller<TIntent> {
  read(input: ActionInput): TIntent;
}
```

### Events

`@sw2d/contracts`' `GameEventMap` holds **runtime lifecycle events only** (`pause:changed`,
`settings:changed`, `run:restarted`, ...). Gameplay events are declared by the package that raises
them, merged in through declaration merging
([ADR-0012](adr/0012-gameplay-events-belong-to-their-package.md)) - see
`packages/packs/src/events.ts`. That keeps the dependency-free core from accumulating the whole
content catalogue's vocabulary, and keeps `packages/contracts/**` - which the protected boundary
reserves for runtime work - off the edit path for ordinary preset and game work. Naming is
`<capability family>:<pastTenseFact>`. A pack that needs an *answer* calls a capability directly;
events are for facts other systems may want to react to.

Six families exist in `packages/runtime/src/controllers/`, each a stateless singleton:
`platformController`, `topDownController`, `vehicleController`, `gridController`,
`pointerActionController`, `uiSimulationController`. A controller answers "what does the player
intend?" - never "how does the body move, race, navigate or fire?" That stays with a movement or
gameplay system pack. None owns a listener, a timer, or frame advancement; none is `Disposable`,
because none allocates anything to dispose.

**Claimed vs. observed fields.** Most intent fields are plain, non-mutating reads (`isDown`,
`justPressed`, `axis`, `value`) - any number of systems may read them in the same frame and agree.
A small, deliberate set are claimed via `consumePress`, because they represent a discrete,
single-owner, mode-changing decision in the same class [ADR-0003](adr/0003-semantic-input-ownership.md)
names: `PlatformIntent.jumpPressed`, and `UiSimulationIntent.confirmPressed`/`cancelPressed`/
`pausePressed`. Getting this line wrong either way reopens either a leaked-double-effect bug or an
unreadable exclusive lock; see the Phase 3 entry in `PROJECT_BIBLE.md` for the reasoning.

**Bounded diagonal movement.** `topDownController` scales the whole `(moveX, moveY)` vector, not
each axis independently, so pressing two cardinal directions at once cannot exceed length 1 -
without this, digital 8-way input would move `sqrt(2)` times faster on a diagonal.

**Honest pointer support.** `pointerActionController` exposes only the press-style actions
`ActionInput` genuinely has (`primaryPressed`, `secondaryPressed`, `interactPressed`,
`confirmPressed`, `cancelPressed`). It does not invent cursor coordinates, hover state or drag
deltas - `ActionInput` has none. A spatial pointer service is a real, bounded future capability,
not something to fake with always-zero fields.

**Real consumer.** `starter/src/game-specific/placeholderMoverPack.ts` calls
`platformController.read(context.input)` and uses the returned intent (`moveAxis`, `jumpPressed`,
`dashHeld`) to drive Arcade Physics - the controller supplies intent, the pack still owns "how the
body moves" (velocity, gravity, the jump-vs-grounded decision). The other five families are proven
by focused unit fixtures against a real `ActionInputHost`, not a real scene yet.

## Scene lifecycle

```text
BOOT -> TITLE -> PLAY -> (PAUSE overlay) -> resume | restart | title
```

`SceneRouter` is the only supported way to change scene, pause or restart; nothing else
touches Phaser's scene manager. Restart is a full `stop` then `start`, which runs the scene's
shutdown handler and therefore its whole teardown chain. Boot stops itself once it has handed
off - a scene left running is a scene nobody is accounting for.

## Content and themes

The runtime never reads a file or fetches a URL. It consumes a `ContentBundle` produced by a
`ContentSource`. Gameplay asks the `AssetCatalog` for a semantic role (`player`, `platform`)
and gets a texture key; the theme decides what that looks like. Phase 1's bundle was inline,
generated in-process art. Phase 2 replaced it with a schema-validated JSON source
(`starter/content/*.json`, validated through `@sw2d/schemas`) with zero `@sw2d/runtime` change -
the runtime still only ever sees a `ContentBundle`. `ContentBundle.data` entries are now
`ContentDocumentEnvelope`s (`schemaId`, `valid`, `value`), not an ungoverned
`Record<string, unknown>`.

UI wording follows the same rule: the runtime knows *that* the game is paused and supplies
neutral fallbacks; `ContentBundle.ui` supplies the words. No game identity, lore or joke
belongs in runtime code.

## Content pipeline (Phase 6): Tiled, entity registry, themes

Full rationale: [ADR-0014](adr/0014-content-pipeline-and-entity-registry.md).

```text
Tiled JSON (content/levels/*.json)
  -> @sw2d/content-pipeline normalizeTiledMap()   (transform + semantic class validation)
  -> @sw2d/schemas level-document.schema.json     (shape validation, content boundary)
  -> ContentBundle.data['levels/<id>']            (a ContentDocumentEnvelope<NormalizedLevel>)
  -> @sw2d/packs world.entities (entity registry) (dispatch to a scene-scoped factory)
  -> scene-scoped game code                        (spawns/behaves - starter/src/game-specific/)
```

**Tiled ingestion** (`@sw2d/content-pipeline`) is renderer-independent and validator-independent:
no Phaser, no Ajv. It supports orthogonal, finite maps; `tilelayer` (name/dimensions only - Phase 6
does not render tile images, see ADR-0014) and `objectgroup` layers; objects with a numeric id, an
x/y/width/height rectangle, a `class`/`type` naming one of nineteen catalog classes (the eighteen
MASTER_PROJECT.md section 6 requires, plus `Solid` for collision/platform geometry), and
string/int/float/bool custom properties. Any other orientation, an infinite map, or an unsupported
layer type fails with a named `UnsupportedTiledFeatureError`; an object naming a class outside the
catalog fails with `UnknownTiledObjectClassError` in strict mode (the default) or is skipped with a
warning when `strict: false`. A missing or mistyped required property fails with
`TiledObjectPropertyError`, naming the map, object id, class and property.

**The entity registry** is `@sw2d/packs`' tenth capability, `world.entities`, alongside
`worldPack`'s `world.state` - exactly the room ADR-0011 reserved. It stores
`(object, context) => result` factories keyed by class id: `register()` (duplicate registration
throws), `dispatch()` (returns `undefined`, not an error, when no factory is registered - most
catalog classes have none, which is expected). Phaser-free like every other `@sw2d/packs` core;
rendering factories are registered and typed against `SceneContext` by scene-scoped game code, the
same widening-cast pattern Phase 4 accepted for `puzzlePack`.

**Theme contract.** A `ThemeManifest` (`@sw2d/contracts` `theme.ts`, validated by
`@sw2d/schemas` `theme-manifest.schema.json`) carries `assets` (the same `AssetDescriptor[]` shape
`ContentBundle.assets` already uses), `tokens`/`highContrastTokens` (a small CSS-custom-property
palette for DOM UI), `fonts` (system stacks only, never a remote URL) and an optional `ui` copy
override - never gameplay, tuning or system-pack data. `resolveTheme(theme, accessibility)`
(`@sw2d/content-pipeline`) is a pure function: it swaps in `highContrastTokens` exactly when
`accessibility.highContrast` is true, otherwise returns `tokens` unchanged. Two themes exist
(`starter/content/themes/default`, `.../neon`); loading the same level under each produces
byte-identical `ContentBundle.data` - asserted directly, not just documented - because
`resolveTheme` and `normalizeTiledMap` never read each other's input.

**The known asset/UI validation gap is closed.** `content-assets.schema.json` and
`ui-copy.schema.json` (both leaves, also `$ref`-ed by `theme-manifest.schema.json`) now validate
`ContentBundle.assets`/`.ui` the same way `game-definition`/`tuning` already were - the compile-time
`satisfies`-then-cast trust Phase 2 left as a documented, deliberate gap is gone. A malformed asset
role or a non-string UI field now fails at the content boundary, before a `ContentBundle` exists.

**Resource governance is executable.** `@sw2d/schemas`' `validateResourceManifest` validates a
`ResourceManifest`'s shape (Ajv, `resource-manifest.schema.json`/`resource-record.schema.json`)
and the cross-record rules JSON Schema cannot express - duplicate ids, a third-party record with no
`originalSource`, an *approved* record whose license is outside `resource-policy.json`'s
`acceptableLicenses` or whose `localPath` is empty. `docs/resources/VISUAL_ASSET_MANIFEST.json`
records the fifteen generated-texture assets Phase 1-6 actually ship (foundation-slice content plus
both themes), every one `project-owned`/`generated` - proving the pipeline validates real records,
not synthetic fixtures.

**Environment refresh is wired.** `AccessibilityStateImpl.refreshEnvironment()` existed since
Phase 1 with no caller. `createGame` (`packages/runtime/src/core/createGame.ts`) now listens for
`matchMedia('(prefers-reduced-motion: reduce)')`/`matchMedia('(pointer: coarse)')` change events -
guarded like `readAccessibilityEnvironment()` itself, disposed through the existing `rootBag` - and
re-projects accessibility state live when the OS preference changes mid-session, not just on a
settings write.

## The protected boundary

```text
NORMAL GAME WORK          RUNTIME WORK (needs justification + regression coverage)
content/**                packages/contracts/**
public/**                 packages/runtime/**
themes/**                 shared system packs
src/game-specific/**      shared controllers
```

`starter/src/game-specific/placeholderMoverPack.ts` demonstrates the boundary: it adds real,
controllable behaviour as a system pack, from the game side, reading `platformController` intent
rather than raw input, with the runtime untouched.

To add a reusable extension: state why existing capability is insufficient, add the smallest
reusable piece, add regression coverage, rerun affected proofs. If three games independently
need the same extension, promote it.

**Promote to the smallest home that fits, not automatically to a pack.** A renderer-independent
service with real cross-pack semantics becomes a `@sw2d/packs` capability. A Phaser-coupled helper
with a settled interface and no shared semantics becomes **game support** in
`packages/runtime/src/game-support/` - no capability id, no config schema, no install order.
`ProjectilePool` is the worked example (Phase 9): three demos had arrived at byte-identical copies,
which is strong evidence the *interface* is finished, while pooling policy, collision integration
and damage-on-hit remained undecided. Promoting the proven interface without the unproven semantics
is the bounded move. It cannot live in `@sw2d/packs`, because every pack core is
renderer-independent by contract and this touches sprites and bodies.

## Offline by construction

Nothing in the runtime fetches. Fonts are system stacks, art is generated, audio is
synthesised. `npm run check:offline` scans the build output for constructs that actually cause
a request. A production build was observed loading exactly two same-origin resources - see
[`docs/qa/PHASE1_VALIDATION.md`](../qa/PHASE1_VALIDATION.md).

## Deliberate non-goals

No ECS. No service-container framework. No scripting language. No editor. No backend. No
plugin marketplace. No universal puzzle DSL ([ADR-0017](adr/0017-pack-config-source-json-or-code.md)).
No spatial pointer / hover / world-space hit-testing - aim is a digital axis pair
([ADR-0016](adr/0016-aim-as-a-digital-axis-not-spatial-pointer.md)), and spatial pointer stays
deferred until a preset promoted past `recipe` genuinely cannot be built without it. Every
abstraction here has at least one real consumer today; anything that did not was left out,
including the parts a diagram would have suggested.

## Browser QA owns the frame clock

`@sw2d/qa` launches system Chrome through `playwright-core` (no bundled browser download), serves
the build from an OS-assigned port, and drives real `KeyboardEvent`s through the semantic input
layer. On attach it calls `phaser.loop.stop()`, tearing down Phaser's `requestAnimationFrame`
driver while leaving `step()` callable, so `stepFrames(n)` advances **exactly** `n` frames and
nothing else advances the loop.

That last sentence is load-bearing and was not true before Phase 9: manual stepping used to be
additive to a live real-time loop (~60 fps of drift with zero `stepFrames()` calls), which made
every smoke spec nondeterministic and `top-down-racer` fail roughly one run in three.

**Deterministic stepping is not performance evidence, and nothing may present it as such.** It
proves behaviour reproducibly; it says nothing about frame budget or real-time smoothness, which
remain unmeasured.
