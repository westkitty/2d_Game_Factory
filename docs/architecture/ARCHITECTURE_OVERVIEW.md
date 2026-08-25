# Architecture Overview

Status: Phase 1 baseline (Opus 5). Governing spec: [`MASTER_PROJECT.md`](../../MASTER_PROJECT.md).

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
packages/schemas/     @sw2d/schemas     JSON Schema + Ajv validation + content-document registry.
                                        Depends on contracts + ajv + ajv-formats. No Phaser.
starter/              @sw2d/starter     one game composing the runtime, loading validated JSON
                                        content through @sw2d/schemas.
tools/scripts/                          repository-level checks (offline build guard).
```

Only packages with a real Phase 1 consumer exist. Empty directories that merely match a
diagram are worse than no directory, because they imply work that has not happened.

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
packages/packs/     @sw2d/packs     reusable system packs (combat, AI, world, ...).
packages/cli/       @sw2d/cli       the `sw2d` factory CLI.
packages/qa/        @sw2d/qa        browser journeys and proof-game harness.
```

Rule for creating one: it exists when it has a consumer, not when it appears in a plan.

## The runtime, by responsibility

```text
core/       GameContext assembly, event bus, capability registry, system host,
            pack dependency resolution, disposable bags, createGame().
input/      Semantic action host + keyboard and pointer/touch adapters.
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
  install(context: TContext, config: TConfig): InstalledSystemPack;
}
```

Packs depend on **capability ids**, never on another pack's module. `resolveInstallOrder()` is
a pure function: it sorts by dependency, rejects cycles, duplicate ids, duplicate capabilities
and unknown packs, and names the offending pack in the message. Being pure means pack
composition is testable without a browser - which is why Phase 1 could ship real coverage for
it before any pack existed.

`SystemHostImpl` owns one scene's packs. It installs in dependency order, tears down in
reverse, and rolls back a partial install. One host per scene lifetime is the whole leak story:
disposing the scene disposes the host, which disposes every pack.

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

## The protected boundary

```text
NORMAL GAME WORK          RUNTIME WORK (needs justification + regression coverage)
content/**                packages/contracts/**
public/**                 packages/runtime/**
themes/**                 shared system packs
src/game-specific/**      shared controllers
```

`starter/src/game-specific/placeholderMoverPack.ts` demonstrates the boundary: it adds real,
controllable behaviour as a system pack, from the game side, with the runtime untouched.

To add a reusable extension: state why existing capability is insufficient, add the smallest
reusable piece, add regression coverage, rerun affected proofs. If three games independently
need the same extension, promote it to a shared pack.

## Offline by construction

Nothing in the runtime fetches. Fonts are system stacks, art is generated, audio is
synthesised. `npm run check:offline` scans the build output for constructs that actually cause
a request. A production build was observed loading exactly two same-origin resources - see
[`docs/qa/PHASE1_VALIDATION.md`](../qa/PHASE1_VALIDATION.md).

## Deliberate non-goals

No ECS. No service-container framework. No scripting language. No editor. No backend. No
plugin marketplace. Every abstraction here has at least one real consumer today; anything
that did not was left out, including the parts a diagram would have suggested.
