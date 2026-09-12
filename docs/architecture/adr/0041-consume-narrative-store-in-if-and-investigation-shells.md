# ADR-0041: Consume the narrative store in IF and investigation shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 14

## Context

`interactive-fiction-hybrid` and `investigation-game` already required
`sw2d.narrative` (node / flag / choice / seen store). The generated shells
never bound it, so IF entered play as dummy OPTIONS and investigation as a
top-down wanderer. Inventing a parser pack or an evidence-board pack would
violate the live-catalog rule that each leftover has one consumer. Extending
`sw2d.narrative` into dialogue graphs would duplicate `sw2d.dialogue`
(Wave 3 / ADR-0030). Folding IF or investigation into dialogue would lie
about parser commands and evidence linking.

The two leftovers are not one machine. IF is a bounded menu of verbs that
gate later options via flags. Investigation is walk-to-clue inspect that
marks seen entries, then a desk deduce.

## Decision

**Consume the existing `sw2d.narrative` store. Do not add a pack, schema, or
capability id. Do not invent a parser or evidence-board pack.**

- **`interactive-fiction-hybrid`** generated packConfig sets
  `NARRATIVE_STARTER = 'fiction'`. The ui-simulation shell presents LOOK /
  TAKE / LEAVE. TAKE stays locked until LOOK sets `saw-note`. TAKE and LEAVE
  are two endings via `choose()`.
- **`investigation-game`** generated packConfig sets
  `NARRATIVE_STARTER = 'case'`. The top-down shell walks to two clue markers
  (`markSeen`) then the desk (`choose('deduce')`). Complete when both clues
  are seen and the desk is confirmed.
- **No third consumer.** Visual-novel / point-and-click stay on
  `sw2d.dialogue`. Museum-exhibit stays optional narrative. Parser IF and
  evidence-board linking stay leftovers.

Scene restart calls `narrative.reset()` (the pack is game-lifetime). Overlay
IF / investigation kits stay local (P3-K).

## Consequences

- No new pack. Pack count stays 28. `sw2d.narrative` required consumers
  already included these two recipes.
- Catalog maturity stays unchanged.
- Overlay IF / investigation kits stay local.

## Rejected

- **A parser / text-command pack.** Only IF-hybrid needs typed commands.
- **An evidence-board / linking pack.** Only investigation needs deduction
  graphs.
- **Folding either into `sw2d.dialogue`.** Dialogue is authored conversation
  graphs; these consumers use the lightweight flag/node/seen store.
- **A mega-pack of leftover Tier-3/4 singles.** Climbing, chase, territory,
  pinball, rail camera and run-meta still have one live consumer each.
