# ADR-0012: Gameplay events are declared by the package that raises them

- Status: accepted
- Date: 2026-08-25
- Phase: 5 (Opus 5)

## Context

`GameEventMap` in `@sw2d/contracts` is the typed cross-system event map. Its own doc comment has
said since Phase 1 that "system packs extend this via declaration merging ... that keeps gameplay
events out of the core."

Phase 4 added its twelve pack events (`combat:entityDamaged`, `world:flagChanged`,
`strategy:turnChanged`, ...) directly to the interface instead. The result contradicts the rule
the file states, and it scales the wrong way:

- `MASTER_PROJECT.md` §9 names sixteen pack families; nine exist. Phase 7 adds 74 presets.
  On the current trajectory the dependency-free core accumulates one entry per gameplay event
  in the entire project.
- More seriously, it puts `@sw2d/contracts` on the edit path for ordinary content work. The
  protected boundary (`OPERATIONAL_STATE.md`, and `docs/AGENT_WORKFLOW.md`) reserves
  `packages/contracts/**` for runtime work needing justification and regression coverage. Under
  the Phase 4 arrangement, a preset author who wants to raise one event has to edit it.

## Decision

**`@sw2d/contracts` declares runtime lifecycle events only** - the ones the machine itself raises
and any game may rely on: `game:booted`, `scene:changed`, `run:started`, `run:restarted`,
`pause:changed`, `settings:changed`, `accessibility:changed`, `audio:unlocked`.

**Every other event is declared by the package that raises it**, merged in through the mechanism
contracts already documents:

```ts
declare module '@sw2d/contracts' {
  interface GameEventMap {
    'combat:entityDied': { readonly entityId: string };
  }
}
```

The twelve Phase 4 events moved verbatim to `packages/packs/src/events.ts`, imported for its
augmentation by `packages/packs/src/index.ts`. Payload shapes, names and emit sites are
unchanged; only the file that declares them moved.

**Naming:** `<capability family>:<pastTenseFact>`. The family segment matches the capability-id
family from [ADR-0011](0011-capability-id-governance.md) (`combat:*` for `combat.*`), so an event
name says which family owns it without a lookup.

**The bar for adding one is unchanged and deliberately high**: an event exists where a
cross-system reaction is plausible (a HUD, another pack). A pack that needs an answer from another
pack calls its capability directly - `aiPack` reads `CombatService.get()` rather than subscribing
to `combat:entityDamaged`, and that remains the correct choice for a question with an answer.
Events are for facts other systems may want to *react* to. Do not add an event per internal
mutation, and do not add a subscriber to prove an event exists.

## Consequences

- Adding a gameplay event no longer requires editing a protected package. A future
  `@sw2d/presets` or a generated game's `src/game-specific/` can declare its own events the same
  way, without touching the machine.
- `emit`/`on` stay fully typed: whoever imports the package that owns the event sees it; whoever
  does not, does not - which is more accurate than the core knowing every event unconditionally.
- `@sw2d/contracts` keeps zero dependencies and stops growing with the content catalogue.
- Type-only change: no payload, emit site, subscriber or test assertion changed, and the
  production bundle is unaffected (the augmentation compiles to nothing).

## Rejected

- **Leaving the twelve events in contracts and applying this rule to new events only.** Would
  leave the core holding one arbitrary generation of gameplay vocabulary forever, and leave the
  file's own doc comment describing a rule the file breaks.
- **A runtime event registry with string ids and no compile-time map.** Trades every typed payload
  for a lookup table. The declaration-merging path keeps full typing at zero runtime cost.
- **A separate `GameplayEventMap` interface in contracts.** Same problem in a second interface: a
  pack still cannot add to it without editing contracts.
