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

### Wave 4 — adversarial sweep + full ladder — COMPLETE

Second consumer proof: generated `bullet-hell` played end-to-end in a real
browser (dodge-under-fire loop: 2 kills, contact damage taken and avoided,
0 deaths while dodging, pointer aim, genre HUD; zero console errors, zero
external requests; mid-fight screenshot inspected).

Adversarial sweep B — attacks run against the live generated game and the
workbench, three real bugs found, root-caused, fixed, regression-protected:
1. **Player could walk out of the arena** (found by playing: position
   reached x=-456). Root cause: `bindStarterEncounters` used
   `scene.physics.add.group()` for its overlap groups; adding the player to
   an Arcade physics group applies the group's body defaults, silently
   resetting the shell's `setCollideWorldBounds(true)`. Fix: plain
   `scene.add.group()` (overlap only needs children with bodies). Re-played:
   bounds hold (x,y = 14,22 at the corner), battle loop unaffected.
2. **Theme synthesis clobbered other writers' theme surfaces** (found by
   WB-IMAGE-001 failing 0/3 with `UnknownAssetRoleError: ui.panel`).
   `buildTheme` rebuilt theme.json from scratch, deleting a starter kit's
   supplemental generated UI assets (ui.panel/ui.cursor - boot crash) and
   the generator's `ui` copy block (HUD silently reverted). Fix:
   `existingThemeOnDisk` carries forward the `ui` block verbatim plus any
   generated-spec asset entry for a role synthesis did not emit; image-spec
   entries are never carried (shipping bytes need provenance). New
   `workbench/test/themePreservation.test.ts` (4 tests).
3. **Seed ranking stopped preferring deep kits** (root cause of the same
   journey failure): maturity had been an accidental proxy for kit depth
   until Wave 1 honestly promoted 23 presets; after that, one-object
   starter levels outranked designed 13-object ones. Fix: explicit
   DEPTH_SCORE term (rich-proof-kit 30 / rich-starter 15 / smoke 5 / shell
   0) breaking ties within a maturity tier. Kit-overlay themes now also
   carry the genre `ui` copy (`themeRoles.ts` + `generateUiCopy` export via
   `@sw2d/cli/factory`). New depth-tie regression test in
   `seedsGameFirst.test.ts`.

Attacks that found no bugs (all run in the real browser against the
generated bullet-hell): pause mid-battle (nothing advances while paused,
state survives resume); restart mid-battle with live projectiles + enemies
(clean re-register, fresh loop works); double-fast restart; quit-to-title
and re-enter (full teardown/rebuild); pointer aimed exactly at the player
(zero-length aim vector - no NaN, position stays finite); nine keys mashed
simultaneously. Zero console errors in every attack.

## Final validation (this branch HEAD, all real, this session)

- `npm run validate` (typecheck + test + workbench:build + build +
  check:offline): PASS, tests 2578/2578 (2573 + 5 new regression tests)
- `qa:matrix`: 45/45 generated games really entered play
- `qa:smoke`: 14/14 — `qa:proof`: 23/23
- `qa:workbench`: **16/16** journeys (13/16 before the sweep-B fixes)
- `qa:responsive`: 19/19 surfaces (375x812 portrait, 844x390 landscape)
- `qa:starter-kits`: all 14 tranches PASS (core 14/14, P2-B 7/7, P2-C 8/8,
  P3-A..P3-K all green, package-lock unchanged in every tranche)
- `release:verify`: PASS for all controller-shell families
- `check:offline`: PASS

### Adversarial sweep C (after Wave 4, this session) — COMPLETE

Third and fourth consumer families played in a real browser: generated
`time-trial-racer` (vehicle) and `sokoban` (grid/puzzle-rules), plus a third
battle consumer (`arena-combat`). Two real gameplay bugs found by playing,
fixed, regression-pinned in `packages/cli/test/shellSafety.test.ts`:

1. **The race car could drive off the world forever** (y reached -881 while
   playing). The vehicle service integrates its own x/y and the shell copies
   them with `setPosition`, so Arcade's `setCollideWorldBounds` never sees
   the movement. Fix: the vehicle shell resets the vehicle to spawn when it
   leaves the viewport plus a 48px margin — racing convention: the reset
   costs time, never race progress (checkpoint/lap/clock untouched).
   Re-played: escape attempt contained (x,y = 110,356), countdown → racing →
   checkpoint credit (cp-1 at index 1) all proven; pause respects the
   countdown clock; pause-restart resets to idle at spawn cleanly.
2. **The survival loop stalled forever for a player who held the fire
   button.** The wave-restart gate required `projectiles.liveCount === 0`,
   but the player's own held-fire shots keep liveCount above zero
   permanently (seen playing arena-combat: encounterComplete=true,
   enemiesAlive=0, wavesCleared stuck at 0 for 188 spawned shots). Fix: the
   restart gates on cleared enemies only; in-flight shots crossing a wave
   boundary resolve cleanly because combat entries are removed on death.
   Re-played with fire held the whole session: wavesCleared advanced.

Attacks that found no bugs: sokoban undo-at-zero-history, held-key
grid-slide (bounded single-step repeat, not 60/s), undo/reset/move spam
interleave, all four grid edges (actor stayed in bounds); racing
CONFIRM-spam after start (no double-start, countdown monotonic); pre-race
driving credits no checkpoints. Zero console errors in every session.

Validation after the two fixes: typecheck PASS, `npm test` 2580/2580
(2578 + 2 pins), qa:matrix 45/45, qa:smoke 14/14, qa:proof 23/23,
release:verify PASS (all controller-shell families), workbench build PASS.

## Category B residue — explicit descope decisions

Five presets keep integration debt on purpose. Each was weighed against the
program's "least sufficient architecture" rule; wiring them would have meant
speculative shell surgery without a played proof to anchor it. All five state
the exact gap in `knownLimitations` today (pinned by `docsSync.test.ts`), so
the catalog is honest even where it is not finished:

- `gallery-shooter` — pointer shell consumes spatial click targeting
  (ADR-0018, proof passes); weapons/projectiles remain unconsumed. The
  pointer shell has no fire loop to hang them on; adding one is a
  differentiation pass on the pointer family, not an integration fix.
- `rail-shooter` — same pointer-shell situation plus a genuinely missing
  capability (fixed-path rail camera, Category C). Blocked on C, not B.
- `action-adventure` — requires the weapons pack but its top-down starter
  is melee-flavored; `sw2d.encounters` is deliberately not installed.
  Wiring ranged encounters would make it a worse arena-combat clone
  instead of an action-adventure. Its real gap is melee/knockback
  (Category C), stated verbatim in the limitation.
- `base-defense` — wave spawning is reusable (`sw2d.encounters`, optional
  pack) but base-damage/target-priority resolution is starter-specific;
  consuming encounters without a base-HP sink would spawn waves that
  attack nothing.
- `tower-defense` (placement) — spatial hover placement via the pointer
  shell exists and is stated as available; the starter keeps the keyboard
  grid cursor because the committed proof (`proofs/tower-defense/`,
  passing) is contracted against it. Swapping input schemes under a frozen
  proof contract is a differentiation decision, not debt removal.

## Remaining blockers

None external. Remaining work is the honest Category C backlog above, each
already stated per-preset in `knownLimitations`.

## Final handoff report — PASS

- **Verdict: PASS.** Every wave complete, every ladder rung green on the
  final HEAD, every gameplay claim backed by a session actually played in a
  real browser this program.
- Branch: `arena/01a0842f-2d-game-factory`. Starting `origin/main` SHA:
  `acf802f7a32a3f341273c084931af37cb5461784`. Final HEAD: `e42cf87`
  (plus this ledger-only handoff commit). `main` untouched; no merges; the
  docs branch untouched.
- Commits, in order: `51ed496` (Wave 1 catalog truth), `c235549`
  (Waves 2-3 integration + evidence surface + sweep A), `e4ce833`
  (Wave 4 sweep B + full ladder), `e42cf87` (sweep C gameplay fixes).
- Maturity before → after: 5 proof-validated / 7 smoke-validated / 62
  recipe → **23 / 3 / 48** (74 total). Every promotion is evidenced by a
  committed proof game whose spec passed in this session, and
  `proofEvidence.test.ts` pins catalog-vs-disk both directions.
- Integration debt destroyed: generated top-down shell consumes spatial
  pointer aim + the full combat/weapons/encounters stack
  (`bindStarterEncounters`); shmup/arena pack-sets tell the truth;
  generated games announce their genre in the HUD; docs regenerate
  mechanically and are drift-guarded.
- Capabilities added: only `bindStarterEncounters` (runtime game-support,
  consumers: all six battle-active presets' generated games) and the
  workbench `presetEvidence` scanner (consumers: preset browser + drift
  tests). No speculative frameworks.
- Journeys actually played (real Chromium, QA harness, zero console errors
  in every session): generated vertical-shmup (twice), bullet-hell,
  arena-combat (twice — bug then fix), time-trial-racer (twice — bug then
  fix: countdown, checkpoint credit, pause, pause-restart), sokoban attack
  set, plus 16 workbench journeys, 45 matrix entries, 14 smoke demos,
  23 proofs, 19 responsive surfaces per run of the respective suites.
- Bugs found by playing and fixed (8 total, each root-caused and
  regression-protected): playHint fabrications (3, sweep A); arena
  world-bounds reset by physics group, theme-synthesis clobbering,
  seed depth-ranking loss (3, sweep B); racer off-world escape,
  survival-loop stall under held fire (2, sweep C).
- Final validation on HEAD (all real, this session, after the last code
  change): typecheck PASS; `npm test` **2580/2580** (136 files);
  `npm run validate` PASS; `check:offline` PASS; `qa:workbench` 16/16;
  `qa:smoke` 14/14; `qa:proof` 23/23; `qa:matrix` 45/45; `qa:responsive`
  19/19; `qa:starter-kits` all 14 tranches (359 PASS / 0 FAIL,
  package-lock unchanged in all 14); `release:verify` PASS for all
  controller-shell families.
- Honest limits: qa:responsive is emulated viewport/touch, not device
  hardware (the suite itself says so); gamepad claims were removed rather
  than faked; Category C capabilities remain unbuilt by design and are
  stated per-preset; the five Category B descopes above are deliberate.
- **Merge verdict: MERGE.** The branch is behavior-improving, fully
  validated, and leaves the catalog more honest than it found it. PR
  opened: https://github.com/westkitty/2d_Game_Factory/pull/6 (base
  `main`, reported MERGEABLE at creation). Merging is the repository
  owner's call.
