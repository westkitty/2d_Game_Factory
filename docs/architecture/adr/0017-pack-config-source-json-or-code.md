# ADR-0017: A pack declares whether its config is JSON or code

- Status: accepted
- Date: 2026-08-26
- Phase: 9 (Opus 5, Architecture Integration Gate B)

## Context

Every `@sw2d/packs` core is configured from `content/game.json`'s `systemPacks[].config` - plain
JSON, optionally validated against the pack's `configSchemaId` (ADR-0010, ADR-0013). One pack is
not like the others: `sw2d.puzzle`'s config is two **functions**
(`createInitialState()`, `isSolved(state)`), because the pack keeps the puzzle's state type opaque
rather than imposing a universal puzzle DSL. A function cannot be expressed in JSON, so that pack
has no `configSchemaId` - correctly.

Phase 8 recorded this as prose in the pack's own doc comment and in one preset's
`knownLimitations`, and left the generator unchanged. The generator writes `config: {}` for every
required pack a preset selects. Nothing evaluated the distinction, so nothing stopped it.

Phase 9's generated-runtime matrix showed what that cost. **All six presets requiring
`sw2d.puzzle`** - `sokoban`, `puzzle-platformer`, `match-puzzle`, `falling-block-puzzle`,
`physics-puzzle`, `escape-room` - generated games that passed `tsc`, passed `vite build`, passed
every static all-74 check, booted to a title screen, and then threw
`TypeError: createInitialState is not a function` the instant the player pressed CONFIRM.
`SystemHostImpl`'s install rollback then tore down the shell pack too, so those games had no
gameplay at all. Build success had been mistaken for install success, and a limitation recorded
only in prose had propagated into six broken starters.

## Decision

**A pack declares where its config legitimately comes from, and the system routes on that
declaration.**

`SystemPackDefinition` gains one optional field:

```ts
readonly configSource?: 'json' | 'code';   // default 'json'
```

- `'json'` (default, every pack but one): config is data. It travels in
  `systemPacks[].config`, a `configSchemaId` may validate it, and the generator may serialize it.
- `'code'`: config carries functions or other live values. It travels **only** through
  `createGame({ packConfig })`, a `Record<packId, unknown>` supplied at the composition root. Such
  a pack never has a `configSchemaId`, because there is nothing a JSON Schema could validate.

Three consequences follow, each enforced rather than documented:

1. **`SystemHostImpl` routes on it.** For a `configSource: 'code'` pack it ignores the selection's
   JSON config entirely and reads `packConfig[packId]`. If that is absent, the install is refused
   **by name, at install time**, with a message naming the pack, the reason, and the fix - instead
   of handing the pack `{}` and letting it throw an opaque `TypeError` several frames later, far
   from the actual mistake. This is the same "fail where the mistake is" principle ADR-0013 applied
   to declared-but-unpublished capabilities.
2. **The generator emits the right seam.** Every generated game gets
   `src/game-specific/packConfig.ts`, and `src/main.ts` always passes `packConfig: PACK_CONFIG`
   (so `main.ts` stays byte-identical across all 74 presets - only `packConfig.ts` varies). A
   preset selecting a code-configured pack gets a **working** deterministic placeholder in that
   file; every other preset gets an empty, documented map.
3. **`packConfig` is not a general escape hatch.** `SystemHostImpl` consults it *only* for a pack
   whose definition declares `configSource: 'code'`. A JSON-configured pack's configuration stays
   in `content/**`, where content authors can reach it, and cannot be quietly moved into code.

## Consequences

- All 74 presets now really enter play from a generated starter, verified by
  [`tools/scripts/generated-runtime-matrix.ts`](../../../tools/scripts/generated-runtime-matrix.ts)
  (37 distinct runtime signatures + every `sw2d.puzzle` preset individually: 40/40).
- `src/game-specific/packConfig.ts` is a normal-game-work surface, in the same directory as every
  other game-specific mechanic. Replacing the placeholder puzzle is ordinary game authoring, not a
  runtime edit.
- The JSON/code boundary is now explicit before Phase 10 rather than discovered five times during
  it. A future pack that needs live-value config declares `configSource: 'code'` and inherits the
  whole path; it does not invent a sixth private mechanism.
- `sw2d.puzzle` keeps deterministic state, undo/reset/solved semantics, and an opaque `TState`.
  **No universal puzzle DSL was created**, and none should be created without a proof requirement
  that demands one.
- The field is optional and defaults to `'json'`, so every existing pack, selection and test is
  unaffected.

## Rejected

- **A JSON-serializable declarative puzzle format** interpreted by the pack (the directive's
  option A in its literal form). This is a universal puzzle DSL by another name, and Phase 9's own
  brief forbids inventing one without proof-driven need. Sokoban, match-3 and falling-block puzzles
  do not share a rule format; any schema covering all three would either be an interpreter or be
  so loose it validates nothing.
- **Documenting the limitation at pack level and leaving the generator alone** (option B in its
  weakest form). This is what Phase 8 did. It leaves six presets generating broken starters and
  moves a falsehood from one document to another - the exact "metadata nothing evaluates" shape
  both architecture gates exist to catch.
- **Dropping code-configured packs from the generated `systemPacks` list.** Removes the crash but
  also removes the capability, permanently stranding all six presets in the hand-rolled workaround
  `sokoban` had to use. A seam keeps the pack usable; a deletion does not.
- **Letting `packConfig` override any pack's config.** A general code-side override would let a
  generated game quietly move JSON-configurable tuning out of `content/**`, breaking the
  content-authoring boundary the whole factory rests on. Routing strictly on `configSource` keeps
  the two paths separate and makes which one applies a property of the pack, not of the caller.
