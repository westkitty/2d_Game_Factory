# ADR-0039: Consume the puzzle code seam in the pointer shell

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 12

## Context

`physics-puzzle` and `escape-room` still required `sw2d.puzzle` (`configSource:
'code'`) after Wave 9 moved match and falling-block onto `sw2d.puzzle-rules`.
The generated packConfig was a 3-move counter the pointer shell never called,
so both recipes entered play as a dummy click target. Inventing a new puzzle
pack would duplicate ADR-0017 / ADR-0023. Folding them into match/sokoban
kinds would lie about the genre.

The two leftovers are not one machine. Physics-puzzle is a Matter ball that
must land in a goal. Escape-room is two linked inspect hotspots. Overlay
physics-puzzle and escape-room kits stay local (P3-E / P3-K).

## Decision

**Consume the existing `sw2d.puzzle` code seam. Do not add a pack, schema, or
capability id. Do not invent a puzzle DSL.**

- **`physics-puzzle`** keeps `sw2d.puzzle` plus `physicsProfile: 'matter'`.
  Generated packConfig state is `{ kind: 'physics-goal', inGoal }`. The
  pointer shell nudges the Matter ball (click or J/X) and `apply()`s when it
  crosses the goal.
- **`escape-room`** keeps `sw2d.puzzle`. Generated packConfig state is
  `{ kind: 'escape-locks', note, key }`. The pointer shell registers note /
  key / door hotspots; the key stays locked until the note is inspected;
  `isSolved` when both flags are set.
- **No third consumer.** Point-and-click already uses `sw2d.dialogue`.
  Optional `sw2d.puzzle` on investigation / physics-toy stays optional.

`LIMITATIONS.puzzleConfigIsCode` stays: these rules are TypeScript, not
`content/puzzles.json`. Escape-room also keeps the content-authored grammar
leftover.

## Consequences

- No new pack. Pack count stays 28. `sw2d.puzzle` required consumers stay 2.
- Catalog maturity stays unchanged.
- Overlay physics-puzzle / escape-room kits stay local.

## Rejected

- **A new physics-puzzle / escape-room pack.** The opaque state machine
  already exists.
- **Authoring them as `sw2d.puzzle-rules` kinds.** Ball-in-goal and gated
  inspect are not match / falling-block / sokoban / switch-sequence.
- **A mega-pack of leftover Tier-3/4 singles.** Climbing, chase, territory,
  pinball, crop/season and rail camera still have one live consumer each.
