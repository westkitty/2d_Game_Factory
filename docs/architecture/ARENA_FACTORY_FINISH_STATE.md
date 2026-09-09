# Arena Factory Finish Program — durable state ledger

Governing prompt: `docs/agent-prompts/LM_ARENA_FACTORY_FINISH_PROMPT.md` (branch
`docs/lm-arena-factory-finish-prompt`, commit `ba86531`). This ledger is the
resumable state for that program: a fresh agent should continue from this file
plus `git log`, not from chat memory.

## Branch law state

- Starting `origin/main` SHA: `acf802f7a32a3f341273c084931af37cb5461784`
- Implementation branch: `arena/01a0842f-2d-game-factory` (branched from exactly
  that SHA). The requested name `arena/factory-finish` could not be used: this
  execution environment pins all session work to the branch above and refuses
  pushes elsewhere. The branch satisfies every other requirement of the branch
  law — based on current `origin/main`, never `main`, never the docs branch.
- `main` untouched. No merges performed.

## Environment note (browser QA)

The sandbox has no system Chrome and Google CDNs are unreachable. A working
Chromium 152 was provisioned from the `@sparticuz/chromium` npm package
(binary + `al2023` libs inflated to `/tmp`), wrapped at
`/tmp/chrome-wrapper.sh` (adds `--no-sandbox --disable-gpu`), and used via the
repository's own `PLAYWRIGHT_CHROME_PATH` override. Nothing in the repository
was changed to accommodate this.

## Baseline (verified on `acf802f`, this session, before any change)

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | 2562/2562 PASS (131 files) |
| `npm run qa:smoke` | 14/14 PASS |
| `npm run qa:proof` | 23/23 PASS |
| `npm run workbench:build` | PASS |
| `npm run build` | PASS |
| `npm run check:offline` | PASS |

Baseline maturity counts: 5 proof-validated / 7 smoke-validated / 62 recipe
(74 total). Proof coverage on disk: 23 committed proof games under `proofs/`,
each with a frozen `PROOF_CONTRACT.md` and a passing real-browser spec in
`packages/qa/proof-specs/` — 18 more than the catalog credits.

## 74-preset audit — classification summary

Category A (already better than label — proof passes today, catalog stale):
`bullet-hell`, `boss-rush`, `collectathon-platformer`, `dungeon-crawler`,
`endless-runner`, `exploration-game`, `gallery-shooter`,
`grappling-platformer`, `lane-defense`, `metroidvania`, `physics-toy`,
`point-and-click`, `puzzle-platformer`, `run-and-gun`, `time-trial-racer`,
`top-down-adventure`, `top-down-racer`, `turn-based-tactics` (18).

Category B (existing capability, generated shell does not consume it):
- Top-down shell: no spatial/pointer aim although `aimFromPointer` (ADR-0018)
  exists and is proven in `proofs/twin-stick-shooter`.
- Top-down shell: `sw2d.encounters` installed by bullet-hell / survivor-like /
  boss-rush generated games is inert — `content/encounters.json` ships but the
  shell never creates an encounter runtime, so nothing ever spawns or shoots.
- `horizontal-shmup` / `vertical-shmup`: limitation says "does not wire enemy
  formations" — root cause is the shell (above), plus the presets not
  requiring `sw2d.encounters`.

Category C (genuinely missing reusable capability — unchanged this program
unless proven needed): ball/paddle, stealth perception geometry, melee/
knockback, rhythm sync, customer/economy sim, creature needs, dialogue
renderer, parser IF, multi-player routing, rail camera, capture zones,
falling-block engine, crop growth, casting/tension, cooking sequences,
photo scoring, wardrobe attachment, canvas strokes, microgame scheduler,
sandbox authoring. Each is honestly stated in `knownLimitations` today.

Category D (legitimately game-specific): kart item usage, boss sequencing
across runs, tower upgrade rules, pinball table layout, turn-action state
machines — correctly left in game-specific seams.

## Waves

### Wave 1 — catalog truth reconciliation (Category A) — COMPLETE
Promote the 18 proof-backed presets to `proof-validated`; update
`honesty.test.ts` (now 23/3/48), `workbench/test/starterKits.test.ts`
(kit-depth invariant restated honestly: kit depth describes the kit, preset
maturity describes the preset), `docs/presets/PRESET_CATALOG.md`,
`docs/proofs/PROOF_MATRIX.md`. Evidence: every promoted preset's proof ran
23/23 in this session's baseline `qa:proof` before promotion.
- Status: implemented and validated: typecheck PASS, `npm test` 2566/2566
  (adds `packages/presets/test/proofEvidence.test.ts`, a mechanical
  proofs-directory-vs-catalog drift guard), workbench build PASS. The 23
  promoted presets' proofs all passed 23/23 in this session's baseline
  `qa:proof` run before promotion.
- Accepted commit: recorded in git log after this commit.

### Wave 2 — destroy integration debt in the generated top-down shell — PLANNED
1. `bindStarterEncounters` added to `@sw2d/runtime` game-support: when a
   generated game installs `sw2d.combat` + `sw2d.weapons` + `sw2d.encounters`,
   the shell now spawns real enemies from `content/encounters.json`, fires
   their patterns through the projectile runtime at the player, lets the
   player kill them (combat resolution both ways), tracks kills/deaths, and
   respawns the player on death (survival loop). Inert when packs absent.
2. Generated top-down shell consumes spatial pointer aim: with no digital
   `AIM_*` held, the mouse aims the starter weapon via `aimFromPointer`.
3. `horizontal-shmup` / `vertical-shmup` now require `sw2d.encounters`
   (their defining mechanic), limitation text updated to what remains true.
4. Limitations narrowed where they became false; honesty tests updated.
- Status: planned.
- Accepted commit: none yet.

### Wave 3 — Workbench preset health surface — PLANNED
Preset browser now surfaces repository-derived evidence per preset: proof /
demo / starter-kit existence (derived server-side from the real preset data,
not hand-maintained), known limitations on the detail card, and honest
maturity counts. No new panels; progressive disclosure inside the existing
browser view.
- Status: planned.
- Accepted commit: none yet.

### Wave 4 — adversarial sweep + full ladder — PLANNED
Planned: run after Waves 1-3 land.

## Final validation (post-Wave 4, this branch HEAD)

To be recorded when Wave 4 completes. Do not trust any number here until the
wave status above says COMPLETE.

## Remaining blockers

None external. Remaining work is the honest Category C backlog above, each
already stated per-preset in `knownLimitations`.
