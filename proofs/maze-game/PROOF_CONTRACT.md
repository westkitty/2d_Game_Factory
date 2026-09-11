# Proof Contract — maze-game

Frozen before implementation. Category-C Wave 19 (existing `sw2d.navigation`, ADR-0046) - grid occupancy maze on the grid shell.

## Preset

`maze-game` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `grid`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.navigation`**. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-maze-game --preset maze-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.navigation` `NavGrid` walkable occupancy refuses steps into walls; `findPath` supplies the shortest-path length as a live hint. `bindStarterNavigation` (`NAV_STARTER 'maze'`).

## Terminal success/failure oracle

- **Success surface:** a step into a wall is `wall` and the player stays; corridor steps are `moved` and the path hint shrinks; the exit is `escaped` / `complete`; moves after the exit are inert; restart reinstalls at (4,8).
- **Failure surface:** `navigation.{playerCol,playerRow,exitCol,exitRow,pathLength,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.navigation` installed; mode `maze`; player (4,8); exit (12,8); `pathLength 13`.
2. ArrowUp -> `wall`, still (4,8).
3. Right ×2 -> (6,8), `moved`, `pathLength < 13`.
4. Down ×2, Right ×4, Up ×2, Right ×2 -> (12,8), `escaped`, `complete`; ArrowLeft -> unchanged.
5. Restart: (4,8), `playing`.

## Acceptance

- Maze generation and fog-of-war stay out (catalog limitation).
- Zero console errors, zero external requests.
