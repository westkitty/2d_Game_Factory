# ADR-0036: Match and falling-block engines are consumed, not a new pack

- Status: accepted
- Date: 2026-09-09
- Phase: Category-C capability program, Wave 9

## Context

`match-puzzle` and `falling-block-puzzle` still used the code-configured
`sw2d.puzzle` seam even though Phase 6 (ADR-0023) already shipped unit-tested
`match` and `falling-block` engines inside `sw2d.puzzle-rules`. Inventing a
second board pack would have duplicated that machine. Overlay kits keep their
local 3×3 / drop boards so P3-E stays valid.

## Decision

**Consume the existing bounded engines. Do not add a pack, schema, or
capability id.**

- **`content/puzzles.json`** already carries `match` and `falling-block`
  definitions. The generator now emits one starter of the matching kind for
  each consumer instead of a sokoban board for every grid `puzzle-rules`
  recipe.
- **`bindStarterPuzzle`** (runtime game-support) is the presentation/input
  adapter: match is cursor + select/swap; falling-block is move / rotate /
  gravity tick / hard-drop. Inert for sokoban and switch-sequence.
- **The generated `gridShellPack`** binds that adapter, hides the dummy
  actor, and leaves sokoban on the existing player-cell `move` loop.
- Overlay match / falling-block kits do not bind.

## Consequences

- Consumers: `match-puzzle`, `falling-block-puzzle`. Both require
  `sw2d.puzzle-rules` and content role `puzzles`. They no longer require
  `sw2d.puzzle`.
- `LIMITATIONS.puzzleBoardRules` names what is reusable and what is not.
- Snapshot extras now include the live `board` / `grid` / `active` cells so
  a renderer can draw without a parallel table.
- Catalog maturity stays unchanged. Pointer drag-swap and wall-kicks stay
  game-specific.

## Rejected

- **A new `sw2d.match` / `sw2d.falling-block` pack.** The engines already
  exist as kinds of `puzzle.rules`.
- **Folding overlay kits onto the service.** P3-E's local boards stay the
  overlay consumers.
- **Sharing a rail/shmup camera or a mega-pack of leftover Tier-3 singles.**
  Those still have one live consumer each.
