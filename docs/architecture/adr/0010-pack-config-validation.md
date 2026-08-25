# ADR-0010: Pack config validation is dependency-inverted, not imported

- Status: accepted
- Date: 2026-08-25
- Phase: 4 (Sonnet 5)

## Context

`SystemPackDefinition.configSchemaId` has existed since Phase 1 as declared-but-unenforced
metadata. Phase 4 is the first phase with real packs that have real config shapes
(`ProgressionConfig`, `ArcadeConfig`), so enforcing it stopped being speculative. But the
project's package boundaries are load-bearing: `@sw2d/contracts` has zero dependencies (ADR-0002),
and `@sw2d/runtime` must stay free of a schema library so the CLI and schema tooling can keep
treating "renderer" and "validator" as separable concerns. Importing Ajv (or `@sw2d/schemas`)
into `@sw2d/runtime` to check a config at install time would break that.

## Decision

`@sw2d/contracts` declares an interface, not a validator:

```ts
interface PackConfigValidator {
  validate(configSchemaId: string, packId: string, config: unknown): unknown;
}
```

`SystemHostImpl` takes one as an optional third constructor argument. If present, and a pack
declares `configSchemaId`, its config is validated (and rolled back on failure, via the same
partial-install rollback path a failed `install()` already used) before `definition.install()`
runs. If absent - as every existing call site remains, unchanged - `configSchemaId` stays
declared but unenforced, exactly as every phase before this one left it.

`@sw2d/schemas` supplies the concrete implementation (`packConfigValidator`), built on a new
general-purpose `registerSchema`/`validateBySchemaId` pair alongside the package's existing
fixed-`SchemaName` validator. A pack that owns a config schema (e.g. `@sw2d/packs`' progression
and arcade packs) registers it at module load and declares its `configSchemaId`; nothing about
that requires `@sw2d/schemas` to know a pack's schema in advance.

This is the same shape as ADR-0005's `ContentSource`: the runtime declares the boundary, a
composition root supplies what fills it.

## Consequences

- `@sw2d/runtime`'s dependency graph is unchanged (still only `@sw2d/contracts` + `phaser`).
  Verified: `packages/runtime/package.json`'s `dependencies` did not change; `@sw2d/packs` and
  `@sw2d/schemas` are `devDependencies`, used only by `packages/runtime/test/packsComposition.test.ts`.
- Enforcement is opt-in per `SystemHostImpl` instance. The starter's own `PlayScene` still
  constructs its host with two arguments and is unaffected - verified with a live browser
  regression (boot, move, pause, resume, restart) after this change.
- A config validation failure reuses the existing install-failure rollback path, so "one pack's
  bad config" and "one pack's install throwing" are now the same failure class with the same
  guarantee: nothing partially installed survives.
- Only packs with real, JSON-serializable config get a schema this phase (progression, arcade).
  Packs whose config is inherently non-serializable (puzzle's `createInitialState`/`isSolved`
  functions) correctly have no `configSchemaId` - there is nothing for a JSON Schema to check.

## Rejected

- **Importing `@sw2d/schemas` (or Ajv directly) into `@sw2d/runtime`.** The one alternative the
  Phase 4 brief explicitly ruled out; would have made "renderer-independent validation" and "the
  game runtime" the same dependency graph, undoing the separation ADR-0002 exists for.
- **Putting schema machinery into `@sw2d/contracts`.** Same reasoning as ADR-0005's `ContentSource`
  - contracts stays validator-agnostic, not validator-aware-but-inert.
- **A central pack-config schema registry inside `@sw2d/packs` that `@sw2d/schemas` imports.**
  Would invert the dependency the wrong way (schemas depending on packs) for no benefit; each
  pack registering its own schema at load time is simpler and keeps ownership local.
