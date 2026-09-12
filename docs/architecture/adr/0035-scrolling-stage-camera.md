# ADR-0035: Horizontal and vertical scrolling stages are one reusable camera capability

- Status: accepted
- Date: 2026-09-09
- Phase: Category-C capability program, Wave 8

## Context

`horizontal-shmup` and `vertical-shmup` needed terrain streaming past a
ship held in a screen-space band, plus stage-clear. The generated starter
fought encounter waves in a fixed arena. Folding that into `sw2d.world`
would have turned flags/checkpoints into a genre monolith. A rail-path
camera (rail-shooter) and bullet-hell pooling do not fit this contract.
Overlay shmups keep the three-enemy lane fight so P2-C stays valid.

## Decision

**One renderer-neutral scrolling-stage capability with two bounded modes.
Not two engines, and not a second combat/weapons authority.**

- **`sw2d.stage-scroll` → `world.scroll`.** No pack dependencies.
  `StageScrollService` owns offset, player-band clamp, streaming hazards
  and stage-clear. No Phaser, no wall clock, no RNG.
- **Two modes of one machine:**
  - `horizontal` — stage streams left; default fire is +X.
  - `vertical` — stage streams down (fly up); default fire is −Y.
- **`content/stage-scroll.json`** (schema `stage-scroll-catalog`, document
  `stage-scroll`), always emitted. Empty/inert unless the preset installs
  the pack with positive `length` and `speed`.
- **The generated `topDownShellPack`** calls `bindStarterStageScroll`,
  parks dummy walls, drives the ship from the service, and keeps
  `bindStarterEncounters` for shooting. Overlay shmups do not bind.
- **Workbench:** `POST /api/stage-scroll/inspect` + a compact inspector.

## Consequences

- Consumers: `horizontal-shmup`, `vertical-shmup`. Both require
  `sw2d.stage-scroll` and content role `stage-scroll`.
- `LIMITATIONS.scrollingShmupCamera` names what is reusable and what is not.
  Twenty-seven packs now have a preset consumer.
- Duplicate hazard ids throw at install. A missing document or zero
  length/speed yields an inert service, not a crash.
- `bindStarterStageScroll` resets the stage on bind so a PlayScene restart
  is a new run.
- Catalog maturity stays unchanged. Rail-path cameras stay game-specific.

## Rejected

- **Folding this into `sw2d.world`.** That pack is flags and checkpoints.
- **Sharing a rail-path camera with `rail-shooter`.** Pointer-family
  scripted routes are a different machine.
- **Binding overlay shmups.** P2-C's three-enemy lane fight stays the
  overlay consumer.
