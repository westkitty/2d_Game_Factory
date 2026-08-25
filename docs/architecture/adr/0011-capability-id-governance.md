# ADR-0011: Capability ids are namespaced `<family>.<service>`

- Status: accepted
- Date: 2026-08-25
- Phase: 5 (Opus 5)

## Context

Capability ids are the one string every pack, preset and generated game has to agree on.
`resolveInstallOrder` already *detects* a collision - it rejects two packs providing the same id
and names both - so the risk is not silent breakage. The risk is that an id claims more namespace
than the thing behind it delivers, and the collision it eventually causes is unavoidable rather
than a mistake.

Three conventions were live in the repository at the Phase 4 baseline:

- Phase 1's own pack-resolution and lifecycle tests use `combat.health`, `world.bounds`,
  `core.input`;
- Phase 4's nine pack cores publish flat family names: `combat`, `ai`, `world`, ...;
- the starter's game-specific pack publishes `starter.player`.

The flat form is the problem. `combatPack`'s own doc comment states it is "deliberately not a
combat system - no weapons, projectiles, melee collision, knockback"; `MASTER_PROJECT.md` §9.7
lists those as the rest of the same family. `worldPack` holds flags, checkpoints and zone state
while §9.9's world family is tilemaps, rooms, camera zones and transitions - Phase 6's subject.
A foundational core holding the id `combat` or `world` means the fuller family systems have
nowhere to publish, and `resolveInstallOrder` will correctly refuse them.

Nine ids are cheap to change now. After Phase 7's 74 presets select packs by id, they are not.

## Decision

**A capability id is `<family>.<service>`.** Lowercase segments, at least two, dash-separated
words allowed after the first (`/^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/`). The segment before the
first dot claims a *family*; everything after it claims one capability *within* that family. No
capability id may be a bare family name - that would reserve a namespace on behalf of systems
that do not exist yet.

The nine Phase 4 cores were renamed accordingly:

```text
combat.health   ai.state       world.state
progression.state   arcade.score   puzzle.state
simulation.resources   narrative.state   strategy.turns
```

**Pack ids stay vendor-prefixed and separate from capability ids.** `sw2d.combat` is a pack;
`combat.health` is what it publishes. A pack id is never reused as a capability id, so an
implementation can be swapped without the id its consumers depend on changing.

**Game-specific and third-party capabilities use their own owner segment**, as the starter
already did: `starter.player`, not `player`. A bare, unprefixed family name is reserved for
first-party `@sw2d/packs` families.

**This is a convention plus one test, not a registry.** `packages/packs/test/capabilityIds.test.ts`
asserts the pattern, uniqueness, the pack-id/capability-id split, and that each pack actually
declares the id `ids.ts` records for it. Nothing new is instantiated at runtime; there is no
central registry object, no reservation service and no allocation step - `MASTER_PROJECT.md` §47
rules those out and nothing here needs them.

## Consequences

- The fuller Phase 6+ family systems can publish alongside the Phase 4 cores instead of colliding
  with them: `world.tilemap` and `world.camera-zones` sit next to `world.state`.
- An id now says what the capability *is*, so `capabilities.list()` in a debug snapshot reads as
  an inventory rather than a list of family names.
- Phase 1's test vocabulary and Phase 4's shipped ids agree for the first time.
- Renaming later would have been a breaking change across every preset; renaming now touched
  `ids.ts` and test literals only, with no production consumer outside `@sw2d/packs`.

## Rejected

- **Keeping flat ids and writing the convention down for future packs only.** Would leave the nine
  most valuable names permanently held by the nine narrowest services.
- **A capability registry/reservation framework.** The failure mode is already detected at install
  time with a named error. A pattern and a test cost nothing to keep and add no runtime surface.
- **Prefixing capability ids with a vendor segment too (`sw2d.combat.health`).** A capability is
  the contract; a *vendor* prefix on it would defeat the reason pack ids and capability ids are
  separate strings - a second implementation could no longer provide the same capability.
