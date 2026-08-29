# ADR-0024: Deterministic procedural generation is one bounded capability that emits NormalizedLevel

- Status: accepted
- Date: 2026-08-29
- Phase: Capability program, Phase 7 (Sonnet 5)

## Context

`endless-runner`, `auto-runner`, `dungeon-crawler`, `action-roguelite` and
`endless-driving` all carried `LIMITATIONS.proceduralGeneration`: "only
hand-authored Tiled levels are supported". Each would otherwise hand-roll its
own generator.

## Decision

**`sw2d.generation` → `world.generation`**, one deterministic generation
framework, renderer-neutral, no new dependency.

- **Project-owned seeded PRNG (`createRng`, mulberry32) in `@sw2d/contracts`.**
  `nextFloat` / `nextInt` / `choose` / `weightedChoose`. `normalizeSeed`
  reduces any input (number, string, garbage) to a stable uint32 - a string is
  FNV-1a hashed, non-finite falls back to a fixed constant. `nextInt(<=0)` and
  `choose([])` throw; `weightedChoose` throws when no weight is positive and
  clamps negatives to 0. **No `Math.random` anywhere in the generation path**
  (asserted by a test).
- **Three bounded generator families, expanded by pure functions - not a DSL.**
  `segment-chain` (runner: socket-matched segment stream, weighted selection,
  repetition cap, difficulty filter, gap-connectivity validation),
  `room-graph` (dungeon: start room → critical path via matched doors on an
  abstract room grid → exit room → bounded branches, BFS connectivity +
  start→exit reachability validation, **bounded** deterministic retry budget),
  `road-chain` (driving: heading-matched road segments, shoulder collision,
  safe start). `PuzzleOp`-style fixed vocabularies only.
- **Output is `NormalizedLevel`** - the exact structure `normalizeTiledMap`
  produces. No parallel scene format. Every downstream reader (`solids`,
  `objects`, `PlayerSpawn`) is unchanged. Generator core emits no Phaser
  object.
- **`content/generation.json`, schema `generation`**
  (`urn:sw2d:schema:content-generation:v1`), content document `generation`,
  always emitted by the generator (empty unless the preset installs the pack).
  The `GenerationDoc` carries the base `seed`; a per-generator sub-seed is
  derived so two generators in one document differ.
- **`GenerationResult` = `{ output, manifest, validation }`.** The manifest
  (seed, chosen templates, room graph nodes/edges, params, retries) is the
  reproducibility surface. `validate(result)` re-checks structurally.
- **`@sw2d/runtime` `resolveSceneLevel(context)`** - a pure helper the
  generated `platform` / `top-down` / `vehicle` shells call: use
  `generation.generate('main').output` when `sw2d.generation` is installed and
  its result validates, else the authored `content/levels/main.json`. A
  rejected generation falls back rather than handing gameplay a broken world.
- **Workbench**: `POST /api/generation/preview` runs the same pure
  `runGenerator`; an inspector-pane panel picks a generator, sets seed / size /
  difficulty, regenerates, copies the seed, and shows the manifest. Read-only,
  offline.

## Consequences

- Proof consumers: `proofs/endless-runner/` (`segment-chain` - same seed
  reproduces the exact template sequence in-run and across a real scene
  reinstall; different seed diverges but stays valid; player traverses
  generated ground) and `proofs/dungeon-crawler/` (`room-graph` - a connected
  graph with a start node, an exit, valid edges, start→exit reachability, same
  reproducibility guarantees). `qa:proof` 15/15 → 17/17.
- `endless-runner` / `auto-runner` / `dungeon-crawler` / `action-roguelite` /
  `endless-driving` now require `sw2d.generation` and carry role `generation`;
  their generated shells consume it. `LIMITATIONS.proceduralGeneration`
  **removed** (constant deleted). `action-roguelite` keeps its
  permadeath/meta-progression limitation; `endless-driving` keeps
  `vehicleIntentOnly` (Phase 10); `dungeon-crawler` gains a narrow, true
  limitation: the room graph places `Enemy` objects but the starter shell does
  not yet wire them into `sw2d.combat` / `sw2d.ai`.
- Sixteen packs now have a preset consumer. `qa:matrix` 42 → 43.

## Rejected

- **A dedicated generated-scene format.** `NormalizedLevel` already expresses
  solids + semantic objects; a second format would fork every downstream
  reader.
- **A universal generator language.** Three closed families with fixed
  parameters and pure expansion - no expression evaluation.
- **An npm PRNG / dungeon-generation dependency.** mulberry32 is ~10 lines;
  the generators are ~400 lines of deterministic project-owned code.
- **Unbounded retry in `room-graph`.** The retry budget is a config field
  (default 8); exhausting it returns `valid: false`, not a hang.
- **A Phaser-coupled generation bridge.** Generation is pure; `resolveSceneLevel`
  is a pure helper and the shell owns the resulting bodies.
