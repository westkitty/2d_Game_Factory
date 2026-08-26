# Proof Contract — chase-platformer

Frozen before implementation. Changes after this point are implementation bugs to fix, not scope to renegotiate.

## Preset

`chase-platformer` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world` + `sw2d.world-entities`, optional packs `sw2d.combat` + `sw2d.arcade`, content roles `tuning` + `levels`. Currently `smoke-validated`; this proof is the basis for promoting it to `proof-validated`.

Generated via `npm run sw2d -- new proof-chase-platformer --preset chase-platformer`, then moved from `games/proof-chase-platformer/` (gitignored scratch output) into this committed `proofs/chase-platformer/` tree unmodified except where this contract calls for game-specific extension.

## Reusable capabilities exercised

- `sw2d.world` (`WorldService`) — flags for collected-item state, `activateCheckpoint`/`currentCheckpoint` for the real checkpoint.
- `sw2d.world-entities` (`EntityRegistry`) — `PlayerSpawn`, `Checkpoint`, `Collectible`, `Hazard`, `Exit` Tiled classes, dispatched from the existing Tiled content pipeline. No new Tiled class families beyond what the generator already ships in `content/levels/main.json`.
- `sw2d.combat` (`CombatService`) — player registered with finite health; `damage`/`heal`/`setInvulnerableFor` drive hazard damage, death, and post-respawn invulnerability. This is the proof's real death mechanism, not a game-specific health field.
- `sw2d.arcade` (`ArcadeService`) — `addScore` on collectible pickup. Not load-bearing for pass/fail, but proves the optional pack composes correctly alongside combat.
- `content/tuning.json` (`player.moveSpeed/jumpVelocity/gravity`) — read live, not hard-coded (Gate B lock).
- Platform controller (`platformController.read`) for ground/air movement input, unmodified.

## Game-specific mechanics (in `src/game-specific/shellPack.ts`, local constants — not promoted to a shared controller; no other proof consumer exists to trigger that promotion)

- Coyote time (120 ms grace to jump after leaving ground).
- Jump buffer (150 ms grace: a jump press just before landing executes on landing).
- Double jump (one extra mid-air jump, independent of coyote; resets when grounded).
- Chase pressure: a millisecond counter that advances only while `outcome === 'playing'` and no spawn-grace window is active. Frozen automatically while the scene is paused (Phaser never calls a paused scene's `update()` — same proof-by-absence the Phase 8 demo already established) and explicitly frozen during a 500 ms spawn-grace window after every (re)spawn.
- Death: hazard contact damages the player through `CombatService`; health reaching 0 triggers respawn. Chase pressure reaching a high threshold (45,000 ms) is a second, real death cause ("caught"), not exercised to completion by the automated journey but genuinely wired.
- Checkpoint respawn: on death, the player is restored to the last-activated checkpoint's position (or the original spawn if none activated yet), fully healed, granted 800 ms of invulnerability, and chase pressure resets to 0.
- Collectible quota: quota is derived from content, not hard-coded — it equals the number of `Collectible` objects present in `content/levels/main.json` (currently 2). Collected state is tracked via world flags, so it survives death/respawn.
- Level clear: the `Exit` overlap only resolves to `outcome: 'escaped'` once the collected count meets quota; otherwise it is a no-op (not a hard rejection, matching "level tuning does not require engine edits" — adding/removing a collectible in content changes the quota with no code change).

## Content roles used

- `tuning` — `content/tuning.json`, schema unchanged (`player.moveSpeed/jumpVelocity/gravity`).
- `levels` — `content/levels/main.json`, extended with one additional `Collectible` and one small floating `Solid` ledge (see below), still validated by the existing Tiled pipeline/schema (object `class` is an open string at the schema level; no schema change).

Level layout (frozen): flat ground spans the full level so the main path to the Exit is always walkable regardless of jump timing (no softlock risk from mistuned physics). A separate floating ledge above the ground exists purely to create a real "leave the ground" moment for coyote-time and to hold the second collectible, reachable by a single ordinary jump. `Checkpoint` sits before the ledge and before the `Hazard`; `Hazard` sits between the ledge and the `Exit`, so a checkpoint is always active before the player can take damage.

## Terminal success/failure oracle

- **Success:** debug snapshot from `game.platform-shell` reports `outcome === 'escaped'` after quota was met.
- **Failure surface (all observable, none inferred):** `deaths` (count), `lastDeathCause` (`'hazard' | 'caught' | null`), `collected` / `quota`, `checkpoint` (id or null), `chasePressure`, `health` (`{current, max}`), `onGround`, `jumpsUsed`, `lastJumpKind` (`'ground' | 'coyote' | 'double' | 'buffered' | null` — added during implementation so coyote/double/buffered jumps are independently distinguishable by the automated journey instead of inferred from timing alone), `jumpBufferPending` (bool).

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Launch/start — confirm to enter play (`Space`), scene reaches `sw2d.play`.
2. Move and jump — walk right (collecting coin-1 and activating the checkpoint on the ground first), then a single running jump onto the ledge (collecting coin-2). The jump is launched from outside the ledge's horizontal footprint, as any running jump onto a platform must be — jumping from directly underneath a platform hits its underside, not its top.
3. Coyote jump, double jump, and buffered jump — all three are demonstrated together in one continuous fall after walking off the ledge's far edge: a coyote jump (pressed just after leaving the ledge, within the 120 ms grace), then a double jump (a second aerial jump while still airborne), then a third press with both aerial jumps already spent, which buffers (`jumpBufferPending`) and fires automatically the instant the player lands (`lastJumpKind === 'buffered'`).
4. Collect quota — walk over both `Collectible` objects (coin-1 on the ground, coin-2 on the ledge); `collected === quota`.
5. Activate checkpoint — overlap the `Checkpoint` on the ground; `checkpoint !== null`.
6. Hit hazard/enemy and die — cross the `Hazard` twice (health 15, damage 10 per hit, 800 ms invulnerability between hits so two deliberate passes are required); second hit drives health to 0, `deaths` increments, `lastDeathCause === 'hazard'`.
7. Respawn at activated checkpoint — position resets to the checkpoint, `collected` unchanged (quota state survives death).
8. Chase pressure advances during interactive play — sampled increasing across two points in normal play.
9. Chase pressure does not advance while paused, and does not advance during the post-respawn spawn-grace window — sampled flat across both windows.
10. Reach exit after quota — cross the `Hazard` a third time (non-lethal, health resets full on respawn) and reach `Exit` with quota already met.
11. Terminal state — `outcome === 'escaped'`.

## Acceptance

- Checkpoint respawn is real (position + full heal + invulnerability grant, not cosmetic).
- Quota genuinely gates the exit (derived from content, not hard-coded to 2 in code).
- Pause and spawn-grace both genuinely freeze chase pressure, through two independent mechanisms.
- Automated journey reaches `escaped`.
- No engine/runtime edits required after this contract is frozen; level retuning (e.g. adding a third collectible) does not require a code change to the quota logic.
- No unsupported performance claims — deterministic frame stepping proves correctness/determinism only, never framerate.
