# Workbench operational state

**Authority for the Asset-Driven Game Factory Workbench.** The original 12-phase master project
remains complete and accepted; `OPERATIONAL_STATE.md` stays the authority for the engine/toolchain
baseline. This file governs the visual workbench and the starter-kit expansion built on top of it.

| | |
|---|---|
| Existing SW2D core | verified completed baseline `f36350bee47d3e85e58be1672854895aab53e51d` |
| Corrective project | Asset-Driven Game Factory Workbench |
| Original accepted workbench commit | `1ebc9a56fbe37527d48b65238fecbd54b0f63951` |
| Post-acceptance repair merged to `main` | `bf8e4de4e6e0f2ee5adf6e8aebc5912f544530b2` |
| Starter-kit scaffold system merged to `main` | `d919cf1f71b2023c9839b517198dfd3626341f27` |
| Active expansion branch | `starter-kits/implement-all` |
| Current shipped rich kits on active branch | **5 proof-derived + 69 promoted expansion kits = 74 rich kits total** |
| Expansion scaffolds | **69 / 69 present; 69 / 69 promoted; 0 remain unpromoted** |
| Current milestone | **Free-Sprite Intelligence — game-first factory + verified free raster asset sourcing** |

---

## Free-Sprite Intelligence milestone

**Goal.** Make the workbench game-first (an image is optional) and add intelligent, legally
safe, offline-preserving free raster-asset sourcing: preset-aware pack recommendations,
rights verification, audition, coherent reskin, a verified local vault, provenance receipts
and reverse discovery.

| Field | Value |
|---|---|
| Milestone name | Free-Sprite Intelligence |
| BASE SHA | `d222b1eafc8fb972cd300d07f1107f3842349308` |
| Working branch | `feature/free-sprite-intelligence` |
| Phase A — game-first factory | IMPLEMENTED — home reframed game-first, `Make a Game` primary, `Find Free Sprites` route added, `createDialog` gains `gameplay` mode; `workbench/test/seedsGameFirst.test.ts` locks zero-art path. typecheck PASS, `workbench:build` PASS, `vitest run workbench/test` 143/143 PASS |
| Phase B — verified free-sprite source foundation | IMPLEMENTED — `workbench/server/sources/*` (narrow allowlisted net, rights vs `resource-policy.json`, curated Kenney CC0 catalogue of 5 packs, acquire→canonical staged import); API `GET /sources/providers`, `GET /sources/catalog`, `POST /sources/acquire`; client `findFreeSprites` browses catalogue with exact rights + acquires into an open project; `stagePack` skips SVG. `workbench/test/sources.test.ts` 22 tests (offline). typecheck PASS, `workbench:build` PASS, `vitest run workbench/test` 165/165 |
| Phase C — game-aware sprite requirement engine | IMPLEMENTED — `sources/requirements.ts` derives a `SpriteRequirementProfile` from controller family + starter-kit useful roles (controller-family fallback when no kit); `sources/matching.ts` deterministic `rankPacks` with hard gates (rights/raster) + traceable score + "why this fits" + per-role coverage states; API `GET /sources/recommend?gameId=|presetId=`; client shows ranked matches with requirement summary + role-coverage grid, catalogue behind a toggle. `workbench/test/spriteRequirements.test.ts` 12 tests across platformer/top-down/grid/ui-sim. typecheck PASS, build PASS, `vitest run workbench/test` 177/177 |
| Phase D — asset audition + coherent reskin | PENDING |
| Phase E — intelligent sprite presentation | PENDING |
| Phase F — verified local asset vault + provenance receipt | PENDING |
| Phase G — reverse discovery + polish | PENDING |
| Latest completed phase commit | `pending` |
| Validation state | baseline: `npm run typecheck` PASS, `npx vitest run workbench/test` 139/139 PASS at BASE |
| Live-provider proof state | DOWNLOAD STAGE PROVEN — Kenney "Tiny Dungeon" fetched through the narrow net path: 98530 bytes, `application/zip`, sha256 `c109438ab06f65fd80f9b2686a4cf9c7c11dc64444b47333ec71d602f8bb5fc7`, 136 PNG / 0 SVG entries, readZip clean. Full stage→render→pack→offline proof deferred to post-Phase-G LIVE SOURCE PROOF |
| Final bug-sweep state | PENDING |
| Known genuine blockers | none |
| Next bounded action | Phase D: asset audition surface + coherent reskin preview |

Architectural laws in force: gameplay never requires art; one canonical factory; normal game
format; semantic roles are the contract; static fallback survives animation; source art is
non-destructive; rights are data; **no runtime internet**; no generic fetch pipe; no arbitrary
local path access; free ≠ licensed; **SVG is never a sprite source**.

---

## Current truth

The workbench product exists and the corrective product-shape failure is resolved: `npm run dev`
opens the visual Asset-Driven Game Factory Workbench rather than the old Phase 1 foundation slice.
The original workbench was accepted at `1ebc9a56` after an agent-reported full validation run.

A later independent audit found three acceptance-evidence/product gaps. Those repairs were implemented
and, at the user's explicit direction, merged to `main` as `bf8e4de4`. At that merge point this ChatGPT
execution container could not resolve `github.com`, and there was no repository CI gate that could replace
the project-Mac + system-Chrome revalidation required for the full workbench acceptance surface.

The same explicit user direction authorized the starter-kit expansion scaffolding to be committed,
pushed and merged to `main`. That scaffolding was statically inspected and merged as `d919cf1f`.
It was **scaffolding, not 69 finished starter kits**. Expanded kits enter the shipped registry only after
implementation, canonical generated-game validation, real-browser mechanic proof, package-lock hygiene,
inherited starter-batch replay, and a second full replay after registration.

That expansion implementation is active on branch `starter-kits/implement-all`. As of promoted commit
`7bd3eff759da91ab4053773aee11de9cd38fe26c`, **69 / 69 expansion starters are registered**. The original
five proof-derived kits remain unchanged, so the branch exposes 74 rich kits total.

### Latest verified expansion boundary — P3-E Puzzle Arcade

P3-E promoted:

- `match-puzzle`
- `falling-block-puzzle`
- `pong`

The P3-E sequence deliberately preserved failed evidence rather than smoothing it away:

1. Activation head `9c65d902dd7add3019028a60aaa21d5c41d3ea07` measured the existing implementations. GitHub Actions
   run #62 (`33045615045`) was **SUCCESS** across repository baseline plus Core/P2-B/P2-C/P3-A/P3-B/P3-C/
   P3-D/P3-E browser lanes. P3-E itself passed 3/3 mechanic journeys with `package-lock.json` unchanged.
2. Presentation/role head `d5533c0ff95f7cd51c135079c6a1c82e3b7de218` tightened P3-E to require the scaffold-declared semantic
   `ui.cursor` / `ui.panel` roles and to hide irrelevant generic arcade objects. Run #63 (`33046035424`)
   **FAILED P3-E as intended**: generated default themes did not actually contain those UI roles, so the
   game-side builder fell back to `checkpoint` / `platform`. The underlying Match/Falling/Pong mechanics,
   board-role rendering and visibility cleanup still worked in the failure trace.
3. Semantic-role repair head `6992a4c4d878b43976c826dd4e35e603effbed93` added only bounded starter-overlay theme roles. It uses the
   canonical generated default theme and appends the supported `ui.panel` and, for Match, `ui.cursor`
   placeholders only for these three P3-E starters. It did **not** widen the shared runtime, canonical
   generator, preset maturity, registry, or already-promoted Puzzle Arcade variants. Run #64
   (`33055897177`) was **SUCCESS** across baseline and every browser lane; P3-E passed 3/3 with strict
   semantic-role proof and lockfile hygiene.
4. Promotion commit `49822f8db04fd74b46aa71895cf3ec953394623f` changed only
   `workbench/server/starterKits/expanded/index.ts`, registering the three P3-E starters. Promoted-state
   replay run #65 (`33056172278`) was **SUCCESS** across baseline, Core, P2-B, P2-C, P3-A, P3-B, P3-C,
   P3-D and P3-E.

P3-E proof covers:

- Match Puzzle visible cursor/select state, adjacent swap, real row match, board revision/clear count,
  pickup-role board sprites, scaffold-declared `ui.cursor` + `ui.panel` participation and explicit completion;
- Falling Block deterministic falling ticks, player movement/rotation affecting placement, platform-role
  occupied cells, scaffold-declared `ui.panel`, real line clear, score change and completion;
- Pong player paddle movement, a real player return/bounce, real score boundaries, opponent score-3 terminal
  condition, scaffold-declared `ui.panel`, and removal of unrelated avatar/cursor decoration;
- no console errors, no external network requests, and `package-lock.json` unchanged during candidate
  generation/validation.

### Final verified expansion boundary — P3-K Narrative Exploration

The remaining expansion batches are complete on `starter-kits/implement-all`. Every candidate and
promoted replay below passed the expansion workflow's repository baseline plus generated-game browser
lanes; the focused batch lanes also checked semantic role participation, console/external-request
hygiene, and unchanged `package-lock.json`.

| Batch | Candidate implementation | Candidate Actions | Promoted registry commit | Promoted Actions |
|---|---|---:|---|---:|
| P3-F Puzzle Arcade | `3bfe362` | `33060607003` | `8c75e35` | `33060860448` |
| P3-G Party Toy / Weird | `8fd8356` | `33067198196` | `66c74ae` | `33067506045` |
| P3-H remaining Party Toy / Weird | `880d965` | `33068678906` | included in P3-I replay | `33070483826` |
| P3-I Platforming | `0ca0cc7` | `33070226740` | `9a940d7` | `33070483826` |
| P3-J Simulation Management | `31bf473` plus registry correction `1ad2e0b` | `33071854018` | `389f7cf` | `33072135263` |
| P3-K Narrative Exploration | `aa8ac68` | `33072687610` | `7bd3eff` | `33073030298` |

P3-K proof covers linked escape-room locks, stateful interactive-fiction choices, clue collection and
deduction-gated investigation completion, and visible point-and-click cursor hotspots. The final promoted
state is **69 / 69 implemented and registered**, with no starter-kit bug sweep performed in this expansion
workflow.

### Previous verified expansion boundary — P3-D vehicle movement

P3-D promoted:

- `kart-racer`
- `endless-driving`
- `boat-flight-racer`

Final candidate head `570da353a469df2d711dc7cc69baee9687b13b1a` passed GitHub Actions run #60
(`33045032117`) **SUCCESS**. The promoted registry head `4e11af942b1d558d6dd7e3da43ae89ba9c04e0ca`
then passed GitHub Actions run #61 (`33045270123`) **SUCCESS**.

Both gates included repository baseline `npm run validate` plus generated-game browser lanes for Core,
P2-B, P2-C, P3-A, P3-B, P3-C and P3-D. Promotion itself changed only
`workbench/server/starterKits/expanded/index.ts`; preset maturity did not change.

P3-D proof covers:

- Kart ordered checkpoint progression, real pickup/temporary boost, finish gating, and visible role-first
  `particle` boost feedback;
- Endless Driving continuous distance growth, real hazard collision penalty, and continued run state;
- Boat ordered gates, low-altitude hazard collision, `SECONDARY_ACTION` (`KeyK`/`KeyC`) altitude change,
  high-altitude hazard clearance, finish gating, and visible role-first particle/wake feedback;
- no console errors, no external network requests, and `package-lock.json` unchanged during candidate
  generation/validation.

A scope-tightening pass before promotion also preserved the pre-existing sprite layering for already-
promoted `top-down-racer` and `time-trial-racer`: depth 2 is applied only to vehicle variants that actually
own the new particle marker.

### Previous verified expansion boundary — P3-C top-down action

P3-C candidate head `e65379e6ef975939a9ff4f2288a2da05d2ef90a0` passed run #56
(`33040074568`) and promoted head `ab6911e5dac85ffec3f39736654db7b0bb23adb1` passed run #57
(`33043970847`). P3-C added `action-roguelite`, `boss-rush`, `heist-game`, and `survivor-like` only after
candidate and promoted replay gates were green.

The starter-kit CI evidence does **not** retroactively close the separate full-workbench revalidation debt
for W08, W23, W25, W26, W27 or W28. The expansion workflow runs `npm run validate` and its generated-game
browser suites; it does not substitute for the complete workbench UI/security/responsive/release ladder.

---

## Post-acceptance repair — merged, full workbench revalidation still pending

The post-acceptance audit found three concrete gaps:

1. **Host-header boundary.** `assertAcceptableOrigin()` previously returned early for safe requests
   with no `Origin`, so a non-loopback `Host` was not checked on that path. The merged repair validates
   Host first for every request and adds hostile/missing Host regression cases for GET/HEAD.
2. **Workspace linking / lockfile / offline behavior.** Workbench project creation and pipeline actions
   previously linked `games/*` by running a root `npm install`, which could add scratch workspaces to
   `package-lock.json` and could consult the registry. The merged repair routes both CLI and workbench
   through the canonical workspace helper using `--offline --no-package-lock --no-audit --no-fund`.
3. **Undo QA escape.** `WB-DERIVE-001` contained an always-true assertion. The merged repair now checks
   the actual recipe cursor: Undo must create exactly one future history row and Redo must clear it.

**Merged repair commit:** `bf8e4de4e6e0f2ee5adf6e8aebc5912f544530b2`.

**Evidence state:** implementation and static inspection are complete, and later starter-expansion CI has
repeatedly exercised repository `npm run validate`. However the dedicated full workbench/browser ladder
listed below has still not been rerun as one acceptance gate. W08, W23, W25, W26, W27 and W28 therefore
remain `REVALIDATION REQUIRED` rather than being silently upgraded to fresh PASS.

Required full workbench repair revalidation:

```text
npm run validate
npm run qa:workbench
npm run qa:smoke
npm run qa:proof
npm run qa:responsive
npm run release:verify
npm run qa:matrix

plus: after creating a scratch game and using workbench Validate / Build / Pack,
confirm `git diff -- package-lock.json` is empty.
```

---

## Starter-kit expansion control plane

### Shipped vs scaffolded

- Existing shipped rich proof kits remain unchanged:
  - `chase-platformer`
  - `twin-stick-shooter`
  - `tower-defense`
  - `sokoban`
  - `idle-incremental`
- Every other preset has an explicit expansion scaffold: **69 / 69**.
- At scaffold merge time `workbench/server/starterKits/expanded/index.ts` intentionally registered **none**
  of those 69. An unfinished scaffold could not change user-visible behavior.
- On active branch `starter-kits/implement-all`, **69 / 69 expansion starters have passed their promotion
  gates and are registered; none remain unpromoted**.
- A completed non-proof starter uses depth **`rich-starter-kit`**. Its preset maturity remains whatever
  the catalogue says (`recipe`, `smoke-validated`, etc.). `rich-proof-kit` remains reserved for the
  proof-derived starters. Starter depth and evidence maturity are separate claims.

### Per-preset scaffold data

Every one of the 69 expansion presets has:

- preset id and display name;
- family and current maturity pulled from the live preset catalogue;
- controller families;
- exact required and optional `SystemPackSelection` records plus convenience pack-id lists;
- required content roles;
- current known limitations;
- a concrete playable loop;
- a closest existing rich-kit reference;
- semantic asset roles expected to matter;
- at least two explicit mechanic-proof obligations;
- implementation priority (P1 / P2 / P3);
- architecture notes where the genre is at risk of inventing an unsupported shared subsystem;
- exact target path `workbench/server/starterKits/expanded/<preset-id>.ts`.

Coverage is mechanically guarded: the scaffold test compares the live preset catalogue against the
five original rich-kit ids and fails if any expansion preset is missing or if an obsolete scaffold
remains. Static inventory performed during scaffold construction found **69 plans, 69 unique ids and
69 matching documentation rows**.

### Canonical architecture preserved

Starter expansion must continue to obey the repository's central rule:

```text
RUNTIME / SYSTEM CODE = reusable machine
CONTENT / THEME / GAME-SPECIFIC CODE = individual game
```

The expansion overlay helper writes only normal game-side surfaces. It mirrors the canonical generator
for `content/game.json`: required pack ids receive JSON `config: {}`, while any code-configured pack
continues to be owned by the canonical generated `src/game-specific/packConfig.ts`. The scaffold also
records the exact live preset pack selections for inspection; it does not create a second pack policy.

P3-E adds one bounded extension to that game-side pattern: a starter may overlay its generated default
theme with scaffold-declared semantic UI placeholders when the canonical default theme does not contain
those supported roles. This remains a starter/game-side overlay, uses the canonical theme generator as
its base, and is not authority to widen shared runtime or generator behavior for one genre.

Known missing reusable capabilities in a preset are **not** permission to add a new shared subsystem
for one starter. A bounded game-specific implementation is preferred; if a useful starter truly cannot
be built without a cross-cutting architecture decision, implementation must stop that kit and report the
blocking decision rather than silently widening scope.

### Promotion seam

`workbench/server/starterKits/expanded/index.ts` is the only expansion promotion registry. A starter
must not be exported there until it is complete and proven. Once registered:

- its depth is `rich-starter-kit` unless it is one of the original proof kits;
- preset maturity remains unchanged;
- the preset browser displays maturity and starter depth separately;
- the starter becomes eligible for image-first Game Seeds because a meaningful playable starter now
  exists behind the button;
- existing registry tests continue to require semantic-role art, deterministic overlay output and
  normal game-side containment.

The active branch adds a second operational requirement: **candidate green is not enough**. After a batch
is registered, the complete expansion CI matrix must pass again on the promoted registry state before the
batch is considered closed.

### Expansion implementation entry points

1. `docs/handoff/SONNET_STARTER_KIT_EXPANSION.md`
2. `docs/workbench/STARTER_KIT_EXPANSION.md`
3. `workbench/server/starterKits/scaffolds.ts`
4. `workbench/server/starterKits/authoring.ts`
5. `workbench/server/starterKits/expanded/TEMPLATE.ts`
6. `workbench/server/starterKits/expanded/index.ts`
7. the scaffold's named reference rich kit;
8. the target preset definition under `packages/presets/src/catalog/`;
9. `workbench/test/starterKits.test.ts` and `workbench/test/starterKitScaffolds.test.ts`.

Commands:

```text
npm run starter-kits:status
npm run starter-kits:bootstrap -- <preset-id>
```

Default batch size remains **3-5 kits**, staying within one family when practical. Each kit needs focused
coverage and real generated-game browser proof before promotion. The active CI matrix runs prior promoted
batches alongside the candidate batch so timing or shared-builder regressions are caught before registry
mutation.

---

## Milestone ledger

| Milestone | Deliverable | State |
|---|---|---|
| M0 | research, architecture, operational state, implementation map | COMPLETE |
| M1 | workbench workspace, local host, security baseline, home, recent projects, preset browser, root dev route, `starter:dev`, job shell | COMPLETE |
| M2 | asset model, source storage, stable ids, hashing, metadata, bulk + folder intake, analysis, palette, duplicates, provenance, import transaction, lazy thumbnails, memory limits | COMPLETE |
| M3 | Asset Lab: recipe stack, undo/redo, crop/trim, scale/flip/rotate, masking, components, slicing, variants, replay, reimport | COMPLETE |
| M4 | synthesis: role mapper, Game Seeds, 74-preset browser, recommendations, theme synthesis, fallback art, canonical game creation, five proof starter kits, imported-pixel proof | COMPLETE |
| M5 | Scene Composer + preview lifecycle | COMPLETE |
| M6 | reopen / adopt / remix / Validate / Build / Pack / provenance UX / reveal | COMPLETE |
| M7 | `qa:workbench`, responsive, security QA, full regression, docs, final acceptance | ACCEPTED AT `1ebc9a56`; SOME EVIDENCE STALE AFTER LATER AUDIT |
| M7R1 | host boundary + lockfile/offline linking + undo evidence repair | MERGED AT `bf8e4de4`; FULL WORKBENCH REVALIDATION REQUIRED |
| SK0 | 69-preset starter-kit expansion control plane, promotion seam, bootstrap/status tooling and Sonnet handoff | MERGED AT `d919cf1f`; CONTROL PLANE ACTIVE |
| SK1+ | implement and prove the 69 expanded starter kits | **COMPLETE: 69 / 69 PROMOTED; P3-K CLOSED** |

---

## Acceptance ledger W01-W28

Full original evidence lives in [`docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md`](docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md).
These rows preserve the accepted state at `1ebc9a56`; the later repair supersedes the evidence state
for W08, W23, W25, W26, W27 and W28 until the dedicated full-workbench ladder occurs.

| Id | Item | State |
|---|---|---|
| W01 | `npm run dev` launches the workbench | **PASS (historical accepted evidence)** |
| W02 | real project home with the four primary actions | **PASS (historical accepted evidence)** |
| W03 | Import Inbox: single / multiple / drag-drop / folder | **PASS (historical accepted evidence)** |
| W04 | stable asset identity across rename / path change / reimport | **PASS (historical accepted evidence)** |
| W05 | source preservation | **PASS (historical accepted evidence)** |
| W06 | deterministic, reproducible derivation recipes | **PASS (historical accepted evidence)** |
| W07 | Asset Lab crop / mask / component / slice / palette / variant | **PASS (historical accepted evidence)** |
| W08 | real non-destructive undo / redo | **REVALIDATION REQUIRED AFTER MERGED REPAIR** |
| W09 | bulk tolerance + duplicate detection | **PASS (historical accepted evidence)** |
| W10 | reimport regenerates derivatives without losing roles | **PASS (historical accepted evidence)** |
| W11 | role changes alter the actual game mapping | **PASS (historical accepted evidence)** |
| W12 | theme synthesis from imported palette/assets | **PASS (historical accepted evidence)** |
| W13 | all 74 presets browsable with honest maturity | **PASS (historical); starter depth/maturity separation added later, runtime UI revalidation required** |
| W14 | Game Seeds from one image, no false claims | **PASS (historical); rich-starter eligibility added later, runtime UI revalidation required** |
| W15 | creation goes through the canonical generator | **PASS (historical accepted evidence)** |
| W16 | real browser proof: imported pixels drive the rendered game | **PASS (historical accepted evidence)** |
| W17 | five rich proof starter kits | **PASS; original five unchanged** |
| W18 | Scene Composer edits a real level that validates | **PASS (historical accepted evidence)** |
| W19 | hidden / overlapping objects selectable | **PASS (historical accepted evidence)** |
| W20 | preview is the actual generated Phaser game | **PASS (historical accepted evidence)** |
| W21 | project state persists across reload / reopen | **PASS (historical accepted evidence)** |
| W22 | remix: replace an asset in an existing generated project | **PASS (historical accepted evidence)** |
| W23 | Validate / Build / Pack from UI buttons | **REVALIDATION REQUIRED AFTER MERGED REPAIR** |
| W24 | provenance gate remains authoritative | **PASS (historical accepted evidence)** |
| W25 | loopback-only host, narrow API | **REVALIDATION REQUIRED AFTER MERGED REPAIR** |
| W26 | offline normal workflow | **REVALIDATION REQUIRED AFTER MERGED REPAIR** |
| W27 | inherited SW2D regression ladder green | **REVALIDATION REQUIRED FOR THE FULL LADDER; `npm run validate` IS FRESH GREEN IN EXPANSION CI** |
| W28 | `npm run qa:workbench` passes | **REVALIDATION REQUIRED AFTER MERGED REPAIR/SCAFFOLD CHANGES** |

---

## Failure-condition ledger F01-F20

| Id | Failure condition | State |
|---|---|---|
| F01 | `npm run dev` still opens SW2D FOUNDATION | **NO (historical accepted evidence)** |
| F02 | workbench is a CLI launcher with no asset workflow | **NO (historical accepted evidence)** |
| F03 | import stores files but games still render placeholders | **NO (historical accepted evidence)** |
| F04 | one image cannot reach playable output | **NO (historical accepted evidence)** |
| F05 | source image destructively overwritten | **NO (historical accepted evidence)** |
| F06 | filenames / paths are fragile identity | **NO (historical accepted evidence)** |
| F07 | reimport breaks roles or derivative lineage | **NO (historical accepted evidence)** |
| F08 | creation bypasses the canonical generator | **NO; expansion QA creates candidates through canonical `createGame` and validates them** |
| F09 | preview is an editor mock | **NO (historical accepted evidence)** |
| F10 | user must edit JSON for normal level refinement | **NO (historical accepted evidence)** |
| F11 | a foreground object makes covered objects unselectable | **NO (historical accepted evidence)** |
| F12 | browser can execute arbitrary shell commands | **NO (historical; dedicated host repair still requires full workbench revalidation)** |
| F13 | workbench can read/write arbitrary machine paths | **NO (historical accepted evidence)** |
| F14 | provenance / release gate bypassable | **NO (historical accepted evidence)** |
| F15 | recipe-only presets presented as equally proven | **STATICALLY GUARDED; runtime UI revalidation required** |
| F16 | required workflow needs cloud / key / account / credits | **WORKBENCH REVALIDATION REQUIRED; EXPANSION GENERATED-GAME QA MAKES NO CLOUD REQUESTS** |
| F17 | large import has unbounded concurrency or all-in-memory behaviour | **NO (historical accepted evidence)** |
| F18 | inherited regression suites removed, weakened or failing | **STARTER EXPANSION MATRIX GREEN THROUGH P3-K; FULL INHERITED LADDER STILL REVALIDATION REQUIRED** |
| F19 | normal Validate / Build / Pack still requires the terminal | **NO (historical accepted evidence)** |
| F20 | completion claimed without a real browser proof | **NO FOR ALL 69 PROMOTED EXPANSION STARTERS; EACH BATCH HAS REAL-BROWSER PROOF** |

---

## Verified workbench behaviour at original accepted commit `1ebc9a56`

The following were reported as executed for the original accepted workbench commit. They remain
historical evidence and protected behavior; they are not fresh proof of later full-workbench repairs.

- `npm run dev` launches the workbench; `npm run starter:dev` serves the Phase 1 slice.
- One image → imported → mapped to `player` → chase-platformer generated through the canonical factory
  → production build → the running Phaser game drew a 96px texture carrying the fixture's sha256.
- The five proof-validated presets had rich starter kits verified in a real browser.
- Import staging, naming-tolerant frame grouping, content-hash duplicate detection, sprite-sheet slicing,
  connected-component split, recipe replay, source preservation and reimport lineage were exercised.
- Scene Composer edited native level data and covered/overlapping objects remained reachable.
- Validate / Build / Pack were exercised from UI buttons with the provenance gate intact.
- Loopback security, bounded batch concurrency and three responsive viewport classes were exercised.

## Verified starter-expansion behaviour on `starter-kits/implement-all`

- Expanded candidates are created through canonical `createGame`, validated through CLI, production-built,
  booted in system Chrome and exercised through mechanic-specific generated-game journeys.
- Candidate runs reject console errors/external requests and compare `package-lock.json` before/after.
- P3-C candidate #56 and promoted replay #57 passed full expansion matrices at their respective boundaries.
- The Lane Defense timing defect discovered during P3-C was repaired in game-side strategy code by replacing
  a frame-sensitive modulo hit window with a deterministic 650 ms defender cooldown.
- P3-D candidate #60 and promoted replay #61 passed full expansion matrices on the final scoped vehicle code.
- P3-D added role-first particle feedback only where declared/needed and preserved existing racer layering.
- P3-E initial mechanics run #62 passed; stricter run #63 exposed missing generated `ui.cursor` / `ui.panel`
  roles instead of allowing fallback textures to count as semantic proof.
- P3-E semantic-role repair candidate #64 and promoted replay #65 passed full expansion matrices. The repair
  remained game-side and starter-specific; the shared generator/runtime and preset maturity were unchanged.
- P3-F through P3-K completed the remaining Puzzle Arcade, Party Toy / Weird, Platforming, Simulation
  Management, and Narrative Exploration batches. Candidate and promoted replay runs were green through
  Actions `33073030298`; the final promoted registry head is `7bd3eff759da91ab4053773aee11de9cd38fe26c`.

## Implemented but not fully workbench-verified after the accepted commit

- **M7R1 repair merged at `bf8e4de4`.** Source/static inspection complete; dedicated full workbench browser/
  regression ladder still pending even though repository `npm run validate` is repeatedly green in CI.
- **Starter-kit expansion infrastructure merged at `d919cf1f`.** Its control plane and generated-game paths
  are now runtime exercised by the active expansion CI, but this does not equal a full workbench UI pass.
- **`rich-starter-kit` depth.** Implemented and populated by 69 expansion registrations on the active branch;
  preset-browser/Game-Seed presentation still needs the dedicated workbench UI revalidation.
- **69 per-preset scaffold records.** Complete as control-plane data; all 69 have promoted playable kits.
- **Real-device touch.** Still unverified; responsive historical evidence is Chromium viewport emulation.
- **Wall-clock performance.** No benchmark claim.
- **Optional `AssetGenerationProvider`.** Interface only; no provider ships.

## Deliberately not implemented / not yet complete

- **Unpromoted expansion starters.** None remain. All 69 expansion starters passed their bounded candidate
  and promoted replay gates and are registered.
- **Sprite-sheet animation playback.** Frame groups are detected/recorded; one representative frame is used.
- **Host-side JPEG/WebP decoding.** Browser handles derivation for those formats.
- **A universal weapon, bullet-hell, procedural-generation, grappling, pathfinding, RTS, vehicle-physics,
  dialogue, creature-AI or advanced-physics engine.** Starter implementations continue to prefer bounded
  game-side code over pretending those reusable subsystems already exist.

## Known validation debt / execution boundary

The available ChatGPT execution container still cannot clone/run the repository directly because its
network path cannot resolve `github.com`. GitHub connector reads/writes and GitHub Actions provide a real
execution path for the starter-expansion baseline and generated-game browser matrix. That evidence is
accepted for the bounded starter batches it actually exercises.

The expansion workflow does **not** run the complete workbench acceptance ladder (`qa:workbench`, smoke,
proof, responsive, release verification, generated-runtime matrix, UI Validate/Build/Pack hygiene as one
fresh gate). Those claims remain pending and must not be inferred from starter-kit CI success.

---

## Inherited regression baseline that must remain green

```text
npm run validate        PASS
npm run qa:smoke        14/14
npm run qa:proof        5/5
npm run qa:responsive   19/19
npm run release:verify  6/6
npm run qa:matrix       40/40
unit tests              1787/1787 at inherited core baseline
```

**Last reported executed workbench final state before the later repair/scaffold changes:**

```text
npm run validate        PASS
npm run test            1900/1900
npm run qa:smoke        14/14
npm run qa:proof        5/5
npm run qa:responsive   19/19
npm run release:verify  PASS, all controller-shell families
npm run qa:matrix       40/40
npm run qa:workbench    16/16
```

Those exact counts remain historical. Expansion CI has fresh `npm run validate` evidence on current branch
heads, but it is intentionally not represented as fresh proof of every command in the older full ladder.

---

## Next bounded action

The starter-kit expansion is complete at promoted P3-K commit `7bd3eff759da91ab4053773aee11de9cd38fe26c`.
The next explicit workflow boundary is the smart-model bug sweep; it was not performed as part of this
expansion. The separate full-workbench revalidation debt remains unchanged and must not be folded into
starter-batch success.
