# ADR-0007: Namespaced, versioned, corruption-tolerant saves

- Status: accepted
- Date: 2026-08-24
- Phase: 1 (Opus 5)

## Context

`MASTER_PROJECT.md` §16 requires local persistence namespaced by game id, versioned, safe
against corrupt values, with reset and explicit migration or invalidation, and no silent
cross-loading between generated games. Many generated games will be served from the same
static origin, so namespacing is a correctness requirement, not hygiene.

## Decision

Three layers.

**`StorageDriver`** wraps `localStorage` and never throws. Private browsing, blocked
third-party storage and quota errors all make `localStorage` throw on access; a game must still
boot. `available` reports the truth. `MemoryStorageDriver` serves tests and unusable-storage
environments.

**`SaveStore`** keys everything as `sw2d:<gameId>:<slot>`. On load it reports an explicit
outcome - `default | loaded | migrated | invalid | unavailable`. Unparseable JSON is discarded
and reported. A version mismatch is migrated if the slot supplies `migrate`, otherwise
explicitly invalidated; it is never reinterpreted as the current shape.

**`SettingsStore`** is built on `SaveStore`. Every load and patch passes through
`normaliseSettings`, which clamps volumes and shake into 0..1, coerces unknown enum values to a
safe default and always stamps the current schema version. `reset()` restores the *game's*
defaults, not the factory's.

IndexedDB is not used. It is reserved for data that materially needs it, such as replay
history (`MASTER_PROJECT.md` §16).

## Consequences

- Two games on one origin cannot read each other's saves. Covered by test.
- A corrupt or stale record degrades to defaults with a warning rather than crashing at boot -
  the `c_chase` hardened-storage lesson, kept.
- `loadOutcome` appears in the debug snapshot, so QA can tell a fresh profile from a
  discarded one.
- Settings are the single source of truth for volume and accessibility. The audio bus and the
  accessibility projection derive from it and hold no copies, so they cannot desynchronise.

## Rejected

- **Storing raw values without a schema version.** Guarantees a silent misread on the first
  shape change.
- **Throwing on unavailable storage.** Turns a privacy setting into a crash.
- **A shared namespace with per-game prefixes inside one record.** One corrupt game takes out
  every game on the origin.
