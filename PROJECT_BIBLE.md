# Project Bible

Append-only handoff ledger. Decisions, reasons, rejected paths, and lessons that cost something
to learn. Not a terminal transcript, and not a duplicate of `MASTER_PROJECT.md`.

Detail for each architectural decision lives in `docs/architecture/adr/`. This file records the
*why it mattered*.

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
