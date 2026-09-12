# ADR-0029: Creature, habitat and companion needs are one reusable care capability

- Status: accepted
- Date: 2026-09-09
- Phase: Category-C capability program, Wave 2

## Context

`pet-creature`, `aquarium-terrarium` and `virtual-pet` carried
`LIMITATIONS.creatureSimulation`: "No reusable needs/behavior/relationship/
creature simulation exists beyond foundational resources/state." Three care
recipes needed the same underlying loop (named needs that decay, care actions
that raise them, a wellbeing hold or instant win, optional fail-below) with
different presentation and pacing. Folding that into `sw2d.simulation` would
have turned a resource-ledger + timed-job primitive into a genre monolith.
`colony-lite` does not fit: its gap is assignment AI and construction, not
a two-need care loop.

## Decision

**One renderer-neutral, simulation-time capability with three bounded modes.
Not three engines, and not a creature-AI / relationship-graph DSL.**

- **`sw2d.needs` → `simulation.needs`.** `NeedsService` owns need values,
  `act()` / `actByIndex()`, `selectByDelta()`, affinity, hold time,
  `outcome()` and `tick(deltaMs)`. Decay, hold and fail use simulation time
  (`deltaMs`), never `Date.now`. No RNG.
- **Three modes of one update:**
  - `creature` — hunger/mood; hold-to-win; fail at empty.
  - `habitat` — water/food; longer hold; fail below a floor.
  - `companion` — hunger/happiness; instant win once both are high enough
    after enough actions; no fail-below.
- **`content/needs.json`** (schema `needs-catalog`, document `needs`),
  always emitted. Empty/inert unless the preset installs the pack. The
  generator maps pet-creature → creature, aquarium-terrarium → habitat,
  virtual-pet → companion.
- **The generated `uiSimulationShellPack`** calls `bindStarterNeeds`. When
  the pack is absent (or the catalog is empty) the dummy option-picker or
  the economy HUD remains. Presentation is a high-contrast HUD; full
  creature behaviour AI, relationship graphs and colony assignment stay
  game-specific / honestly limited.
- **Workbench:** `POST /api/needs/inspect` + a compact inspector (mode,
  subject, needs, actions, win/lose). Read-only; editing is JSON work on
  the file.

## Consequences

- Consumers: `pet-creature` (creature), `aquarium-terrarium` (habitat),
  `virtual-pet` (companion). All three require `sw2d.needs` and content
  role `needs`.
- `LIMITATIONS.creatureSimulation` rewritten to name what is reusable and
  what is not. Twenty-one packs now have a preset consumer.
- Duplicate need/action ids and unknown effect needIds throw at install.
  A missing document yields an inert service, not a crash. Unknown actions
  are reported reasons, never silent no-ops.
- `bindStarterNeeds` resets the session on bind so a PlayScene restart is a
  new care session.

## Rejected

- **Folding this into `sw2d.simulation`.** That pack is a resource ledger
  plus a timed-job primitive and explicitly is not a creature / habitat sim.
- **A behaviour-AI / relationship-graph / colony-assignment system.** Those
  are not shared across these three recipes.
- **Wall-clock decay.** `tick(deltaMs)` only.
