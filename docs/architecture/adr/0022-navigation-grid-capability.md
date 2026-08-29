# ADR-0022: Navigation is a pure grid capability, separate from AI state

- Status: accepted
- Date: 2026-08-29
- Phase: Capability program, Phase 5 (Sonnet 5)

## Context

Several presets (`tower-defense`, `turn-based-tactics`, `lane-defense`,
`simple-rts`, `colony-lite`, stealth/heist) carried pathfinding limitations.
`ai.state` is idle/patrol/chase state only - each of those recipes would have
hand-rolled its own search.

## Decision

**`sw2d.navigation` → `world.navigation`**, a second world-family capability
(ADR-0011), *separate from `ai.state`*: AI/preset code **requests paths**, it
does not implement search.

- **Project-owned deterministic TypeScript, no new dependency.** A* with stable
  tie-breaking (`f`, then `h`, then insertion seq) and a Dijkstra reachable-range
  flood. `NavGrid`: `findPath(from, to, options?) → NavPath | null`,
  `reachable(from, budget, options?) → ReachableCell[]` (sorted `cost, row,
  col`), dynamic `setWalkable` / `setCost`, `worldToCell` / `cellToWorld`.
  `NavQueryOptions`: `diagonals` off by default; `cornerCutting: 'forbidden'`
  (default) disallows a diagonal step past a blocked shared orthogonal cell.
- **Renderer-neutral**, in `@sw2d/packs` - it is pure arithmetic, no Phaser.
- **Grid sources**: `NavService.defineGrid(spec)` (explicit) and
  `defineGridFromSolids(dims, solids)` (from a `NormalizedLevel`'s collision
  rectangles). Phaser tilemaps are not the only input.
- **Route follower**: `advanceAlongPath` (pure) plus a stateful
  `createRouteFollower` in `@sw2d/contracts` - `setDestination` once, `step`
  each frame, re-request after blockers change. No runtime helper needed;
  navigation touches no Phaser object.
- **No content document / schema.** Grids are built from level data or game
  config at scene-install time; there is nothing to author in `content/**` that
  a schema would validate. `main.ts` gains `navigationPack` so `sw2d.navigation`
  in a game's `systemPacks` installs.

## Consequences

- Proof consumers: `turn-based-tactics` (deterministic `reachable` movement
  range + `RouteFollower` movement) and `lane-defense` (continuous
  route-following + a dynamic blocker that re-paths every enemy; a
  route-destroying placement is rejected). `qa:proof` 12/12 → 14/14.
- `sw2d.navigation` is required by `tower-defense`, `turn-based-tactics`,
  `lane-defense`; optional on `simple-rts`, `colony-lite`, `stealth-game`,
  `heist-game`. Their pathfinding limitations are removed or narrowed to the
  remaining gap (attack-range resolution, box-select UI, vision/noise/hiding).
- `tower-defense`'s own proof keeps its hand-authored route (a `proof-validated`
  proof with a delicately-balanced victory condition); its nav retrofit is
  deferred. `lane-defense` covers the "authored route + dynamic block" intent.
- `LIMITATIONS.stealthAi` narrowed: "patrol navigation" removed (it can use
  `sw2d.navigation` now); vision cones / awareness / noise / hiding stay.

## Rejected

- **A pathfinding npm dependency.** A* on a grid is ~120 lines of deterministic
  project-owned code; a dependency would be speculative surface for no gain.
- **Putting navigation on `ai.state`.** AI consumes paths; conflating the two
  is exactly what this ADR avoids.
- **A `content/navigation.json` schema.** Grids derive from level/collision data
  or game config; there is no author-facing document to validate.
- **A Phaser-coupled runtime bridge.** Navigation is pure; the route follower is
  a pure function.
