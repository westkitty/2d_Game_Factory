# ADR-0057: Wave 30 leftover packs

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 30

## Context

Waves 22–29 skipped inventing 1-consumer packs. The user then asked to
**finish** the named leftovers: wall-slide, chase, box-select, capture-zone
pack, pinball pack, crop/season, rail-path camera, exhibit/codex, microgame
scheduler, tower target-select, attack-range, autonomous combat,
camera/framing, generalized authoring.

Chase still has no second consumer that pairing allows (frozen chase-platformer
proof). Microgame already has a generated wait/go/mash scheduler on
`sw2d.arcade`. Crop/season stays presentation of `sw2d.simulation` jobs (GROW_MS
480 in spring so Wave 13 harvest still ripens). Box-select is a one-unit
presentation on ADR-0018 edges. Sandbox adds a third stamp without changing
the Wave 20 win.

## Decision

**Add six reusable packs**, each with content authority and generated
consumers. Frozen proofs are not regenerated.

| Pack | Capability | Consumers |
|---|---|---|
| `sw2d.wall` | `movement.wall` | `climbing-game` (slide), `precision-platformer` (leap) |
| `sw2d.territory` | `strategy.zones` | `territory-control` (stand), `simple-rts` (occupy catalog; **do not tick** — FLAG path crosses both zones) |
| `sw2d.pinball` | `arcade.table` | `pinball-lite` (table). Physics-toy stays Matter and never ticks pinball. |
| `sw2d.camera` | `world.camera` | `rail-shooter` (rail origin; look still owns the kill-win), `photography-game` (frame capture) |
| `sw2d.codex` | `narrative.codex` | `museum-exhibit` (exhibit), `investigation-game` (case inspect/deduce) |
| `sw2d.targeting` | `combat.targeting` | `tower-defense` (tower auto-strike), `auto-battler` (auto), `turn-based-tactics` (`canStrike` HUD only; FLAG stay) |

Parkour `finish()` still owns FLAG/summit. Camera rail does not emit a game
win at t=1. Tactics never `strike`s the HP-1 grunt.

## Consequences

- Pack count 28 → 34. Catalog maturity stays 23/3/48.
- `PRESET_CATALOG.md` first-limitation rows and the capability matrix must
  stay in sync (`docsSync.test.ts`).
- Overlay kits stay local. No merge to main.

## Rejected

- **Manufactured seconds** (chase via auto-runner, box-select via sandbox,
  crops via colony). Pairing forbids remanufactured consumers.
- **Switching physics-toy onto the pinball table.** Dual-sim with Matter
  auto-completes or fights.
- **Ticking occupy on simple-rts.** The FLAG path crosses ZONE_A/ZONE_B.
- **`camera:completed` as rail win.** Would freeze rail-shooter at t=1.
- **`strike` on tactics grunt.** Would steal FLAG.
