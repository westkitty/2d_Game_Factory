# ADR-0048: Consume combat health in dungeon and base-defense shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 21

## Context

`dungeon-crawler` entered play as a dummy top-down wanderer even though the
recipe already requires `sw2d.combat` and a room-graph generator that can
place Enemy objects. `base-defense` entered play the same way even though it
already requires combat.health.

Inventing a targeting, AI-path, or encounter pack for these two would either
duplicate leftovers that still have one live consumer (tower target-selection,
patrol AI) or restyle `sw2d.encounters` / `sw2d.melee` as a third fight
adapter. Pairing simple-rts would lie: that leftover is realtime box-select,
not health/damage.

They still share the existing combat service: register, damage, invulnerability.
Dungeon is walk-into-range strike that clears a room. Base-defense is intercept
raiders marching on a base HP pool.

## Decision

**Consume the existing `sw2d.combat` health/damage service. Do not add a pack,
schema, or capability id. Do not invent targeting, AI, or encounter packs.**

- **`dungeon-crawler`** generated packConfig sets `COMBAT_STARTER = 'room'`.
  The top-down shell hides dummy walls. Walk to GRUNT then BRUTE; J strikes
  in range. Contact damages the player. Complete when both foes are dead.
- **`base-defense`** generated packConfig sets `COMBAT_STARTER = 'hold'`.
  Two raiders march on BASE; J strikes in range; contact damages the base,
  not the player. Complete when both raiders are dead with the base alive.
- **No third consumer.** Action-adventure / arena stay on `sw2d.melee`.
  Survivor stays on encounters + progression. Simple-rts and territory keep
  `COMBAT_STARTER = null`. Overlay dungeon / base-defense kits stay local.

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged. `dungeon-crawler` remains proof-validated
  on the frozen proof.
- Generated Enemy objects from the room graph and AI behaviour stay leftovers.
- Target-priority / upgrade rules stay leftovers.

## Rejected

- **A targeting / threat-selection pack.** Tower-defense and base-defense are
  still one leftover each once combat.health is consumed here.
- **Wiring generated Enemy objects / `sw2d.ai` labels as a chase/patrol
  system.** The AI pack tracks state names, not movement.
- **Pairing simple-rts or territory-control.** Those leftovers are box-select
  and capture-zones, not health/damage.
- **A mega-pack of leftover Tier-3/4 singles.**
