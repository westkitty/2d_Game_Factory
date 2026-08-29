# Proof Contract — endless-runner

Frozen before implementation. Capability program Phase 7 (ADR-0024) proof consumer A.

## Preset

`endless-runner` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`,
required packs `sw2d.arcade` + `sw2d.generation`, content roles `tuning`, `levels`, `generation`.
Maturity `recipe`.

Generated via `npm run sw2d -- new proof-endless-runner --preset endless-runner`, moved into this
committed `proofs/endless-runner/` tree. Only `src/game-specific/shellPack.ts` is customized.

## Reusable capability exercised

- `sw2d.generation` (`GenerationService`) — `availableGenerators()`, `generate(id, { seed? })`.
  The `main` generator is a `segment-chain` config in `content/generation.json` (four bounded
  segment templates: start-flat, flat, gap, hazard). The shell calls `generate('main')` once at
  install and renders `result.output` (a `NormalizedLevel`) exactly as it would a Tiled level —
  ground from `solids`, spawn from the `PlayerSpawn` object. **No generation logic in the shell.**
- Project-owned deterministic PRNG (`createRng`, mulberry32) inside the capability — no
  `Math.random`, no new dependency.

## Game-specific code (`src/game-specific/shellPack.ts`)

- Renders the generated level; runs a `platformController`-driven runner body.
- `INTERACT` → `generate('main', { seed: <initial seed> })` again and records
  `regenMatchesInitial` (chosen-template sequence byte-identical + still valid).
- `SECONDARY_ACTION` → `generate('main', { seed: <initial seed ^ constant> })` and records
  `altDiffers` (sequence differs) and `altValid` (still passes validation).
- No hand-written long level; no second generator.

## Terminal success / failure oracle (debug snapshot `game.platform-shell`)

- `valid` — the generation result passed its own connectivity + safe-spawn validation.
- `spawnPlaced` — a `PlayerSpawn` object exists.
- `segmentCount` — number of chained segments (== the config `count`).
- `chosenTemplates` — the ordered template ids (the reproducibility surface).
- `progressedX` — how far the player has advanced from spawn.
- `regenMatchesInitial`, `altDiffers`, `altValid` — the reproducibility / divergence flags.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start. `valid === true`, `spawnPlaced === true`, `segmentCount === 10`,
   `chosenTemplates[0] === 'start-flat'`.
2. Record `chosenTemplates` as the reference sequence.
3. Hold `ArrowRight` for a stretch of frames → `progressedX` grows past 200 (the player is
   traversing generated ground, not falling through a void).
4. `INTERACT` → `regenMatchesInitial === true` (same seed reproduces the exact sequence).
5. `SECONDARY_ACTION` → `altDiffers === true` and `altValid === true` (a different seed gives a
   different but still-connectable layout).
6. Restart the scene (`KeyP` then `KeyK`). Read the snapshot again: `chosenTemplates` is
   **identical** to the reference sequence — the generator is deterministic across a real scene
   reinstall, not a cached blob.

## Acceptance

- Generation runs through the reusable `sw2d.generation` capability, from the normal generated
  composition (`main.ts` passes `generationPack`; `content/generation.json` selects it).
- Same seed → identical `chosenTemplates`, verified both in-run (`INTERACT`) and across a real
  restart.
- Different seed → different sequence, still valid.
- Adjacent segments connect (no `un-traversable gap` error) and a safe spawn exists.
- No bespoke long hand-authored level; no puzzle/generator DSL.
