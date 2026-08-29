# Proof Contract — boss-rush

Frozen before implementation. Phase 4 of the capability-completion program (combat / encounter orchestration, ADR-0021). The **boss-phase** consumer.

## Preset

`boss-rush` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.combat`, `sw2d.ai`, **`sw2d.weapons`**, **`sw2d.encounters`**, optional `sw2d.arcade`. Content roles `tuning`, `levels`.

Generated via `npm run sw2d -- new proof-boss-rush --preset boss-rush`. Customized in `content/encounters.json` + `content/weapons.json` and `src/game-specific/shellPack.ts` (spawns the boss sprite, registers it in `combat.health`, wires `createEncounterRuntime`).

## Reusable capability exercised

- `sw2d.encounters` with `bossEntityId` — three phases, each with a **mechanically distinct** emitter pattern (`phase-1` `aimed`; `phase-2` aimed `fan` of 5 over 60°; `phase-3` `ring` of 10) and an `entity-health-below` completion condition (`0.66`, `0.33`, `0.03`). `phase-2`/`phase-3` open a `600ms` `onEnterInvulnMs` window; `phase-3` sets `onEnterFlag` `finalPhase`.
- `createEncounterRuntime` — applies the boss invulnerability window (`combat.setInvulnerableFor`) and the world flag from the phase definition; fires the phase's emitter from the boss's live position.
- `combat.health` — boss (240 hp) and player registered; the player's `sidearm` damages the boss; boss bullets damage the player.

## Terminal success/failure oracle

- **Success surface:** `phaseId` progresses `phase-1 -> phase-2 -> phase-3`; `bossInvulnerable === true` on each phase entry; `finalPhaseFlag === true` in phase 3; `encounterComplete === true` at the end.
- **Failure surface:** `phaseId`, `phaseIndex`, `bossHealthFraction`, `bossInvulnerable`, `finalPhaseFlag`, `playerHealth`, `bulletsFired`, `encounterComplete`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`Space`); `phaseId === 'phase-1'`, `phaseIndex === 0`, `bossHealthFraction ≈ 1`, `finalPhaseFlag === false`.
2. Hold `PRIMARY_ACTION` (auto sidearm, straight up into the boss).
3. Boss health drops below 66% → `phaseId === 'phase-2'`, `phaseIndex === 1`, `bossInvulnerable === true`; while the invuln window is open the boss's health does not fall.
4. Below 33% → `phaseId === 'phase-3'`, `phaseIndex === 2`, `finalPhaseFlag === true`.
5. Below 3% → `encounterComplete === true`; the player has taken boss-bullet damage.
6. Restart (pause, then `SECONDARY_ACTION`): back to `phase-1`, `bossHealthFraction ≈ 1`, `finalPhaseFlag === false`, `encounterComplete === false`.

## Acceptance

- At least one boss with three mechanically distinct phases.
- Phase transitions driven through reusable encounter *data*, not shell code.
- `onEnter` invulnerability windows and flags applied from the definition.
- Restart genuinely reinstalls the encounter.
- Zero console errors, zero external requests.
