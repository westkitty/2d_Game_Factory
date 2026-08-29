# Proof Contract — bullet-hell

Frozen before implementation. Phase 4 of the capability-completion program (combat / encounter orchestration, ADR-0021).

## Preset

`bullet-hell` (`packages/presets/src/catalog/shooter.ts`) — controller family `top-down`, required packs `sw2d.combat`, `sw2d.weapons`, **`sw2d.encounters`**, optional `sw2d.arcade`. Content role `tuning`.

Generated via `npm run sw2d -- new proof-bullet-hell --preset bullet-hell`; the preset requires `sw2d.encounters`, so the generated game ships `content/encounters.json` and installs the pack. Customized in `content/encounters.json` + `content/weapons.json` (an `enemy-bullet` weapon) and `src/game-specific/shellPack.ts` (wires `createEncounterRuntime` + `createProjectileRuntime`).

## Reusable capability exercised

- `sw2d.encounters` (`EncounterService`) — a single phase with two **capped** phase-level emitters (`ring` 12, `maxEmissions` 8; `spiral` 3 / +17°/emission, `maxEmissions` 16) and one spawn wave (4 drones from a `rect` spawn point). Completion condition `elapsed 2600ms`.
- `expandFirePattern` — the deterministic ring/spiral direction math.
- `createEncounterRuntime` (`@sw2d/runtime/game-support`) — builds the `EncounterUpdateContext`, materialises the drone spawns via the shell's callback, and fires the patterns through Phase 3's `createProjectileRuntime`.
- `combat.health` — player and each drone registered; enemy bullets damage the player, the player's `sidearm` kills the drones, both through `combat.damage`; `enemy` vs `player` teams keep bullets from hitting their own side.

## Terminal success/failure oracle

- **Success surface:** `bulletsFired === 144` exactly (8×12 + 16×3 — a non-deterministic pattern would not land on the exact count), `projectilesLive` bounded, drones killed, player damaged, `encounterComplete === true` after 2600ms.
- **Failure surface:** `bulletsFired`, `projectilesLive`, `hitsResolved`, `dronesAlive`, `phaseId`, `playerHealth`, `encounterComplete`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`Space`); `sw2d.encounters` installed; `phaseId === 'spread'`; `encounterComplete === false`.
2. Hold `PRIMARY_ACTION`; the shell auto-aims the sidearm at the nearest drone. Step ~2.5s.
3. `bulletsFired === 144` exactly; `projectilesLive <= 200` (bounded); `hitsResolved > 0`; `dronesAlive < 4`; player has taken bullet damage.
4. Step past 2600ms: `encounterComplete === true`, `bulletsFired` still 144 (both emitters were capped well before).
5. Restart (pause, then `SECONDARY_ACTION`): a fresh encounter runtime — `bulletsFired` reset (< 144), back in phase `spread`, player at full health.

## Acceptance

- Dense repeated projectile patterns, **bounded** (capped emissions) and **deterministic** (exact bullet count).
- Choreography is content, not code (`content/encounters.json`); the shell only wires the runtime.
- Restart genuinely reinstalls the encounter.
- Zero console errors, zero external requests.
