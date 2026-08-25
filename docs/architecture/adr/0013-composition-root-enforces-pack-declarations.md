# ADR-0013: A pack's declarations are enforced where the game is composed

- Status: accepted
- Date: 2026-08-25
- Phase: 5 (Opus 5)

## Context

`SystemPackDefinition` carries two claims that nothing checked in a running game.

**`configSchemaId`.** [ADR-0010](0010-pack-config-validation.md) added dependency-inverted
enforcement in Phase 4: `SystemHostImpl` takes an optional `PackConfigValidator`, `@sw2d/schemas`
supplies one, tests exercise both paths. But the validator was reachable only by constructing a
host directly. `PlayScene` - the only place a real game constructs one - passed two arguments, so
the starter ran with enforcement off.

The cost of that was not hypothetical. `starter.placeholder-mover` declared
`configSchemaId: 'starter/placeholder-mover.config.json'`, an id no schema anywhere in the
repository carried, with the comment "enforced by the validator Sonnet builds in Phase 2" - a
phase that shipped without touching it. The declaration had been wrong since Phase 1 and could
not be discovered, because nothing ever resolved it. Turning enforcement on would have thrown
`UnregisteredSchemaError` at boot. This is the shape of the problem at 74 presets: a per-instance
opt-in means every generated game can silently forget, and a forgotten declaration hides its own
defects.

**`provides`.** `resolveInstallOrder` trusts a pack's `provides` list to satisfy another pack's
`dependencies`. Nothing checked that the pack then published those ids.
`starter.placeholder-mover` declared `provides: ['starter.player']` and never called
`context.capabilities.provide()`. Today nothing depends on it, so nothing broke; with a dependent
pack, resolution would have succeeded and the failure would have surfaced later, inside the
*dependent* pack's `require()`, naming the wrong pack.

Both are the same failure class: metadata that describes a contract nobody evaluates.

## Decision

**`createGame` accepts the validator.** `CreateGameOptions` gains
`packConfigValidator?: PackConfigValidator`, threaded through `PlayScene` to `SystemHostImpl`.
The runtime's dependency graph is unchanged - `PackConfigValidator` is a `@sw2d/contracts`
interface and the import is type-only; `@sw2d/runtime` still depends on `@sw2d/contracts` and
`phaser` alone. A generated game supplies `packConfigValidator` from `@sw2d/schemas`, as the
starter now does.

It stays *optional*, because a composition root without a schema layer is legitimate (a test
harness, the CLI's dry-run) and ADR-0010's backward compatibility is worth keeping. But
forgetting is no longer silent: in a debug build, `createGame` warns once, naming every pack whose
`configSchemaId` is going unenforced.

**`SystemHostImpl` verifies `provides` after install.** When `definition.install()` returns, every
capability id the definition declared must be published. A pack that declared one and did not
publish it fails at install with a named error and the same rollback path a failed install or a
failed config validation already used.

**The starter is the worked example.** `starter.placeholder-mover` now owns a real
`placeholder-mover-config.schema.json` (registered by the pack module, per ADR-0010's
"each pack registers its own schema"), declares that schema's `$id`, and drops the `provides`
entry it never published - rather than inventing a service no second system consumes
(`OPERATIONAL_STATE.md` invariant 14).

## Consequences

- A generated game gets enforcement by wiring one option, and is told in development when it has
  not. "Declared but unenforced" is no longer a state a game can be in without knowing.
- The starter's config schema is real: a positive `jumpVelocity`, a zero `moveSpeed` or an
  unknown field is now rejected before install, with a located error
  (`starter/test/packConfig.test.ts`).
- A pack's `provides` list is now load-bearing rather than descriptive, which is what
  `resolveInstallOrder` already assumed it was.
- Verified in a real browser against the production build: boot, title, movement (`vx` 220, and
  385 dashing), jump (`vy` -430, the schema-validated value), pause, resume, eight pause-menu
  restarts, quit-to-title and a fresh run - zero console errors, every live counter and the live
  Phaser GameObject count flat.

## Rejected

- **Making `packConfigValidator` required.** Breaks every existing call site, and forces a schema
  layer on composition roots that legitimately have none. The debug warning closes the actual gap
  - silence - without the breakage.
- **Enforcing `configSchemaId` inside `resolveInstallOrder`.** It is a pure function with no
  validator and no context; giving it one would make pack composition untestable without a schema
  library, undoing what ADR-0004 bought.
- **Deleting `starter.placeholder-mover`'s `configSchemaId` instead of giving it a real schema.**
  The starter is what presets and generated games are copied from. It should demonstrate the
  boundary working, not demonstrate opting out of it.
- **Inventing a `starter.player` service so the `provides` entry could stay.** An abstraction with
  no consumer, to preserve a declaration nothing reads.
