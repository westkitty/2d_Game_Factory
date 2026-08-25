# ADR-0004: Core services on GameContext, options as system packs

- Status: accepted
- Date: 2026-08-24
- Phase: 1 (Opus 5)

## Context

`MASTER_PROJECT.md` §7 asks for a bounded context rather than hidden globals, §8 for a system
pack model, and §47 warns against building a plugin framework for its own sake. The line
between "always there" and "composed in" has to be drawn once.

## Decision

**Core services live on `GameContext` and are always present**: events, input, settings, saves,
audio, accessibility, assets, content, capabilities, router, debug, disposables.

**Optional capabilities are system packs.** A pack declares `provides` and `dependencies` as
capability ids - never a module import of another pack - and returns an `InstalledSystemPack`
with a `dispose()`.

The test for which side something belongs on: *a pack may be absent.* Anything a scene cannot
function without is a context service.

Ownership rules:

- `SystemHostImpl` owns one scene's packs: installs in dependency order, tears down in reverse,
  rolls back a partial install.
- `resolveInstallOrder()` is a pure function. It rejects unknown packs, duplicate selections,
  duplicate capabilities, capabilities shadowing core ones, unsatisfiable dependencies and
  cycles - naming the offending pack and capability in the message.
- `CapabilityRegistry.provide()` returns a `Disposable`; withdrawal is symmetric with
  publication.
- Packs never own the game loop. The host calls `update(deltaMs)`.

## Consequences

- Pack composition is testable in plain Node with no browser and no renderer, which is how
  Phase 1 shipped real coverage for it before any pack existed.
- Dependency ordering is deterministic: among ready packs, selection order wins, so the same
  input always produces the same order.
- Disposing a scene disposes its host, which disposes every pack. That single ownership chain
  is the whole leak story - verified across 8 restarts with flat counters.
- `configSchemaId` is declared on the pack contract now and enforced by the Phase 2 validator.
  It is a declared field, not an unused method.

## Rejected

- **A dependency-injection container.** `MASTER_PROJECT.md` §47. The context is a plain object.
- **Packs importing packs directly.** Produces the circular ownership §7.1 forbids.
- **An ECS.** No proof requires one; it would be an abstraction with no second consumer.
