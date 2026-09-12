# ADR-0056: Kart on-demand item-fire is game-specific

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 29

## Context

`kart-racer` already races through `sw2d.vehicles` + `sw2d.racing`. The leftover
is holding and firing a kart item on demand. Wave 23 consumed road vs craft and
left kart item-fire unpaired. Inventing an item-fire pack would duplicate a
1-consumer leftover. `sw2d.items` already grants canonical pickups; it is not
an on-use shell.

## Decision

**Do not add a pack, schema, or capability id. Present pickup-then-J-fire in
the vehicle shell as game-specific code.**

- **`kart-racer`** generated packConfig sets `KART_STARTER = 'item'`. Drive
  through the box to hold a shell; J fires it along heading. Complete on fire.
- **No third consumer.** Overlay kart kits stay local.

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged.
- Holding/firing a kart item on demand stays documented as game-specific code.

## Rejected

- **A reusable item-fire pack.** Only kart-racer needs on-demand shells.
- **Wiring `sw2d.weapons` as the shell.** Kart fire is a held pickup, not a
  sidearm.
- **Pairing with microgame.** Different leftover contracts.
