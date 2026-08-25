# Phase 5 - Architecture Integration Gate A

- Date: 2026-08-25
- Owner: Opus 5
- Baseline reviewed: `7c0e7b743d535386ab810ccfbc34a69ff1278543` (Phase 4 complete, `origin/main`)
- Range inspected: `b122699..7c0e7b7`, plus every file in `packages/*/src`, `packages/*/test`,
  `starter/src`, and the six governing control-plane documents.

## Verdict

**PASS WITH TARGETED REPAIRS.**

The Phase 1-4 architecture is sound and worth multiplying. The boundaries that carry the most
future weight - contracts having zero dependencies, the runtime never importing a validator,
packs depending on capability ids rather than modules, one host per scene owning teardown,
controllers being stateless intent readers - all hold in the actual implementation, not just in
the ADRs describing them.

Five defects were found, all of the same shape: **metadata that declares a contract nothing
evaluates**, or a rule stated in a doc comment that the code beside it does not follow. None is
severe today. Every one of them multiplies badly at 74 presets, and each was cheap to close now
and expensive to close later. All five were repaired in this phase.

Nothing was rewritten. No abstraction was introduced. No new dependency was added.

## Verified architecture strengths

Checked against source, not against the plan.

- **`@sw2d/contracts` has zero dependencies and imports nothing.** Verified in
  `packages/contracts/package.json` and every file under `src/`. The `PackConfigValidator`
  interface added in Phase 4 is an interface, not a validator.
- **`@sw2d/runtime` still depends on `@sw2d/contracts` + `phaser` only.** `@sw2d/schemas` and
  `@sw2d/packs` are `devDependencies`, used by one composition test. Phase 5's changes kept this
  true: the new `packConfigValidator` option is a type-only import.
- **Dependency direction is acyclic and correct.** contracts <- runtime, contracts + ajv <-
  schemas, contracts + schemas <- packs, everything <- starter. No package imports a package that
  imports it.
- **Packs depend on capability ids, never modules.** `aiPack` reads combat through
  `capabilities.require<CombatService>(...)` with `CombatService` imported as a type only. This is
  proven against a real pack pair, not a synthetic fixture.
- **No module-level mutable state in `@sw2d/runtime`.** Confirmed by reading every `src/` file;
  `createGame` constructs everything and one `dispose()` releases it.
- **Composition failures are named, not generic.** `resolveInstallOrder` rejects unknown packs,
  duplicate selections, duplicate capabilities, core shadowing and cycles, naming the offending
  pack and capability in each message.
- **Ordering is deterministic.** Among ready packs, selection order wins.
- **Teardown ownership is a single chain.** scene -> bag -> host -> pack, disposal in reverse
  registration order, one failing teardown never aborting the rest.
- **Controllers allocate nothing.** Every family's own-keys are exactly `['read']`; none is
  `Disposable`, because none has anything to dispose. The claimed-vs-observed line
  (`consumePress` only for discrete, mode-changing reads) is drawn deliberately and tested.
- **Time-based packs are deterministic under supplied `deltaMs`.** No wall-clock reads anywhere in
  `@sw2d/packs`; `combatPack` takes `nowMs` as an explicit argument.
- **`registerSchema` is idempotent**, so a module re-evaluated across test files cannot produce an
  Ajv duplicate-schema error. The sharp edge was already handled.

## Issues found and repaired

### 1. Capability ids claimed whole families (REPAIRED - [ADR-0011](adr/0011-capability-id-governance.md))

Three id conventions were live at once: Phase 1's own tests use `combat.health` / `world.bounds` /
`core.input`; Phase 4 shipped flat `combat` / `ai` / `world`; the starter uses `starter.player`.

The flat form is the defect, not the inconsistency. `combatPack`'s doc comment states it is
"deliberately not a combat system"; `MASTER_PROJECT.md` §9.7 lists weapons, projectiles and status
effects as the rest of that family. `worldPack` holds flags and checkpoints while §9.9's world
family is tilemaps, rooms and camera zones - Phase 6's subject. A foundational core holding the id
`world` means Phase 6's world systems cannot publish, and `resolveInstallOrder` will correctly
refuse them.

Repaired: the nine ids are now `<family>.<service>`, plus a governance test
(`packages/packs/test/capabilityIds.test.ts`) asserting the pattern, uniqueness, and the pack-id /
capability-id split. A convention and one test - no registry, no reservation service.

### 2. Adding a gameplay event required editing a protected package (REPAIRED - [ADR-0012](adr/0012-gameplay-events-belong-to-their-package.md))

`GameEventMap`'s own doc comment says packs extend it by declaration merging, "which keeps
gameplay events out of the core." Phase 4 added its twelve pack events directly to the interface
instead. With sixteen planned families and 74 presets, the dependency-free core would accumulate
every gameplay event in the project - and, more seriously, `packages/contracts/**` sits on the
protected boundary, so a preset author raising one event would have to edit the machine.

Repaired: contracts keeps the eight runtime lifecycle events; the twelve pack events moved
verbatim to `packages/packs/src/events.ts` via the augmentation contracts already documents. A
type-only change - no payload, emit site or assertion moved with them.

### 3. The one real game ran with pack config enforcement off, hiding a broken declaration (REPAIRED - [ADR-0013](adr/0013-composition-root-enforces-pack-declarations.md))

ADR-0010's validator was reachable only by constructing `SystemHostImpl` directly. `PlayScene`
passed two arguments, so no generated game could enforce anything without editing the runtime.

The cost was concrete: `starter.placeholder-mover` declared
`configSchemaId: 'starter/placeholder-mover.config.json'` - an id no schema in the repository
carried - commented "enforced by the validator Sonnet builds in Phase 2," a phase that shipped
without touching it. The declaration had been wrong since Phase 1 and was undiscoverable precisely
because nothing resolved it.

Repaired: `CreateGameOptions.packConfigValidator` threads to the host; the starter supplies
`@sw2d/schemas`' implementation and owns a real config schema; a debug build warns when a
declared `configSchemaId` is going unenforced.

### 4. `provides` was descriptive, but `resolveInstallOrder` treated it as load-bearing (REPAIRED - ADR-0013)

Nothing checked that a pack published the capabilities it declared. `starter.placeholder-mover`
declared `provides: ['starter.player']` and never called `capabilities.provide()`. Nothing depends
on it today, so nothing broke - but resolution would have satisfied a dependent pack's
`dependencies` from that declaration, and the failure would then have surfaced inside the
*dependent* pack's `require()`, naming the wrong pack.

Repaired: `SystemHostImpl` verifies after `install()` that every declared capability was published,
failing with a named error through the existing rollback path. The starter drops the entry it
never published rather than inventing a service no second system consumes.

### 5. `@sw2d/packs` declared `sideEffects: false` but had side effects (REPAIRED)

`progressionPack.ts` and `arcadePack.ts` call `registerSchema` at module load. No live failure -
importing the pack binding keeps the module - but the declaration was untrue, and a bundler is
entitled to act on it. `sideEffects` now lists those two files.

## Repair decisions

| Repair | Scope | Evidence it was needed |
|---|---|---|
| Namespace the nine capability ids | `packages/packs` + test literals | Three conventions in-repo; `world`/`combat` block Phase 6 and §9.7 |
| Move pack events to `@sw2d/packs` | contracts + packs, type-only | Contracts' own doc comment; protected-boundary violation for preset authors |
| `packConfigValidator` on `createGame` | runtime (type-only) + starter | Starter's `configSchemaId` named a nonexistent schema |
| Verify `provides` at install | `SystemHostImpl` (~8 lines) | Starter declared a capability it never published |
| Truthful `sideEffects` | one package.json field | Two modules register schemas at load |

Also repaired: [ADR-0004](adr/0004-context-services-vs-system-packs.md) carried a stale claim that
`configSchemaId` was "enforced by the Phase 2 validator." It never was. Corrected in place with a
pointer to ADR-0010 and ADR-0013.

## Deferred decisions and their triggers

A deferred item names the concrete condition that reopens it. None may be solved pre-emptively.

| Deferred | Trigger |
|---|---|
| Shared bounded-numeric primitive (combat health / simulation ledger / arcade score / progression currency) | A **third** family needs the same clamp *and* the same change-event shape; or the persistence phase needs one uniform serialization for all four. |
| Shared flag-store primitive (world / narrative) | A **third** flag-store consumer appears, or the two need to share persistence or query semantics. |
| Generic pack API shape (`PuzzleService<TState>`) | A **second** generic-state pack family exists (e.g. a strategy board-state pack). |
| Exporting pack config schemas as data instead of self-registering | `@sw2d/cli` or a preset barrel needs to read pack metadata in Node without Ajv on the dependency path. |
| Spatial pointer service (world cursor, hover, drag) | A preset needs placement, drag-drop or hover feedback - tower defense is the first. |
| Automated browser journeys (Playwright, `@sw2d/qa`) | The QA phase. Unchanged and still the highest-value debt. |

## Package-boundary finding

**Accepted, unchanged in direction.** contracts is dependency-free; runtime imports no validator;
packs consume capabilities, not implementations; the starter is the only package that composes
everything. Nothing was found in the wrong package. The two boundary *violations* found were both
about what a package is allowed to accumulate rather than what it may import: gameplay events in
contracts (repaired), and an untrue `sideEffects` claim in packs (repaired).

One asymmetry is accepted deliberately: `@sw2d/packs` has a value dependency on `@sw2d/schemas`
so that a pack can register its own config schema at load. That is what makes "supply a validator"
sufficient at the composition root - the alternative, having every game register every pack's
schema, would recreate the silent-forgetting problem repair #3 exists to close. Deferred with a
trigger above, not accepted as permanent.

## GameContext finding

**Healthy. Do not change it.**

Fourteen fields, every one a service a scene cannot function without, which is exactly ADR-0004's
admission test ("a pack may be absent"). The strongest evidence is negative: all nine Phase 4 pack
families needed only `events` and `capabilities` - both present since Phase 1. Nine new consumers
across nine domains added zero fields. That is a bounded surface behaving as designed, not a god
object accumulating.

Guidance for Phase 6 and later, so the test does not have to be re-derived:

- **Belongs on `GameContext`:** nothing currently identified. Theme and asset work goes through
  the existing `assets` (`AssetCatalog`) and `content` (`ContentBundle`) fields - that is what
  they are for.
- **Belongs on `SceneContext`:** engine-specific services a rendering pack needs. Phase 6's
  tilemap/camera work, if it needs anything beyond `scene`, extends here - not the engine-agnostic
  base.
- **Belongs in a capability/system pack:** Tiled level loading, theme switching, camera zones,
  entity registries. A game without them still runs.
- **The one genuine future candidate:** a spatial pointer service. Input is a core service, so
  world-space cursor state would extend `ActionInput` rather than add a fourteenth sibling field.
  Deferred with a trigger above.
- **Nothing should move off it.** Every field has a live consumer.

## Controller / pack / game-specific boundary finding

**Accepted. No responsibility bleed found.**

- Controllers read `ActionInput` and return intent. They are typed against the read-only interface,
  so a controller cannot advance a frame even by accident. None owns a listener, timer or state.
- Packs own reusable gameplay state and publish it as a capability. None imports Phaser; all nine
  are typed against plain `GameContext`.
- Game-specific code composes: `placeholderMoverPack` takes `platformController`'s intent and
  decides velocity, gravity and the jump-vs-grounded question - which is the correct split, checked
  line by line.

The line most likely to be crossed at preset scale is a controller absorbing "how the body moves."
It has not been crossed. `pointerActionController`'s refusal to invent spatial fields is the
strongest evidence the boundary is understood rather than merely documented.

## System pack finding

**The model scales. Do not generalise it further.**

Definition shape, capability publication, dependency ordering, install/update/dispose lifecycle
and rollback all work against nine real packs plus the real host, not fakes. Rollback now covers
three failure classes with one guarantee - a throwing `install()`, a failing config validation, and
(new) an unpublished declared capability - so "nothing partially installed survives" is one path,
not three.

Two limits worth stating before Phase 6 asks:

- `install()` failure disposes the host, which is then permanently unusable. Correct: the scene
  that owns it is being torn down anyway. Not a reusable-after-rollback container, and should not
  become one.
- A pack captures a dependency's service instance at install time. Safe under one-host-per-scene
  with reverse-order teardown, and it must stay that way: a pack must not hold a capability
  reference across host lifetimes.

Nothing here needs to become a plugin framework. `MASTER_PROJECT.md` §47 rules that out and no
finding in this review argues against it.

## Config-validation decision

**Per-`SystemHostImpl` opt-in was the wrong long-term default. It is now a composition-root option**
([ADR-0013](adr/0013-composition-root-enforces-pack-declarations.md)).

`createGame({ packConfigValidator })` threads to the host. Still optional (a harness or CLI
dry-run legitimately has no schema layer), but no longer silent: a debug build names every pack
whose `configSchemaId` is going unenforced. `@sw2d/runtime` gained no dependency - the interface
lives in contracts and the import is type-only.

The desired invariant now holds in the running game, not only in tests: the starter supplies the
validator, owns a real `placeholder-mover-config.schema.json`, and its config is validated before
install. Verified in a browser against the production build.

## Capability-id governance decision

**A convention plus one test. No registry, no framework**
([ADR-0011](adr/0011-capability-id-governance.md)).

`<family>.<service>`, at least two segments, no bare family names, pack ids vendor-prefixed and
never reused as capability ids, non-first-party capabilities carrying their owner's segment.
Enforced by `packages/packs/test/capabilityIds.test.ts`.

Collision *detection* already existed and was already good - `resolveInstallOrder` names both
offending packs. What was missing was collision *avoidance*: an id that reserves a namespace on
behalf of systems that do not exist yet produces a collision no future author can avoid. That is
what the convention fixes, at a cost of nine constants.

## Lifecycle finding

**The model is right. The proofs had one hole, now closed.**

Single ownership chain, reverse-order disposal, per-entry failure isolation, and a debug snapshot
whose counters are real evidence. The Phase 3 lesson - a scene-shutdown teardown cannot assume
Phaser's own systems are still alive - is recorded in `PROJECT_BIBLE.md` and fixed in the code that
hit it.

The hole: nothing tested the failure the lesson describes. `DisposableBagImpl` had "keeps tearing
down after one teardown throws"; `SystemHostImpl` did not. That is exactly the class that produced
the Phase 3 leak, and exactly what Phaser-backed packs will hit again. Added:
`packsComposition.test.ts` now asserts that when one pack's `dispose()` throws, every other pack
still disposes, every capability is still withdrawn, and the host still empties.

No general leak detector was built. There is no evidence one is needed and
`OPERATIONAL_STATE.md`'s counter discipline plus this test cover the known failure modes.

**Guidance for the first Phaser-backed pack in `@sw2d/packs`:** release pure-JS state (listeners,
timers, capability handles, counters) before touching any Phaser-owned object, and guard each
engine-touching step independently. `starter/src/game-specific/placeholderMoverPack.ts` is the
worked example.

## Schema-boundary finding

**Phase 6 ready.**

`@sw2d/contracts` owns document shapes; `@sw2d/schemas` owns validation. Parity is enforced
mechanically by `satisfies`-typed fixtures with the residual limitation documented in the test that
carries it. `registerSchema` / `validateBySchemaId` generalise cleanly - Phase 5 registered a
tenth schema (the starter's pack config) through them without touching the package.

The known `assets`/`ui` gap is real, correctly scoped, and belongs to Phase 6: a JSON import
widens primitives (`role: string`, not `AssetRole`), so `starter/src/content.ts`'s assertion is
compile-time trust, not a runtime check. A malformed asset entry is not rejected at the content
boundary the way `game.json` and `tuning.json` are. **This is Phase 6's first schema task, not a
Phase 5 repair** - inventing an asset schema before the theme pipeline that defines what an asset
is would have been guessing at the shape.

One gotcha carried forward for whoever writes that loader: `exactOptionalPropertyTypes: true`
rejects `key: possiblyUndefinedValue` on an optional property; use a conditional spread.

## Phase 6 readiness

Ready. Sonnet may safely assume:

- Package boundaries and dependency direction are settled and enforced.
- `GameContext` is closed for Phase 6; extend `SceneContext`, or add a system pack.
- Capability ids follow ADR-0011 and the test enforces it.
- Gameplay events are declared by the package that raises them (ADR-0012). Phase 6's events belong
  wherever Phase 6's systems live - **not** in `@sw2d/contracts`.
- A pack's `configSchemaId` and `provides` are both enforced at install; declaring either without
  honouring it now fails loudly.
- The lifecycle model is proven for the class of failure Phaser-backed packs will produce.

Protected and not to be reopened without an escalation: contracts' zero dependencies; the runtime
never importing a schema library; packs depending on capability ids only; one host per scene owning
teardown; semantic input's single frame owner and claimed presses; only `SceneRouter` touching
Phaser's scene manager; zero required network requests.

Do not pre-emptively solve any deferred item above. Each names its trigger.
