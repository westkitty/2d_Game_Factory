# Proof Contract — metroidvania

Capability program Phase 8 (world graph / rooms / transitions / map, ADR-0025). Written retroactively by the Category-C convergence program from the committed spec (`packages/qa/proof-specs/metroidvania.ts`) and the PROOF_MATRIX row; the proof game itself is frozen and unchanged.

## Preset

`metroidvania` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world`, `sw2d.world-entities`, `sw2d.progression`, **`sw2d.world-graph`**. Content roles tuning, levels.

## Reusable capability exercised

- `sw2d.world-graph` (`WorldGraphService`): three nodes each naming its own Tiled level; `createRoomTransitionRuntime` (tear down one room, build the next at the destination entrance); `createWorldMapOverlay`; a bounded `flag` traversal condition; opt-in persistence.

## Terminal success/failure oracle

- **Success surface:** Hub→East; locked East→Treasury rejected (`condition-failed`); the lever sets `treasury-unlocked` and `canTraverse` flips; East→Treasury; the flag survives the return; the map shows 3 areas with the current one marked; `roomDoorSprites` stays bounded; restart restores the graph through persistence.
- **Failure surface:** `worldGraph.{current,discovered,transitions}`, room door sprite count, the `treasury-unlocked` flag.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start in Hub.
2. Door -> Hub→East.
3. Locked door -> East→Treasury rejected (`condition-failed`).
4. Lever INTERACT -> flag set, `canTraverse` true.
5. East→Treasury; return to East, flag still set.
6. Open the map (3 areas, current marked); `roomDoorSprites` bounded.
7. Restart -> persistence restores `currentNode` and discovered set.

## Acceptance

- Zero console errors, zero external requests.
