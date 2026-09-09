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

### Wave 2 — destroy integration debt in the generated top-down shell — COMPLETE
1. `bindStarterEncounters` added to `@sw2d/runtime` game-support
   (`packages/runtime/src/game-support/starterEncounters.ts`, exported from
   the package index): when a generated game installs `sw2d.combat` +
   `sw2d.weapons` + `sw2d.encounters`, the shell spawns real enemies from
   `content/encounters.json`, fires their patterns through the projectile
   runtime at the player, resolves combat both ways, tracks
   kills/deaths/waves, respawns the player on death, and restarts the
   encounter for a survival loop. Inert when the packs are absent.
2. Generated top-down shell consumes spatial pointer aim
   (`topDownShellPack.ts` template): digital `AIM_*` keys win, otherwise the
   mouse aims via `aimFromPointer` when the pointer is inside the arena,
   otherwise movement direction. Fire = `primaryPressed` or held
   `PRIMARY_ACTION` (J/X).
3. Generator content upgrades (`contentDocuments.ts` / `generate.ts`):
   `enemy-blaster` weapon (team `enemy`) in the weapon catalog when
   encounters are required; `starter-skirmish` encounter is now two-phase
   (wave-1 chasers, wave-2 mixed) instead of a single trivial wave.
4. Pack-set truth: `horizontal-shmup`, `vertical-shmup`, `arena-combat` now
   require `[combat, weapons, encounters]`; `twin-stick-shooter` requires
   `[combat, weapons]` with `encounters` optional plus one honest
   limitation. Stale limitations deleted (`LIMITATIONS.spatialAim` removed
   entirely; shmups now state the true remaining gap: no scrolling shmup
   camera).
5. Generated games announce their genre: `generateUiCopy` in
   `contentDocuments.ts` derives title/subtitle/playHint from the preset's
   primary controller family + required packs, emitted through
   `theme.json`'s schema-legal `ui` field. A vertical-shmup HUD now reads
   "MOVE WASD/ARROWS - AIM WITH MOUSE - FIRE J/X - SURVIVE THE WAVES"
   instead of the platformer's "MOVE / JUMP".
6. Docs regenerated mechanically from live `PRESETS`
   (`PRESET_CAPABILITY_MATRIX.md` all nine family tables + coverage table;
   `PRESET_CATALOG.md` limitations section), and `docsSync.test.ts` gained
   two drift guards (exact maturity cell per row; first knownLimitation
   verbatim per row) so the docs cannot silently drift again.
- Gameplay proof (real browser, this session): generated `vertical-shmup`
  game played end-to-end twice (before and after the UI-copy change) via the
  QA harness — enemies spawned and chased, pointer-aim + KeyJ fired real
  projectiles (86-93 spawned per session), kills registered, player died to
  contact damage and respawned with the survival loop intact, HUD showed the
  new genre-correct hint; zero console errors, zero external requests.
  Screenshots of title and mid-fight inspected visually.
- Validation: typecheck PASS; `npm test` 2567/2567; `qa:matrix` 45/45
  generated games really entered play; `qa:smoke` 14/14; `qa:proof` 23/23;
  workbench build PASS.
- Accepted commit: recorded in git log after this commit.

### Wave 3 — Workbench preset evidence surface — COMPLETE
Preset browser now surfaces repository-derived evidence per preset, with no
new panels (progressive disclosure inside the existing detail modal):
1. `workbench/server/presetEvidence.ts` (new): scans `proofs/` and `demos/`
   for `<preset-id>/package.json` at request time — the same evidence source
   `packages/presets/test/proofEvidence.test.ts` pins the catalogue against.
   Offline, no LLM, nothing hand-maintained; cached per process.
2. `listPresetSummaries` now carries `hasProofGame` / `hasDemoGame`; the
   detail modal gained an "Evidence on disk" section that states exactly
   which committed artifacts exist — or states honestly that none do and the
   maturity label rests on the generated starter alone.
3. `workbench/test/presetEvidence.test.ts` (new drift guards): every
   proof-validated preset must show a proof game *and only those* (F15 in
   both directions); demo count pinned to the 12 committed demos; unknown
   preset ids yield no evidence without throwing.
- Verified in a real browser against the production workbench build: four
  evidence cases rendered and read back (proof+demo: twin-stick-shooter,
  tower-defense; demo only: stealth-game; none: survivor-like), zero page
  errors. Screenshot of the detail modal inspected visually.
- Accepted commit: same commit as Wave 2 (below).

### Adversarial sweep A (during Waves 2-3, this session)
Attack: "does the generated playHint fabricate controls the shell never
reads?" Three real bugs found and fixed before commit:
1. Top-down no-weapons hint claimed "INTERACT E" — no generated shell reads
   INTERACT. Hint corrected; `packages/cli/test/uiCopy.test.ts` (new) now
   forbids INTERACT/DRAG/GAMEPAD claims for every preset, requires JUMP only
   on the platform family, and pins the grid/vehicle/menu hints to the real
   default bindings (UNDO Backspace, RESET K, ENTER confirms).
2. Grid/vehicle/ui-sim hints used internal action names (CANCEL, SECONDARY,
   CONFIRM) instead of the keys players actually press; reworded to real keys.
3. `add-theme` dropped the ui copy: a second theme generated by
   `generateTheme` carried no `ui` field, so switching themes silently
   reverted a shooter's HUD to "MOVE / JUMP". `addTheme.ts` now inherits the
   default theme's `ui` block.

### Wave 4 — adversarial sweep + full ladder — PLANNED
Planned: run after Waves 1-3 land.

## Final validation (post-Wave 4, this branch HEAD)

To be recorded when Wave 4 completes. Do not trust any number here until the
wave status above says COMPLETE.

## Remaining blockers

None external. Remaining work is the honest Category C backlog above, each
already stated per-preset in `knownLimitations`.
