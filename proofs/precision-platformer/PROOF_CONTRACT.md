# Proof Contract — precision-platformer

Frozen before implementation. Phase 12 capability proof for platformer climbing, wall-slide, wall-jump & ledge-hang.

## Preset

`precision-platformer` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world` + `sw2d.world-entities`, optional packs `sw2d.arcade` + `sw2d.climbing`, content roles `tuning` + `levels` + `climbing`.

## Reusable capabilities exercised

- `sw2d.climbing` (`ClimbingService`, capability `movement.climbing`) — wall-slide speed clamping, wall friction, wall stick timer, wall jump velocity and directional resolution, ledge grab tolerances and hanging state, ladder climbing.
- `sw2d.world` (`WorldService`) — level objective flags (`objective.exit-reached`).
- `sw2d.world-entities` (`EntityRegistry`) — `PlayerSpawn`, `Exit`, `Solid` objects in `content/levels/main.json`.
- `content/climbing.json` (`ClimbingConfig`) — validated against `urn:sw2d:schema:content-climbing-config:v1`.
- `content/tuning.json` (`player.moveSpeed/jumpVelocity/gravity`) — read live from content.
- Platform controller (`platformController.read`) for move/jump intent.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Launch and start — confirm `Space` to enter play; scene reaches `sw2d.play`, `sw2d.climbing` pack installed.
2. Advance toward Wall A and jump into wall:
   - Walk right to `x >= 320`.
   - Jump up into left face of Wall A (`x = 340`).
   - Contacts wall while airborne, enters `wall-stick` then `wall-slide`.
3. Wall slide slow fall:
   - Falling speed clamped to `wallSlideMaxSpeed` (70 px/s vs normal gravity 1100 px/s^2).
   - `wallSlideDemonstrated === true`.
4. Wall jump off Wall A:
   - Press `Space` / `jumpPressed` while in `wall-slide`.
   - Velocity reflects off wall: positive X (toward Wall B) and negative Y (upward).
   - `wallJumpDemonstrated === true`.
5. Arrive at Wall B / Ledge:
   - Horizontal velocity carries player across the shaft to Wall B (`x = 480`).
   - Hits ledge region at `(480, 160)` within tolerances.
   - Enters `ledge-hang` (stops falling, `vy = 0`, `vx = 0`).
   - `ledgeHangDemonstrated === true`.
6. Climb up from ledge:
   - Press jump / climb up (`ArrowUp`).
   - Player vaults up over the ledge onto `TopPlatform` (`y < 160`).
   - `ledgeClimbDemonstrated === true`.
7. Walk across top platform to Exit:
   - Move right along top platform.
   - Overlap Exit sprite (`objectiveReached === true`).
