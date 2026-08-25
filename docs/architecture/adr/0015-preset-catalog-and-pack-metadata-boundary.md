# ADR-0015: The preset catalog reaches pack identity and composition through side-effect-free subpaths, not the packs/runtime barrels

- Status: accepted
- Date: 2026-08-25
- Phase: 7A (Sonnet 5)

## Context

Phase 5's gate deferred a decision rather than guessing at it: "exporting pack config schemas as
data instead of self-registering," with an explicit trigger - "`@sw2d/cli` or a preset barrel
needs pack metadata in Node without Ajv on the dependency path." `@sw2d/presets` is exactly that
consumer, and MASTER_PROJECT.md's own Phase 7A brief asked for the trigger to be checked before
choosing a dependency shape.

It fired twice, in two different packages, for the same underlying reason: **a package's public
barrel (`src/index.ts`) evaluates its entire module graph, not just the specific export a caller
wants.**

1. **`@sw2d/packs`.** `progressionPack.ts` and `arcadePack.ts` call `registerSchema()` at module
   load (Phase 4, `sideEffects` already lists them honestly). Importing anything from
   `@sw2d/packs`'s barrel - even just `PACK_IDS`, which live in a separate, zero-import file -
   evaluates those two modules too, pulling Ajv into any consumer.
2. **`@sw2d/runtime`.** `resolveInstallOrder` (`src/core/resolveInstallOrder.ts`) has always been
   Phaser-free - it imports only `@sw2d/contracts` types. But it is only reachable through the
   runtime's barrel, which also exports `BootScene`/`PlayScene`/etc., all of which import `phaser`.
   Confirmed directly: a test importing `resolveInstallOrder` from `@sw2d/runtime` failed under
   Vitest's Node environment with `ReferenceError: window is not defined`, thrown from inside
   Phaser's own module-load code - not from anything `@sw2d/presets` or `resolveInstallOrder`
   itself does.

`@sw2d/presets`' catalog-integrity tests need both: stable pack identity (which ids are real) to
write recipes against, and the real `resolveInstallOrder` (MASTER_PROJECT.md section 15: "do not
duplicate `resolveInstallOrder`; reuse the existing pure implementation") to prove a recipe's pack
selection actually resolves.

## Decision

**Two new, additive `package.json` "exports" subpaths - no existing export path changed:**

```jsonc
// packages/packs/package.json
"exports": {
  ".": { "types": "./src/index.ts", "default": "./src/index.ts" },      // unchanged
  "./ids": { "types": "./src/ids.ts", "default": "./src/ids.ts" }       // new
}

// packages/runtime/package.json
"exports": {
  ".": { "types": "./src/index.ts", "default": "./src/index.ts" },                              // unchanged
  "./composition": { "types": "./src/core/resolveInstallOrder.ts", "default": "./src/core/resolveInstallOrder.ts" } // new
}
```

Both point directly at a single, already-existing, genuinely side-effect-free source file - not a
new module, not a re-export shim, not a metadata mirror that could drift from the real
implementation. `ids.ts` has zero imports (verified by a test:
`packageBoundary.test.ts`'s "ids.ts itself has zero imports"). `resolveInstallOrder.ts` imports
only `@sw2d/contracts` types (verified the same way). Neither file changed - only how they are
reached did.

**`@sw2d/presets`' production code depends on `@sw2d/contracts` and `@sw2d/packs` only**, and
within `@sw2d/packs` imports exclusively from the `./ids` subpath, never the barrel. It never
imports `@sw2d/schemas` or `@sw2d/runtime` in production source - both are `devDependencies`,
used only by `packages/presets/test/*.test.ts` to validate the catalog against the real Ajv
validator and the real `resolveInstallOrder` (tests are allowed to cross package boundaries to
verify; `packages/runtime/test/packsComposition.test.ts` already does the same thing against
`@sw2d/packs`).

Real `SystemPackDefinition` values (with their actual `provides`/`dependencies`) are still
needed to prove a recipe's selection resolves - `catalogPackIntegrity.test.ts` imports the full
`@sw2d/packs` barrel for that, in a test, where the Ajv side effect is harmless (the test process
already exercises Ajv-validated content elsewhere) and expected.

## Consequences

- A future `@sw2d/cli` (Phase 8) can depend on `@sw2d/presets` + `@sw2d/packs/ids` +
  `@sw2d/runtime/composition` to reason about the full catalog and pack composition in plain Node,
  with neither Ajv nor Phaser anywhere in its dependency graph - the property the Phase 5 trigger
  asked for.
- `@sw2d/packs`' and `@sw2d/runtime`'s existing consumers (the starter) are unaffected: their
  import paths, behaviour and bundle output did not change - confirmed by `npm run build` producing
  byte-identical starter output and the full 506-test suite passing unchanged.
- The repair generalises: any future package needing one specific pure export from a
  Phaser/Ajv-loaded barrel gets the same treatment - a named subpath pointing directly at the one
  file, proven side-effect-free by a test, not a speculative "metadata API."

## Rejected

- **A hand-written pack-metadata mirror** (a `PackMetadata[]` array duplicating each real pack's
  `id`/`provides`/`dependencies` as data). Rejected because it is exactly the failure class
  Phase 5's gate spent its whole report on: "a declaration nothing evaluates" - a second copy of
  `provides`/`dependencies` that could drift from the real pack and nothing would catch it. The
  subpath-export repair reuses the *actual* source, so there is nothing to drift.
- **Moving `resolveInstallOrder` into `@sw2d/contracts`.** It is genuinely Phaser-free and could
  live there, but moving working, already-tested code for a boundary problem solvable with an
  additive `package.json` entry is a bigger, riskier change than the problem justifies - not "the
  smallest bounded repair" the phase brief asked for.
- **A general pack-metadata/schema-registration framework.** MASTER_PROJECT.md section 47 rules
  this class of abstraction out on its own, and nothing here needed it - two files, two subpath
  entries.
- **Deep relative imports from `@sw2d/presets` into `@sw2d/runtime`'s/`@sw2d/packs`' `src/`**
  (bypassing `package.json` "exports" entirely). Works today only because this is one monorepo
  checkout; it is not a real package boundary and would break the moment either package's internal
  layout changed or was published independently. The whole point of an "exports" map is to make
  the public surface explicit - a subpath entry does that; a relative reach-around does not.
