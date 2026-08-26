# Phase 12 - Final Cross-System Acceptance and Cold-Start Gate

Opus 5. The final phase of the initial MASTER_PROJECT. An evidence/acceptance gate, not a
feature-expansion or polish pass. Every state below is backed by a command run during this phase or
a file read during this phase - never by chat history, and never by quoting a prior phase's handoff
as if it were proof.

---

## Baseline

| Item | Value |
|---|---|
| Repository | `westkitty/2d_Game_Factory` (`git remote get-url origin` = `git@github.com:westkitty/2d_Game_Factory.git`) |
| Branch | `main` |
| Phase 11 baseline inherited | `42b8318f48377867ca8b6d8f3d9ebf2da300d5e4` |
| `HEAD` at phase start | `42b8318f48377867ca8b6d8f3d9ebf2da300d5e4` |
| `origin/main` at phase start | `42b8318f48377867ca8b6d8f3d9ebf2da300d5e4` (after `git fetch origin`) |
| Working tree at phase start | clean |
| Node (dev host) | v26.7.0, npm 11.19.0 - the only Node line installed on this host. `.nvmrc` = `24`; `package.json engines` = `>=22.12.0`. Node 24.x remains an explicit unverified compatibility detail (§ Nonblocking known limitations) |
| System Chrome | found at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (`sw2d doctor`) |

No `git reset --hard`, `git clean -fd`, force push, or history rewrite was used at any point.
`westkitty/c_chase` was not touched. No deployment, GitHub Release, package publication, or
licensing decision was performed.

---

## Final verdict

# Complete

The initial MASTER_PROJECT acceptance contract (§54) is satisfied and evidenced: all twenty
acceptance items PASS, all thirteen failure conditions are NO, the full cross-system validation
ladder passes on the final tree, the generated-runtime matrix still mechanically covers all 74
presets, and an independent repository-only cold-start challenge in an isolated snapshot succeeded
end to end.

This does **not** mean every possible mechanic exists, every preset is proof-validated, real-device
performance is benchmarked, or public licensing is granted. See § Nonblocking known limitations and
§ Final release/licensing truth.

---

## A01-A20 master acceptance ledger

### A01 - Modular runtime

**State: PASS**

**Evidence:** `packages/runtime/src` is 35 TypeScript modules totalling 2,514 lines across ten
directories (`accessibility/`, `audio/`, `content/`, `controllers/`, `core/`, `debug/`,
`game-support/`, `input/`, `persistence/`, `scenes/`). The largest single runtime file is
`core/createGame.ts` at 290 lines; it is also the largest non-test source file in the entire
`packages/` tree. Per-package totals: contracts 1,082, content-pipeline 717, packs 2,375,
presets 2,103, schemas 1,090, cli 2,893, qa 2,425, runtime 4,181 lines.

**Reason:** No file approaches "one giant game file." Boundaries are enforced, not merely stylistic:
`@sw2d/contracts` declares zero dependencies (`packages/contracts/package.json`), and ADR-0002/0010/
0013/0014/0015 plus `OPERATIONAL_STATE.md`'s protected invariants 3, 4, 17, 21, 23 constrain what
may import what.

### A02 - Stable semantic input

**State: PASS**

**Evidence:** A repository-wide grep for `KeyboardEvent`, `.code ===` and `event.key` across
`packages/runtime/src`, `packages/packs/src`, `packages/presets/src`, `demos/*/src` and
`proofs/*/src` returns exactly three hits, all inside the input layer:
`packages/runtime/src/input/KeyboardAdapter.ts` (lines 19, 30) and a comment in
`input/defaultBindings.ts`. No gameplay code anywhere reads a physical key.
Frame ownership: `ActionInputHost.update()` is the only frame advance, and it is invoked exactly
once per step from `Phaser.Core.Events.PRE_STEP`
(`packages/runtime/src/core/createGame.ts:214`), with the listener's removal registered on the root
disposable bag at line 215. `consumePress` (`ActionInputHost.ts:118`) is implemented as
"justPressed, then latch consumed," so one press produces one effect across overlapping scenes.

**Reason:** Semantic actions are the only gameplay-visible input surface; adapters own physical
translation; frame ownership and claimed-press semantics are both intact and disposal-registered.

### A03 - Stable core infrastructure

**State: PASS**

**Evidence:** All six subsystems have real implementations with executed evidence, not
type-only stubs.
- Lifecycle: `core/DisposableBagImpl`, `EventBusImpl`, `CapabilityRegistryImpl`, covered by
  `packages/runtime/test/lifecycle.test.ts` (reverse-order disposal, exactly-once teardown,
  disposal-after-dispose, throwing-teardown isolation, live listener counts dropping on dispose,
  capability withdrawal).
- Persistence: `persistence/SaveStoreImpl.ts` + `SettingsStoreImpl.ts`, covered by
  `packages/runtime/test/persistence.test.ts`; exercised through a **real browser reload** in the
  `idle-incremental` proof.
- Audio: `audio/WebAudioBus.ts` (140 lines) builds a real master/music/SFX gain graph, synthesises
  seven semantic cues, stays `locked` until a user gesture, and degrades to `unavailable` rather
  than throwing where Web Audio is absent. Live in every browser journey (`audioUnlock` is a
  first-class debug-snapshot field) with zero console errors.
- Content: `content/` plus `@sw2d/content-pipeline`, exercised against the real
  `starter/content/levels/intro.json` and the real `docs/resources/VISUAL_ASSET_MANIFEST.json`,
  not only synthetic fixtures.
- Accessibility: `accessibility/AccessibilityStateImpl.ts` is a derived projection - `projection.test.ts`
  proves reduced motion forces screen shake to zero without a second stored setting.
- Debug: `debug/DebugStateImpl.ts` is a pull-based, side-effect-free snapshot with disposable
  contributions, and is the surface every smoke/proof/matrix/release/responsive assertion reads.

**Reason:** Each subsystem is real, has unit coverage, and is additionally exercised through a real
production build in Chrome.

### A04 - Six controller families

**State: PASS**

**Evidence:** `packages/runtime/src/controllers/` contains exactly six controllers plus a barrel:
`platformController.ts`, `topDownController.ts`, `vehicleController.ts`, `gridController.ts`,
`pointerActionController.ts`, `uiSimulationController.ts`. The repository's exact names are
`pointer-action` and `ui-simulation` (the preset catalog's `controllerFamilies` values are
`platform`, `top-down`, `vehicle`, `grid`, `pointer`, `ui-simulation`; `shellPackId()` maps each to
a generated shell). Each is a real intent reader against a real `ActionInputHost`, and each has
focused deterministic coverage in `packages/runtime/test/controllers/` plus a shared-contract suite.
Every one of the six is exercised by a real generated game in `npm run release:verify` (6/6, one
representative per controller-shell family).

**Reason:** All six exist, are real, and each has a real generated game booting and entering play
through it in a real browser.

### A05 - System packs

**State: PASS**

**Evidence:** `packages/packs/src/ids.ts` declares ten pack ids - `sw2d.combat`, `sw2d.ai`,
`sw2d.world`, `sw2d.world-entities`, `sw2d.progression`, `sw2d.arcade`, `sw2d.puzzle`,
`sw2d.simulation`, `sw2d.narrative`, `sw2d.strategy` - covering every family the acceptance contract
names (combat, AI, world, progression, arcade, puzzle, simulation, narrative, strategy). Each is a
real installable service, not a label: implementations run 85-136 lines each with real state,
bounded/clamped operations, typed events and disposal (e.g. `combatPack.ts`'s `CombatService`
exposes register/get/damage/heal/setInvulnerableFor/remove/list with deterministic, RNG-free,
wall-clock-free semantics). `packages/runtime/test/packsComposition.test.ts` installs all ten
together through the real `SystemHostImpl` + `resolveInstallOrder` + `CapabilityRegistryImpl`,
including config-validation, declared-`provides` and throwing-teardown failure paths.
`packages/packs/test/capabilityIds.test.ts` enforces ADR-0011 naming across all ten.

**Reason:** Ten real, capability-publishing, dependency-resolved, installable services - proven
installed together and proven installed inside 40 real generated games via `npm run qa:matrix`.

### A06 - Tiled semantic entity pipeline

**State: PASS**

**Evidence:** `@sw2d/content-pipeline`'s `tiled/normalize.ts` (191 lines) + `objectClasses.ts`
normalize real Tiled JSON (`"type": "map"`, `tilelayer`/`objectgroup` layers, per-object `class`
and typed `properties`) against a fixed nineteen-class catalog, rejecting unknown classes before a
`NormalizedLevelObject` can exist. `packages/packs/src/world/entityRegistryPack.ts` dispatches a
normalized object to a factory registered by semantic class id. The real browser consumer is
`starter/tiled-proof.html` driven by `starter/src/game-specific/tiledLevelPack.ts`, which runs on
every `npm run qa:smoke` as target `starter-tiled-proof` (PASS) - a full Tiled-sourced
checkpoint/collectible/hazard/exit walk against a real production build. The real
`starter/content/levels/intro.json` is exercised directly by tests, not only fixtures. Every one of
the 74 presets generates a `content/levels/main.json` that normalizes and validates
(`packages/cli/test/generate.test.ts`).

**Reason:** Normalization, validation, semantic-registry dispatch, and a real browser consumer all
exist and pass. Tile-*image* rendering is explicitly out of scope by ADR-0014's "Rejected" section
and is not required by this item.

### A07 - JSON Schema validation

**State: PASS**

**Evidence:** Thirteen JSON Schema documents live in `packages/schemas/schemas/`
(`game-definition`, `preset-definition`, `system-pack-selection`, `action-bindings`,
`game-settings`, `tuning`, `asset-descriptor`, `content-assets`, `ui-copy`, `theme-manifest`,
`level-document`, `resource-record`, `resource-manifest`), each versioned in its `$id`
(`urn:sw2d:schema:<name>:v1`), plus two pack-config schemas owned by the pack that needs them
(`packages/packs/schemas/{progression,arcade}-config.schema.json` -> `pack-progression-config:v1`,
`pack-arcade-config:v1`) and the starter's own placeholder-mover config schema: 15 distinct
`urn:sw2d:schema:*` ids in total. Validation happens at meaningful
boundaries, not decoratively: at `sw2d new` (every generated document), at `sw2d validate`, at
`sw2d pack` (the resource-governance gate refuses to build on an invalid manifest), and at runtime
through the dependency-inverted `PackConfigValidator` supplied at the composition root
(ADR-0010/0013 - `@sw2d/runtime` never imports Ajv or `@sw2d/schemas`).
ADR-0017's code-config seam is preserved exactly: `sw2d.puzzle` declares `configSource: 'code'`,
therefore has no `configSchemaId`, and `SystemHostImpl` routes it to `createGame({ packConfig })`
and refuses the install **by name at install time** when it is absent, rather than handing it `{}`.
`packages/cli/test/generate.test.ts` proves all six `sw2d.puzzle` presets get a working code seam
and every other preset gets an empty documented map.

**Reason:** The core content model is schema-validated at real boundaries, and the one legitimately
unschemable config is handled by an explicit, enforced seam rather than a false JSON schema.

### A08 - 74 valid presets

**State: PASS**

**Evidence:** `npm run sw2d -- list-presets` prints exactly 74 rows. Family split, counted from the
live catalog output: platforming 10, top-down-action 10, shooter 7, vehicle-movement 5,
puzzle-arcade 10, strategy-defense 7, simulation-management 8, narrative-exploration 7,
party-toy-weird 10 = 74. Maturity split: 5 `proof-validated`, 7 `smoke-validated`, 62 `recipe`,
0 `experimental`. `packages/presets/test/**` proves exact shape (74/74, exact ids, family counts,
deterministic order), schema validity against `preset-definition:v1`, composition validity, real
pack-id and controller-family checks, real `resolveInstallOrder` dependency resolution,
maturity/gamepad/limitation honesty, deterministic materialization, docs-sync and full
pack-consumer coverage. All pass in the final `npm test` run.

**Reason:** Exact count, exact ids, exact family distribution, and schema/composition/integrity
evidence all hold mechanically.

### A09 - 74 runnable generated starters

**State: PASS**

**Evidence:** Two layers, together covering all 74:
1. **All 74 generate valid source.** `packages/cli/test/generate.test.ts` builds every one of the
   74 preset trees and asserts, per preset: no unresolved template tokens, a schema-valid
   `content/game.json`, a schema-valid theme manifest, a level document that normalizes and
   validates, a `src/game-specific/packConfig.ts` with a working seed where `sw2d.puzzle` is
   required, and byte-identical output on repeated generation.
2. **Real generate → build → *enter play* for every runtime signature.** `npm run qa:matrix`
   (`tools/scripts/generated-runtime-matrix.ts`) result this phase: **40/40 generated games really
   entered play** - each really generated under `games/`, really `tsc`-checked, really `vite build`
   -ed, then served and driven in real system Chrome (press CONFIRM, assert `scene === 'sw2d.play'`,
   assert every required pack **plus** the shell pack installed, assert zero console errors).

The mapping to all 74 was verified **independently** during this phase rather than taken from the
script: recomputing `(primary controller shell, sorted required-pack-id set)` directly from the
catalog yields 74 presets → **37 distinct signatures** → **40 run targets** (37 signature
representatives plus every `sw2d.puzzle` preset not already a representative -
`puzzle-platformer`, `sokoban`, `match-puzzle`, `falling-block-puzzle`, `physics-puzzle`,
`escape-room`, all 6 individually targeted). Presets belonging to a signature with no run target:
**0**. Sum of signature members: **74**.

**Reason:** Build success alone is explicitly not the bar here, and it is not what was accepted:
every one of the 74 is covered by a real generation whose composition really installs and really
enters play, with the puzzle path - the one class Phase 9 caught building-but-not-installing -
covered preset-by-preset rather than by representative.

### A10 - 12 functional representative demos

**State: PASS**

**Evidence:** Exactly twelve committed demos exist under `demos/`: `traditional-platformer`,
`chase-platformer`, `metroidvania`, `twin-stick-shooter`, `stealth-game`, `bullet-hell`,
`top-down-racer`, `sokoban`, `tower-defense`, `turn-based-tactics`, `idle-incremental`,
`visual-novel`. `npm run qa:smoke` this phase: **14/14 PASS** (the twelve demos plus the two
starter pages), each through real system Chrome against a real production build, with zero console
errors and zero external requests. Each demo's committed spec drives its preset's *defining
mechanic*, not a title screen - e.g. `metroidvania` proves a previously-blocked path becomes
traversable only after a real unlock flag; `twin-stick-shooter` proves independent move-and-aim
(ADR-0016) plus projectile damage; `visual-novel` proves a real branch flag changing an ending;
`idle-incremental` proves save/reload persistence across a real browser navigation. Each demo's
`src/game-specific/shellPack.ts` is hand-written game logic; no demo touches shared runtime code.

**Reason:** Twelve committed, real, mechanically-distinct demos with real-browser mechanic
evidence. Title-only would not pass these specs.

### A11 - Five deep proof games

**State: PASS**

**Evidence:** `npm run qa:proof` this phase: **5/5 PASS** - `chase-platformer`,
`twin-stick-shooter`, `tower-defense`, `sokoban`, `idle-incremental`. Each has a frozen
`proofs/<id>/PROOF_CONTRACT.md` (5 present) and a committed spec in `packages/qa/proof-specs/`
driving the full journey in real Chrome. Mechanical distinctness, read from the specs themselves:
- **chase-platformer** - Arcade-physics platforming: coyote time, jump buffer, double jump,
  content-derived collectible quota, hazard death, checkpoint respawn, chase pressure that freezes
  during pause and post-respawn grace.
- **twin-stick-shooter** - Independent digital aim, shared `ProjectilePool`, two content-authored
  waves with wave 2 dormant until wave 1 clears, contact damage, and a restart that returns a
  *fresh* pool's counters to zero (proving a real scene reinstall, not a reset flag).
- **tower-defense** - Grid-cursor placement with invalid-placement rejection and no spend, exact
  currency arithmetic at every step, real closest-in-range targeting, and a **load-bearing
  upgrade**: the second enemy must die in one hit at doubled damage, so the upgrade is required for
  the win rather than cosmetic.
- **sokoban** - Real `sw2d.puzzle` `PuzzleService` via ADR-0017's `configSource: 'code'` seam as the
  *only* board state; push rules, byte-for-byte-unchanged invalid pushes, exact undo, exact reset.
- **idle-incremental** - Deterministic passive production measured across two equal stepped
  intervals, a job cycle, a rate-doubling upgrade whose effect is measured afterwards, and state
  restored across a **real browser reload** through real storage.

`packages/presets/test/honesty.test.ts` mechanically restricts `proof-validated` to exactly these
five ids.

**Reason:** Five end-to-end, mechanically distinct proofs, each passing its frozen contract in a
real browser, with the maturity label mechanically pinned to that evidence.

### A12 - Ordinary game work avoids runtime edits

**State: PASS**

**Evidence:** The decisive test is what adding real games actually cost. Phase 10 added the five
deep proof games (commit `513f58c`): **zero** files changed under `packages/runtime/src`,
`packages/contracts/src` or `packages/packs/src`. The only `packages/` changes were five preset
`maturity` labels, the honesty test, and the five QA proof specs plus the harness. Every generated
game's editable surface is `content/**`, `themes/**` (via `content/themes/`), `resources/`, and
`src/game-specific/` (`packConfig.ts`, `shellPack.ts`) - confirmed by generating a tree and listing
it. All 12 demos and all 5 proofs are laid out exactly that way.
The one shared-runtime change since is Phase 11's single
`requestAnimationFrame(() => game.scale.refresh())` in `createGame.ts` - a genuine shared bug fix
for a real `Phaser.Scale.FIT` boot-time measurement race, verified against the whole regression
ladder, which this criterion explicitly does not fail on.

**Reason:** Real game work - twelve demos and five deep proofs - was done entirely from the game
side with the machine untouched.

### A13 - Offline production QA

**State: PASS**

**Evidence:** Four independent layers, all green this phase.
- Source: a grep for `fetch(`, `XMLHttpRequest`, `WebSocket`, `importScripts`, `sendBeacon` across
  `packages/*/src`, `starter/src`, `demos/*/src`, `proofs/*/src` returns **zero** hits.
- Static build guard: `npm run check:offline` PASSED on the starter build and on every packed
  artifact.
- Real-browser oracle: every `qa:smoke` (14/14), `qa:proof` (5/5), `qa:matrix` (40/40) and
  `release:verify` (6/6) target asserts **zero external requests** against a live loaded page.
- Independent cold-start check: serving the packed artifact of a freshly generated game in an
  isolated snapshot and driving it in real Chrome returned `externalRequests: []` and
  `consoleErrors: []`.

**Reason:** Production/packed games require no external runtime network, proven statically and at
runtime.

### A14 - Mobile/desktop baseline input and responsive UI

**State: PASS**

**Evidence:** Desktop input: keyboard-driven journeys pass for all 14 smoke targets, all 5 proofs,
all 40 matrix targets and all 6 release candidates. Touch/pointer input shares the same semantic
action path with no duplicated gameplay logic (`PointerAdapter` feeds the same `ActionInputHost`).
Responsive: `npm run qa:responsive` this phase = **19/19 PASS** across all 19 committed surfaces
(2 starter pages + 12 demos + 5 proofs) at **375x812 portrait** and **844x390 landscape**, asserting
no page overflow, canvas fits its box, touch controls visible/unclipped/>=44x44 (project standard
56x56), no duplicate DOM controls across an in-place viewport switch, and zero console errors.
The Phase 11 repair is real and universally propagated: `#app { height: 100% }` is present in all
19 committed `styles.css` files **and** in `packages/cli/src/templates/styles.css.template`, so
every future generated game inherits it; the shared `createGame` scale-refresh is present at
`packages/runtime/src/core/createGame.ts:206` with the race documented in place.

**Emulation vs physical device - explicit:** `qa:responsive` uses Chromium device emulation
(`isMobile: true`, `hasTouch: true`, `deviceScaleFactor`) at `tools/scripts/qa-responsive.ts:200-201`.
**No physical phone or tablet has ever touched this factory's output.**

**Decision:** the available evidence **does** satisfy this master item. The contract asks that
"mobile/desktop baseline input and responsive UI work for applicable presets," not that a device lab
exist. Baseline input works and is proven; responsive layout is proven on every committed surface in
both orientations with a real defect found and fixed by that suite; and the emulation boundary is
labelled honestly everywhere it is claimed rather than being passed off as hardware. Physical-device
touch remains an open, correctly-classified unknown (§ Nonblocking known limitations), non-blocking.

### A15 - Namespaced/versioned saves

**State: PASS**

**Evidence:** `packages/runtime/src/persistence/SaveStoreImpl.ts` keys every record
`sw2d:<namespace>:<slot>`, and the namespace is the game's own id -
`createGame.ts:102` constructs `new SaveStoreImpl(definition.id, storage)`. Records carry
`schemaVersion`; a mismatch is migrated through an explicit `migrate` hook or **discarded with a
warning**, never silently reinterpreted; non-JSON or non-object payloads are removed and defaulted.
`packages/runtime/test/persistence.test.ts` covers these paths, and the `idle-incremental` proof
round-trips a versioned save through real browser storage across a real reload.
Protected invariant 11 pins this.

**Reason:** Keys are game-namespaced and records are schema-versioned, mechanically and at runtime.

### A16 - Restart/lifecycle cleanliness

**State: PASS**

**Evidence:**
- Unit: `packages/runtime/test/lifecycle.test.ts` proves reverse-order disposal, exactly-once
  teardown, isolation of a throwing teardown, `EventBusImpl` live listener counts dropping to zero
  on dispose, and capability withdrawal on handle disposal.
- Real browser, per restart: `starter-foundation` asserts `runIndex` increments and the run returns
  unpaused to `sw2d.play`. The `twin-stick-shooter` proof asserts that after a restart a **fresh**
  `ProjectilePool` reports `projectilesSpawned === 0`, `projectilesLive === 0` and
  `projectilesExpired === 0` alongside a reset score/health/wave - a reset flag could not produce a
  new pool's counters, so this is evidence of a real scene reinstall rather than state clearing.
- No leaked DOM: `qa:responsive` asserts no duplicate DOM controls after an in-place viewport
  switch, on all 19 surfaces.
- Architecture: every allocating system registers a disposal path on a `DisposableBag`
  (invariant 8), including the `PRE_STEP` input listener (`createGame.ts:215`); the debug snapshot
  is built from *disposable contributions*, so a section still present after a restart is itself
  evidence of a leak.

**Reason:** Repeated restart and scene transitions demonstrably reinstall rather than accumulate,
with disposal proven at the unit level and reinstallation proven in a real browser.
Note for future work, not a gap against this item: the strongest possible form - asserting the
snapshot's `listeners` counters stay flat across N automated restarts - is currently manual/
historical (recorded in `OPERATIONAL_STATE.md` from Phase 3/5: 8 consecutive restarts with every
counter and every live Phaser GameObject count flat) rather than part of a committed spec.

### A17 - Resource policy / manifests

**State: PASS** (after this phase's one targeted repair - see § Targeted repairs)

**Evidence:**
- `resource-policy.json` is real and live: acceptable licenses, forbidden-at-runtime list,
  approval-required list, and the `c_chase` prohibited-source rule.
- Pack-time governance is mechanical, not prose: `sw2d pack` runs the resource gate **before any
  build**, refusing to pack when `resources/RESOURCE_MANIFEST.json` is missing, schema-invalid, or
  holds a non-`approved` record. Every generated game gets that manifest at `sw2d new` time
  (`generateResourceManifest()`), and every packed `RELEASE_MANIFEST.json` records the outcome -
  verified live this phase on a freshly generated game: `"resourceGovernance": { "manifestValid":
  true, "recordCount": 7, "allApproved": true }`.
- Shipped-dependency notices are mechanically derived, not hand-listed:
  `packages/cli/src/releasePackaging/notices.ts`'s `resolveShippedDependencies()` walks the real
  `@sw2d/*` → npm graph from the generated game's own `package.json`, guarded by
  `packages/cli/test/notices.test.ts` (including "throws rather than silently omitting an
  unresolvable dependency").
- Phaser/Ajv/ajv-formats notice accuracy: **accurate**. `docs/resources/THIRD_PARTY_NOTICES.md`
  lists all three as shipped with full license text, and `CODE_RESOURCE_MANIFEST.json` records
  Phaser 4.2.1 MIT, ajv 8.20.0 MIT, ajv-formats 3.0.1 MIT with `shippedInBuild: true` - matching
  what is actually bundled.

**Reason:** Policy, per-game manifests, mechanically-derived shipped notices and a real pack-time
gate all exist and work. One genuine gap was found and repaired in this phase: the
policy-designated machine-readable record `docs/resources/CODE_RESOURCE_MANIFEST.json` omitted two
real, declared direct dependencies (`playwright-core`, `@types/node`) that MASTER_PROJECT §20.2
requires a record for. Provenance was never *unknown* - `playwright-core` has been fully documented
in `docs/architecture/DEPENDENCY_BASELINE.md` since Phase 8 - but the designated manifest disagreed
with it by omission. Both are now recorded, the dev-tooling notices table lists them, and a new
mechanical guard derives the required set from every workspace `package.json` so the omission
cannot recur.

### A18 - Self-contained static release packing

**State: PASS**

**Evidence:** `npm run release:verify` this phase: **6/6 PASS**, one fresh-generated game per
controller-shell family (`traditional-platformer`, `top-down-adventure`, `asteroids-shooter`,
`sokoban`, `gallery-shooter`, `idle-incremental`), each covering generate → validate → pack →
manifest consistency → every `SHA256SUMS` entry verified against the file on disk → resource
governance → serve the **packed** directory (not `dist/`) in real Chrome → enter play → every
declared pack installed → zero console errors → zero external requests. The
`traditional-platformer` candidate additionally packed twice from identical source and diffed
**byte-identical**.
Independently reproduced this phase in an isolated snapshot on a different preset
(`metroidvania`): the pack contains exactly `index.html`, `assets/` (css + js + map),
`RELEASE_MANIFEST.json`, `SHA256SUMS`, `THIRD_PARTY_NOTICES.txt` - **no `.ts` source, no
`package.json`, no tests, no `node_modules`**. `RELEASE_MANIFEST.json` is deterministic (no
timestamps, no random ids, no absolute paths) and carries `projectLicenseStatus: "UNLICENSED"`.

**Reason:** The artifact is self-contained, deterministic, checksummed, notice-bearing, offline-
verified in a real browser, and free of source/`node_modules` leakage.

### A19 - Operational state truthfulness

**State: PASS**

**Evidence:** `OPERATIONAL_STATE.md` separates "Verified capabilities", "Implemented but
unverified", "Known failures / gaps", "Unknown", and a revision log, and marks superseded claims by
striking them through with the closing evidence cited rather than deleting them. Cross-checks run
this phase:
- **Every markdown link in every tracked `.md` file resolves** - a mechanical sweep of all
  `](path)` targets across the whole repository found **zero** broken links.
- Every full repository-relative source path named in the current-state documents was checked for
  existence. Exactly two were stale, both in `OPERATIONAL_STATE.md`'s "Current phase" section,
  naming `packages/cli/src/release/{checksums,notices}.ts` - a directory Phase 11 itself renamed to
  `releasePackaging/` in the same commit. **Repaired this phase.**
- Spot-checked claims against reality rather than against each other: the maturity split (5/7/62/0),
  the 74/37/40 matrix mapping, the 19 responsive surfaces, the `#app { height: 100% }` propagation
  to all 19 styles plus the CLI template, the `createGame` scale-refresh, the zero-dependency
  `@sw2d/contracts`, and the ten pack ids all match the documents exactly.
- No document claims a performance/FPS number anywhere - grep-confirmed - and every emulation-based
  claim is labelled as emulation at the point of claim.

**Reason:** The current state separates verified/unknown/deferred/superseded correctly and, after
one stale-path repair, contains no contradiction capable of changing an implementation or acceptance
decision. Deliberately **not** changed: the same stale path inside Revision 13's history entry
(now `OPERATIONAL_STATE.md` lines 877-879, in Revision 13's entry). That is historical revision text describing what Phase 11
wrote at the time; the rename is narrated at length in `PROJECT_BIBLE.md`, and rewriting a past
revision to look tidier in hindsight is exactly what this repository's additive-history rule
forbids.

### A20 - Cold-start recoverability

**State: PASS**

**Evidence:** An independent challenge was executed this phase in an isolated
`git checkout-index --all` snapshot (3.2 MB; verified to contain no `node_modules`, no `dist`, no
`pack`, no `games/`, no `.git`), treating chat memory as unavailable and following only
`README.md` → `docs/handoff/COLD_START_HANDOFF.md` and the links they name. Full step-by-step
results in § Cold-start challenge. Every step succeeded, including a real-Chrome play check on the
packed artifact and independent tamper detection.

**Reason:** Another coding agent can continue from repository evidence alone. The one
discoverability gap found - a mandatory acceptance command with no documented invocation - was
repaired in this phase (§ Targeted repairs).

---

## F01-F13 master failure-condition audit

### F01 - Runtime effectively one giant file
**Present: NO** - **Evidence:** 35 runtime modules over ten directories, 2,514 lines total, largest
file 290 lines; largest non-test file in all of `packages/` is also 290 lines. See A01.

### F02 - Genre presets duplicate engine code
**Present: NO** - **Evidence:** `packages/presets/` is 2,103 lines across 20 files for all 74
recipes - declarative compositions referencing pack ids and controller families, never engine code.
ADR-0015 and protected invariant 23 forbid `@sw2d/presets` production code from importing
`@sw2d/runtime` or `@sw2d/schemas` at all; `packages/presets/package.json` confirms the dependency
set is `@sw2d/contracts` + `@sw2d/packs`'s side-effect-free `./ids` subpath. Real pack selections
are proven to resolve through the real `resolveInstallOrder`.

### F03 - Ordinary generated-game work requires core edits
**Present: NO** - **Evidence:** Phase 10 added five full proof games with **zero** changes under
`packages/runtime/src`, `packages/contracts/src` or `packages/packs/src`. Generated games expose
`content/**`, `themes/`, `resources/`, `src/game-specific/**` as the edit surface. See A12.

### F04 - 74 presets are empty labels rather than real compositions
**Present: NO** - **Evidence:** Every preset declares real required/optional pack ids, controller
families, content roles, input modes, a validation profile and honest `knownLimitations` (checked
directly on deep-tail `recipe` entries such as `museum-exhibit` and `photography-game`, not only on
the demo/proof ids). All 74 pass schema + composition + real-dependency-resolution tests, all 74
generate token-free schema-valid trees, and all 74 are covered by a real generate-build-play target
through their runtime signature (37 signatures, 40 targets, 0 uncovered).

### F05 - Proof games only show title screens
**Present: NO** - **Evidence:** `qa:proof` 5/5, where each spec asserts deep mid-game state:
exact currency arithmetic and a load-bearing tower upgrade; byte-for-byte-unchanged invalid pushes
and exact undo/reset; wave-gated enemy activation and projectile-lifecycle invariants; coyote/
buffered/double jumps and checkpoint respawn; measured production-rate change across a real reload.
A title screen cannot satisfy any of these.

### F06 - Five proofs are not mechanically distinct
**Present: NO** - **Evidence:** The five span Arcade-physics platforming, twin-stick shooting with a
shared projectile pool, grid-cursor tower defense with placement economy, code-configured
`PuzzleService` sokoban with undo, and a save-backed idle simulation with no canvas movement at all.
They exercise different controllers (platform, top-down, grid, ui-simulation) and different pack
sets. See A11.

### F07 - Input listeners duplicate after restart
**Present: NO** - **Evidence:** The single `PRE_STEP` input listener has its removal registered on
the root disposable bag (`createGame.ts:215`); `ActionInputHost.addAdapter` disposes an adapter
immediately if the host is already disposed; `EventBusImpl` live-listener counts drop to zero on
dispose (unit-tested); restart demonstrably reinstalls the scene (fresh `ProjectilePool` counters at
zero); `qa:responsive` asserts no duplicate DOM controls across a viewport switch; and the
historical 8-restart flat-counter check is recorded in `OPERATIONAL_STATE.md`. See A16.

### F08 - Save data leaks across games
**Present: NO** - **Evidence:** Keys are `sw2d:<gameId>:<slot>` with `gameId` taken from the game
definition; a `schemaVersion` mismatch is migrated or discarded, never reinterpreted. Two games on
one origin cannot read each other's slots. See A15.

### F09 - External runtime network is required
**Present: NO** - **Evidence:** Zero `fetch`/XHR/WebSocket/`importScripts`/`sendBeacon` in any
source; `check:offline` passes on every build and every pack; and the live-page `externalRequests()`
oracle returned zero for all 14 smoke, 5 proof, 40 matrix and 6 release targets, plus the
independent cold-start pack check. See A13.

### F10 - Asset/dependency provenance is unknown
**Present: NO** - **Evidence:** No third-party visual/audio/font asset exists anywhere (placeholder
art is generated in-process, audio is synthesised, typography is system stacks). Every generated
game's assets are recorded as project-owned/generated and gated at pack time. Every direct code
dependency now carries a full §20.2 record in `docs/resources/CODE_RESOURCE_MANIFEST.json` -
phaser, ajv, ajv-formats, typescript, vite, vitest, playwright-core, @types/node - cross-checked
against `docs/architecture/DEPENDENCY_BASELINE.md`, with all eight licenses inside
`resource-policy.json`'s acceptable set and none introducing install scripts, network or telemetry
(asserted mechanically). Shipped notices are derived from the real graph.

### F11 - Mobile controls clip or become unreachable
**Present: NO** - **Evidence:** `qa:responsive` 19/19 at 375x812 portrait and 844x390 landscape
asserts no page overflow, canvas fits its box, and every touch control is visible, unclipped and
>=44x44. This is the exact suite that caught the real clipping defect (0/19 on its first Phase 11
run); the fix is present in all 19 committed styles and in the generator template. Emulation, not
hardware - see A14.

### F12 - Stale service-worker cache hides broken builds
**Present: NO (not applicable, verified)** - **Evidence:** A repository-wide grep for
`serviceWorker`, `service-worker`, `sw.js`, `registerSW` and `workbox` across all `.ts`, `.html`,
`.js` and `.json` (excluding `node_modules` and the lockfile) returns **zero** hits. No service
worker exists to go stale, and every QA journey loads a freshly built artifact from a per-run
static server.

### F13 - State docs claim verification without evidence
**Present: NO** - **Evidence:** Every headline claim in the current-state documents was re-run this
phase and matched: validate/1787 unit tests, smoke 14/14, proof 5/5, responsive 19/19,
release:verify 6/6, matrix 40/40, maturity 5/7/62/0. Maturity labels are mechanically pinned to
evidence by `packages/presets/test/honesty.test.ts`. Unmeasured things are stated as unmeasured -
no FPS number appears anywhere in the repository, and emulation is labelled emulation at every
point of claim. Zero broken markdown links repository-wide. The two stale source paths found were
navigational, not verification claims, and are repaired.

---

## Phase 11 claim reconciliation

Every claim below was re-established this phase by running the command or reading the artifact -
not by quoting `PHASE11_FINAL_OPUS_HANDOFF.md`.

### Release

| Phase 11 claim | Phase 12 finding |
|---|---|
| `release:verify` 6/6 | **Confirmed** - re-run, 6/6 PASS across all six controller-shell families |
| Byte-identical double-pack | **Confirmed** - `[PASS] double-pack byte-identical` on the `traditional-platformer` candidate |
| `RELEASE_MANIFEST.json` | **Confirmed** - inspected directly on an independently generated game; deterministic fields only, no timestamps/random ids/absolute paths, `projectLicenseStatus: "UNLICENSED"`, `resourceGovernance` summary present and true |
| `SHA256SUMS` | **Confirmed twice** - by the repository's verifier (6 files per candidate) and, independently, by the standard system tool `shasum -a 256 -c` in an isolated snapshot: `OK` for all six files |
| Tamper failure | **Confirmed independently** - a byte appended to `index.html` in a copy of a packed artifact produced `index.html: FAILED` / `WARNING: 1 computed checksum did NOT match` from the system tool |
| Pack-time resource gate | **Confirmed** - gate runs before any build; a successful pack recorded `manifestValid: true, recordCount: 7, allApproved: true` |
| Mechanically-derived third-party notices | **Confirmed** - `resolveShippedDependencies()` walks the real graph; guarded by `notices.test.ts`, which also asserts it throws rather than silently omitting |
| Packed artifact has zero external requests | **Confirmed independently** - serving the packed dir of a cold-start-generated game in real Chrome returned `externalRequests: []`, `consoleErrors: []`, `scene: "sw2d.play"` |

### Responsive

| Phase 11 claim | Phase 12 finding |
|---|---|
| `qa:responsive` 19/19 | **Confirmed** - re-run, 19/19 PASS |
| All 19 committed surfaces | **Confirmed** - the run enumerates 12 `demo:*` + 2 `starter:*` + 5 `proof:*` = 19 |
| 375x812 portrait and 844x390 landscape | **Confirmed** in source (`qa-responsive.ts:88-89`) and in the run's own summary line |
| No critical clipping/overflow | **Confirmed** - overflow, canvas-fit, >=44x44 touch-target and duplicate-DOM checks all pass on every surface |
| Generated CSS template contains the repair | **Confirmed** - `packages/cli/src/templates/styles.css.template` has `#app { ... height: 100% }`, as do all 18 other committed `styles.css` files (19/19) |
| Shared `createGame` scale-refresh repair is real | **Confirmed** - `packages/runtime/src/core/createGame.ts:206`, `requestAnimationFrame(() => game.scale.refresh())`, with the `Phaser.Scale.FIT` measurement race documented in place; diffed against the Phase 11 commit |

### Reproducibility

**Confirmed, and re-proven rather than re-read.** A fresh `git checkout-index --all` snapshot of the
candidate tree (3.2 MB) was verified to contain no `node_modules`, `dist`, `pack`, `games/` or `.git`,
then took `npm ci` → `sw2d doctor` → `list-presets` → `sw2d new` → `sw2d validate` → `sw2d pack` →
system-tool checksum verification → real-Chrome play, all green, with no dependency on
primary-worktree state. The Phase 11 `.gitignore` regression fix holds in the snapshot:
`packages/cli/src/releasePackaging/` and `release/README.md` are both present, and `.gitignore`'s
pattern is the narrowed `release/out/`.

### Cold start

**Confirmed.** `RECOVERABLE` does not depend on chat-only knowledge: every step of the challenge was
driven from `README.md` and `docs/handoff/COLD_START_HANDOFF.md` and the documents they link. No
credential or secret is required anywhere - none found, no `.env`/`.pem`/key material tracked.
External prerequisites are explicit and were all real: npm registry/cache for `npm ci`, a
system-installed Chrome for browser QA (detected and reported by `doctor`), and Tiled as genuinely
optional. One gap was found that the Phase 11 audit had not: see § Targeted repairs, item 3.

### State

Searched for contradictions capable of changing an implementation or acceptance decision. Found
**one** (the stale `packages/cli/src/release/` path in the "Current phase" section) and repaired it.
Zero broken markdown links repository-wide. Harmless historical revision text was deliberately left
alone.

---

## Final validation

Run on the final tree, after this phase's repair.

| Command | Result |
|---|---|
| `npm run sw2d -- doctor` | all `[OK]` except one expected `[WARN]` (Tiled optional/not configured - not required to run generated games); system Chrome found |
| `npm run validate` (typecheck + test + build + offline guard) | **PASS** |
| `npm test` | **1787/1787** (1781 inherited + 6 added by this phase's provenance guard) |
| `npm run qa:smoke` | **14/14** |
| `npm run qa:proof` | **5/5** |
| `npm run qa:responsive` | **19/19** |
| `npm run release:verify` | **6/6** |
| `npm run qa:matrix` (`tools/scripts/generated-runtime-matrix.ts`) | **40/40**, covering 74 presets → 37 signatures → 40 targets, independently re-derived |

**Note on the documented invocation.** The Phase 12 brief named
`npx tsx tools/scripts/generated-runtime-matrix.ts`. That command does not work here and was not
used: `tsx` is not a dependency of this repository (it is absent from every `package.json` and from
`package-lock.json`), so `npx tsx` attempts an undeclared registry download. Every other TypeScript
tool in this repository runs under plain `node` (Node's type-stripping), and the matrix runs
correctly that way. It is now `npm run qa:matrix`.

**No result above is a performance claim.** Every browser journey uses the QA harness's
deterministic fixed-step virtual clock (`stepFrames()`, 16.67 ms of *simulated* time per frame).
That is determinism evidence. Real wall-clock FPS remains unmeasured and is not claimed anywhere.

---

## Cold-start challenge

Executed independently, treating chat memory as unavailable. Source: a non-destructive
`git checkout-index --all --prefix=<tmp>/sw2d/` snapshot of the candidate tree - **not** the
primary worktree's `node_modules`, untracked files, `dist`/`pack`, scratch `games/`, or caches.
The challenge was run **before** this phase's repair, which is how it surfaced the missing
documented command (below); the repair changed no top-level file and added no prerequisite, so
every step below reproduces identically on the final tree.
Snapshot contents were inspected before installing anything: 3.2 MB, top level exactly
`.gitignore`, `.nvmrc`, `MASTER_PROJECT.md`, `OPERATIONAL_STATE.md`, `PROJECT_BIBLE.md`,
`README.md`, `demos/`, `docs/`, `package.json`, `package-lock.json`, `packages/`, `proofs/`,
`release/`, `resource-policy.json`, `starter/`, `tools/`, `tsconfig*.json`, `vitest.config.ts` -
and verified to contain no `node_modules`, `dist`, `pack`, `games/` or `.git`. Entry point:
`README.md` → `docs/handoff/COLD_START_HANDOFF.md`, following repository links only.

| # | Step | Result | Discoverable without hidden knowledge? |
|---|---|---|---|
| 1 | `npm ci` | PASS - 0 vulnerabilities | Yes - `README.md` "Install and run", `COLD_START_HANDOFF.md` §6 |
| 2 | `npm run sw2d -- doctor` | PASS - Node/npm/install/TypeScript/Ajv/required directories all `[OK]`, system Chrome found; `games/` and Tiled warnings expected | Yes - §6 and README's CLI block |
| 3 | Discover how to list presets | `npm run sw2d -- list-presets` → **74** rows | Yes - named in README, `COLD_START_HANDOFF.md` §6, and `docs/cli/CLI_REFERENCE.md` |
| 4 | Generate one representative game | `npm run sw2d -- new coldstart-probe --preset metroidvania` → `games/coldstart-probe/`, with a printed next step | Yes |
| 5 | Validate it | `npm run sw2d -- validate coldstart-probe` → `[PASS]` schema/content + unit tests, TypeScript, production build, browser smoke | Yes |
| 6 | Build/pack it | `npm run sw2d -- pack coldstart-probe` → offline guard passed, packed | Yes |
| 7 | Verify checksums / release artifact | `shasum -a 256 -c SHA256SUMS` (**standard system tool**, not this repository's code) → `OK` for all 6 files. `RELEASE_MANIFEST.json` inspected: deterministic, `projectLicenseStatus: "UNLICENSED"`, `resourceGovernance` all-approved. Tamper check on a copy: appending one byte to `index.html` → `index.html: FAILED`. Leakage check: pack contains only `index.html`, `assets/`, and the three release files - no `.ts`, no `package.json`, no tests, no `node_modules` | Yes - `release/README.md`, `docs/release/RELEASE_READINESS.md` |
| 8 | Real-browser boot/play check (system Chrome present) | Served the **packed** dir: `sw2d.title` → CONFIRM → `sw2d.play`; `installedPacks: [sw2d.world, sw2d.world-entities, sw2d.progression, game.platform-shell]` matching the preset's declaration; `gameId: coldstart-probe`; `consoleErrors: []`; `externalRequests: []` | Yes |
| 9 | Identify where normal game-specific edits belong | `content/**`, `themes/`, `public/**`, `src/game-specific/**`; machine code is off-limits without a forcing consumer | Yes - README "The one rule" table, `COLD_START_HANDOFF.md` §5, protected invariant 3, and the worked example `starter/src/game-specific/placeholderMoverPack.ts` |
| 10 | Identify current limitations and state | Real-device touch, gamepad, wall-clock FPS, spatial pointer, universal puzzle DSL, shared grid cursor, and the software license - all found, all correctly labelled | Yes - README "Known high-level limitations", `COLD_START_HANDOFF.md` §10, `OPERATIONAL_STATE.md` "Unknown" / "Implemented but unverified" |

**Snapshot removed afterwards; nothing leaked back into the primary worktree** (`git status` clean,
`games/` empty).

**One gap found.** Steps 1-10 were all discoverable, but the generated-runtime matrix - a mandatory
acceptance command proving all 74 presets - had **no** documented invocation anywhere: no `npm run`
alias, and every document referred to it only by file path. A cold-start agent could learn the file
existed but not how to run it, and the obvious `npx tsx` guess fails because `tsx` is not a
dependency. Repaired (§ Targeted repairs, item 3).

**Node version.** Actual version used: **v26.7.0** (npm 11.19.0) - the only Node line installed on
this host; no runtime was downloaded solely for this gate, per the phase's own instruction.
`package.json engines` requires `>=22.12.0` and `.nvmrc` targets `24`, so v26.7.0 is inside the
documented supported range and the gate is judged against that range. **Exact Node 24.x execution
remains an explicit unverified compatibility detail**, unchanged from Phase 11's record. Tiled was
not used and is genuinely optional.

---

## Nonblocking known limitations

Each item below was adjudicated against the MASTER_PROJECT §54 acceptance contract, not against
what a maximal version of this factory could contain.

| Item | Blocks master acceptance | Reason |
|---|---|---|
| Real wall-clock FPS / performance | **NO** | §54 contains no performance criterion, and §34's requirements were never converted into an acceptance item. Crucially, nothing in this repository *claims* performance: every journey is explicitly determinism evidence, and no FPS number appears anywhere. An unmeasured fact that is labelled unmeasured is not a false claim. |
| Physical-device touch | **NO** | §54 item 14 asks that mobile/desktop baseline input and responsive UI *work*, which is proven on every committed surface in both orientations, with a real defect found and fixed by that suite. Chromium emulation is labelled as emulation at every point of claim rather than passed off as hardware. Closing this needs a device lab, not code. |
| Gamepad feasibility | **NO** | Not named anywhere in §54. `InputDeviceAdapter.poll()` exists and is unit-tested for cadence; no polling device has been built, and no preset claims gamepad support (mechanically checked by the catalog honesty test). Nothing overstates it. |
| Project software license = `UNLICENSED` | **NO** (for the technical contract) | §54 has no licensing criterion, and choosing one is explicitly a user decision. It **does** block public distribution - see § Final release/licensing truth for the explicit separation. |
| Spatial pointer | **NO** | Deliberately deferred with a recorded trigger (ADR-0016, `OPERATIONAL_STATE.md`). §54 item 4 asks for a pointer *controller family*, which exists (`pointerActionController`) and has a real generated game entering play through it in `release:verify`. The tower-defense proof uses a keyboard grid cursor and says so. |
| Universal puzzle DSL | **NO** | Explicitly rejected scope, not a gap: ADR-0017 records why `sw2d.puzzle` keeps its state opaque and takes code config instead, and §47's anti-overengineering rules forbid inventing a scripting language. All six `sw2d.puzzle` presets generate a working code seam and enter play. |
| Shared grid cursor | **NO** | Deferred with an explicit trigger (a second real consumer). Invariant 14 forbids a new abstraction without one. `gridController` already serves both grid consumers today. |
| Tile-image rendering | **NO** | A documented scope boundary, not an oversight - ADR-0014's "Rejected" section. §54 item 6 requires Tiled levels to work *through a semantic entity registry*, which they do, proven in a real browser. |
| Image-backed asset branch | **NO** | `queueImageAssets` exists and is unused because both themes use `kind: 'generated'`, matching the project's deliberate no-binary-art baseline. Recorded as implemented-but-unverified, which is accurate. |
| Content roles beyond tuning/levels | **NO** | Schemas exist for the six document types with real consumers; inventing more without a consumer is forbidden by invariant 14 and §47. §54 item 7 asks that the *core* content model be validated, which it is. |

None of these were implemented in this phase, per its own instructions.

---

## Targeted repairs

One targeted repair pass was used - the maximum allowed - covering three findings in one cohesive
change to provenance records, current-state accuracy, and a missing documented command path. No
gameplay mechanic, aesthetic, performance, device-lab, gamepad, spatial-pointer, puzzle-DSL,
bundle-size or speculative-refactor work was performed.

**1. Incomplete code-dependency provenance record** (A17 / MASTER_PROJECT §20.2).
`docs/resources/CODE_RESOURCE_MANIFEST.json` - the record `resource-policy.json` designates as
*the* machine-readable code-dependency inventory - omitted two real, declared, direct dependencies:
`playwright-core@1.62.1` (Apache-2.0, `devDependencies` of `@sw2d/qa`, drives every real-browser QA
command) and `@types/node@24.13.3` (MIT, root). This is the same class of omission Phase 11
corrected for `ajv`/`ajv-formats`, one step further out. Fixed: both recorded with the full §20.2
field set; `docs/resources/THIRD_PARTY_NOTICES.md`'s "Build and development tooling — not shipped"
table extended with both plus a precise correction note (`playwright-core`'s provenance was never
*unknown* - it has been documented in `docs/architecture/DEPENDENCY_BASELINE.md` since Phase 8; the
designated manifest simply disagreed with it by omission). No release artifact was ever wrong,
because shipped notices are mechanically derived from the shipped graph and neither package ships.
**Recurrence guard added**: `packages/cli/test/codeResourceManifest.test.ts` (6 tests) derives the
required set from every workspace `package.json` on disk - never a hand-list - and asserts the
manifest is complete, not stale, version-accurate, field-complete, license-acceptable per
`resource-policy.json`, and free of install-script/network/telemetry dependencies. The guard was
verified **load-bearing**: temporarily removing the `playwright-core` record made it fail with
`undocumented direct dependencies ... expected [ 'playwright-core' ] to deeply equal []`, and it
passed again once restored.

**2. Stale source path in a current-state document** (A19).
`OPERATIONAL_STATE.md`'s "Current phase" section named `packages/cli/src/release/checksums.ts` and
`packages/cli/src/release/notices.ts`. Those files do not exist - Phase 11 renamed that directory to
`releasePackaging/` in the same commit (to escape the `.gitignore` `release/` pattern that had been
silently swallowing it). Fixed to the real paths. The same stale path inside Revision 13's history
entry was deliberately **left unchanged** as protected historical revision text.

**3. A mandatory acceptance command with no documented invocation** (A20 / A09).
The generated-runtime matrix - the evidence that all 74 presets really generate, install and enter
play - had no `npm run` alias and was referred to only by file path in every document. A cold-start
agent could not discover how to run it, and the natural `npx tsx` guess fails because `tsx` is not a
dependency of this repository. Fixed: added `"qa:matrix": "node tools/scripts/generated-runtime-matrix.ts"`
to `package.json` (matching how every other TypeScript tool here is invoked), and documented it in
`README.md`'s QA block, `docs/qa/QA_MATRIX.md` (command column and the `validate` scope note), and
`docs/handoff/COLD_START_HANDOFF.md` §4 and §7.

**Regression evidence after the repair** - the full ladder was re-run on the final tree, not only
the affected checks: `npm run validate` PASS, `npm test` **1787/1787**, `npm run qa:smoke`
**14/14**, `npm run qa:proof` **5/5**, `npm run qa:responsive` **19/19**, `npm run release:verify`
**6/6**, `npm run qa:matrix` **40/40**. The only intended change to a headline number is the unit
test count, +6 from the new provenance guard.

---

## Final release/licensing truth

**Technically release-ready: YES.** `sw2d pack` produces a self-contained static artifact with a
deterministic `RELEASE_MANIFEST.json`, a SHA-256 `SHA256SUMS` verified by the standard system tool
and proven to detect tampering, a mechanically-derived `THIRD_PARTY_NOTICES.txt`, a pack-time
resource-governance gate, zero external runtime requests, and no source or `node_modules` leakage -
proven for six controller-shell families plus one independently generated cold-start candidate.

**Cleared for public distribution: NO.** The project's software license is `UNLICENSED`. That is an
explicit, unresolved decision belonging to the project owner. This phase did not choose one, did not
guess, and does not claim any public-redistribution authorization.

**These are different questions, and both answers are final for this phase.** A technically complete
factory may still have unresolved public-distribution licensing; MASTER_PROJECT §54 contains no
licensing criterion, so the open license does not block acceptance of the technical contract - it
blocks distribution, which no phase was ever scoped to perform. No tag, GitHub Release, deployment,
or package publication was created.

---

## Project stopping decision

**Stop.**

The initial MASTER_PROJECT contract is satisfied and evidenced. Per §54 ("Stop when these criteria
are actually satisfied and evidenced") and §47's anti-overengineering rules, this plan ends here.

- Pending work under MASTER_PROJECT: **None.**
- Next bounded action: **None** - the initial master contract is complete.
- **No Phase 13 exists.** Future work - a device lab, gamepad support, real performance
  measurement, spatial pointer, deeper genre mechanics for any of the 62 `recipe` presets, or a
  licensing and distribution decision - requires a separately scoped task or project, with its own
  acceptance contract.

Preserved unchanged by this phase: the 5 `proof-validated` / 7 `smoke-validated` / 62 `recipe` /
0 `experimental` maturity split, the technical release state, `UNLICENSED`, unmeasured performance,
the physical-device-touch and gamepad unknowns, and every deferred optional capability with its
recorded trigger.
