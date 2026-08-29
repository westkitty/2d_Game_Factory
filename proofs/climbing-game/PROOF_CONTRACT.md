# Proof Contract — climbing-game

Capability program Phase 12 (ADR-0028) primary defining proof consumer.

## Preset

`climbing-game` (`packages/presets/src/catalog/platforming.ts`) — controller family
`platform`, required packs `sw2d.world` + `sw2d.world-entities` + `sw2d.climbing` +
`game.platform-shell`, content roles `tuning`, `levels`, `climbing`.

## Reusable capability exercised

- `sw2d.climbing` (`ClimbingService`, `createClimbingRuntime`) — provides `movement.climbing`.
- Wall slide: velocity clamped when sliding down a vertical wall.
- Wall jump: horizontal and vertical impulse away from wall contact side.
- Wall-to-wall movement: jumping from one vertical wall across a shaft to catch an opposing wall.
- Ledge detection & grab: detects nearby registered ledge coordinates and enters `ledge-hang`.
- Ledge drop: pressing down while hanging drops the player safely back into air/ground.
- Recovery after failed attempt: recovery after a dropped ledge grab to try traversal again.
- Ledge climb: pressing up while hanging vaults the player up and over the ledge onto the platform surface.
- Reinstall / teardown: clean disposal of runtime listeners without duplicate resources.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start on ground in platformer level.
2. Run right into shaft and jump against left wall -> enters `wall-slide` on left wall.
3. Slide speed clamped to configured `wallSlideMaxSpeed`.
4. Press Jump -> triggers `wall-jump` off left wall, projecting player across shaft.
5. Reach right wall -> enters `wall-slide` on right wall (wall-to-wall movement).
6. Jump up toward top ledge -> detects ledge and enters `ledge-hang`.
7. Press Down -> triggers `ledge-drop`, dropping player down (failed attempt).
8. Recover safely to ground and jump back up to ledge.
9. Ledge grab verified again; press Up -> triggers `ledge-climb`, vaulting player onto platform.
10. Walk to exit -> triggers objective completion.
11. Scene restart -> re-initializes cleanly without duplicate runtime resources.
