# ADR-0023: Standard puzzle rules are a bounded data-driven capability

- Status: accepted
- Date: 2026-08-29
- Phase: Capability program, Phase 6 (Sonnet 5)

## Context

ADR-0017 gave `sw2d.puzzle` (`puzzle.state`) a `configSource: 'code'` seam:
its config is two functions (`createInitialState` / `isSolved`), so a puzzle's
rules could never be content. Every puzzle-family preset (`sokoban`,
`puzzle-platformer`, `match-puzzle`, `falling-block-puzzle`, `physics-puzzle`,
`escape-room`) therefore carried `LIMITATIONS.puzzleConfigIsCode`: "the puzzle's
own rules are game-specific TypeScript, not content." For the *standard* puzzle
kinds this is an avoidable gap - the rules of Sokoban or a switch/sequence gate
are a small closed shape, not open-ended logic.

ADR-0017 explicitly rejected "a JSON puzzle DSL". That rejection stands for
**arbitrary** puzzle logic. This ADR does not introduce a DSL; it introduces a
**bounded discriminated union of built-in kinds**, the same shape ADR-0019
(items/effects) and ADR-0021 (encounters) already use.

## Decision

**`sw2d.puzzle-rules` → `puzzle.rules`**, a second puzzle-family capability
(ADR-0011), alongside `puzzle.state` - not a replacement for it.

- **Bounded model in `@sw2d/contracts` (`puzzles.ts`).** `PuzzleRules` is a
  discriminated union of five built-in kinds: `sokoban`, `switch-sequence`,
  `match`, `falling-block`, `physics-goal`. `PuzzleOp` is a fixed operation
  vocabulary (`move` / `toggle` / `swap` / `rotate` / `tick` / `hard-drop` /
  `report-entity`) - never arbitrary code. `PuzzleRulesDoc` is a list of named
  definitions; a game selects one by id.
- **`content/puzzles.json`, schema `puzzle-rules`** (`urn:sw2d:schema:content-puzzle-rules:v1`),
  registered as content document `puzzles` in `@sw2d/schemas`. Always emitted by
  the generator (like `items`/`weapons`/`encounters`); empty unless the preset
  installs `sw2d.puzzle-rules`.
- **`@sw2d/packs` `puzzleRulesPack`** turns the chosen definition into a live
  board: `load(id)`, `apply(op) → PuzzleSnapshot`, `undo()`, `reset()`,
  `isSolved()`, `snapshot()`. One small pure engine per kind owns
  legal-move/legal-push/match/lock/solved resolution; the shell never re-derives
  a rule. Renderer-neutral, no Phaser, no new dependency. With no definition
  loaded (`content/puzzles.json` empty) `apply`/`reset` are no-ops, not throws.
- **`sw2d.puzzle` (`configSource: 'code'`) stays** for a genuinely unique
  mechanic that is not one of the built-in kinds. `match-puzzle`,
  `falling-block-puzzle`, `physics-puzzle`, `escape-room` keep selecting it and
  keep a (rewritten, accurate) `LIMITATIONS.puzzleConfigIsCode`.
- **Generated shells consume it optionally.** `gridShellPack` (when
  `puzzle.rules` is present) maps a grid step to a `move` op, `CANCEL` to
  `undo()`, `SECONDARY_ACTION` to `reset()`, and renders from the snapshot.
  `platformShellPack` exposes the snapshot and binds `SECONDARY_ACTION` to a
  `toggle` and `CANCEL` to `undo()`. `main.ts` gains `puzzleRulesPack`.

## Consequences

- Proof consumers: `sokoban` (revised - the whole push/goal ruleset is now
  `content/puzzles.json`, `packConfig.ts` is `{}`) and `puzzle-platformer` (new
  - a `switch-sequence` gate with a link and a press-order completion rule,
  driven from the same document by a platform shell). `qa:proof` 14/14 → 15/15.
- `sokoban` and `puzzle-platformer` no longer require `sw2d.puzzle`; their
  `LIMITATIONS.puzzleConfigIsCode` is **removed** (reusable capability +
  generated consumer + regression coverage + two distinct proof consumers).
  `sokoban` stays `proof-validated`.
- `LIMITATIONS.puzzleConfigIsCode` rewritten: standard kinds are now
  content-authorable; the four recipes that keep it do so for a kind the union
  does not cover.
- Fifteen packs now have a preset consumer (`PRESET_CAPABILITY_MATRIX.md`).

## Rejected

- **A universal JSON puzzle DSL.** Still rejected (ADR-0017). This is a closed
  set of built-in kinds with a fixed op vocabulary, expanded by pure functions -
  no expression evaluation, no scripting.
- **Folding standard kinds into `sw2d.puzzle`.** `puzzle.state` keeps `TState`
  opaque by design; a bounded content model needs its own concrete types and its
  own capability id, exactly as ADR-0011 anticipates for a growing family.
- **Migrating `match-puzzle` / `falling-block-puzzle` / `physics-puzzle` /
  `escape-room` now.** The engines exist and are unit-tested, but no generated
  starter consumes them yet, so the limitation-audit bar is not met; they stay
  on the code seam with a narrowed limitation.
- **A Phaser-coupled runtime bridge.** The engines are pure; the shells call the
  service directly.
