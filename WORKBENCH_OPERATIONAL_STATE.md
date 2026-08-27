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
| Current shipped rich kits on active branch | **5 proof-derived + 39 promoted expansion kits = 44 rich kits total** |
| Expansion scaffolds | **69 / 69 present; 39 / 69 promoted; 30 remain unpromoted** |
| Current milestone | **P3-C closed on promoted replay; P3-D vehicle candidate gate active and unpromoted** |

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

That expansion implementation is now active on branch `starter-kits/implement-all`. As of promoted commit
`ab6911e5dac85ffec3f39736654db7b0bb23adb1`, **39 / 69 expansion starters are registered**. The original
five proof-derived kits remain unchanged, so the branch exposes 44 rich kits total. P3-C added
`action-roguelite`, `boss-rush`, `heist-game`, and `survivor-like` only after candidate run #56 passed,
and promotion replay #57 then passed again on the registered state.

Verified expansion evidence at the current P3-C boundary:

- candidate head `e65379e6ef975939a9ff4f2288a2da05d2ef90a0` — GitHub Actions run #56
  (`33040074568`) **SUCCESS**;
- promoted head `ab6911e5dac85ffec3f39736654db7b0bb23adb1` — GitHub Actions run #57
  (`33043970847`) **SUCCESS**;
- both gates included repository baseline `npm run validate` plus generated-game browser lanes for Core,
  P2-B, P2-C, P3-A, P3-B and P3-C;
- P3-C promotion itself changed only `workbench/server/starterKits/expanded/index.ts` and added the four
  registered top-down starters; preset maturity was not changed.

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

## Starter-kit expansion control plane — merged to `main`, implementation active on branch

The repository is deliberately scaffolded so expanded genre starters can be implemented without first
reverse-engineering the catalogue, changing the engine, or lying about maturity.

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
- On active branch `starter-kits/implement-all`, **39 / 69 expansion starters have now passed their
  promotion gates and are registered; 30 remain unpromoted**.
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

Read these before implementation:

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

`starter-kits:status` is the implementation queue. `starter-kits:bootstrap` creates the exact target
source file prefilled with the scaffold's loop, roles, required pack ids, reference kit, maturity lock,
mechanic proofs and architecture notes; it refuses to overwrite an existing implementation. The file
is deliberately not auto-registered.

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
| SK1+ | implement and prove the 69 expanded starter kits | **ACTIVE: 39 / 69 PROMOTED ON `starter-kits/implement-all`; P3-C CLOSED; P3-D ACTIVE/UNPROMOTED** |

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

The original acceptance recorded all as NO. Later changes do not receive a fresh NO merely from source
presence. Items materially touched by the repair/scaffold work remain evidence-stale until the matching
acceptance path is rerun.

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
| F18 | inherited regression suites removed, weakened or failing | **STARTER EXPANSION MATRIX GREEN THROUGH P3-C; FULL INHERITED LADDER STILL REVALIDATION REQUIRED** |
| F19 | normal Validate / Build / Pack still requires the terminal | **NO (historical accepted evidence)** |
| F20 | completion claimed without a real browser proof | **NO FOR PROMOTED EXPANSION BATCHES THROUGH P3-C; REMAINING KITS MAY NOT BE PROMOTED WITHOUT PROOF** |

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
- P3-C candidate gate #56 passed baseline + Core/P2-B/P2-C/P3-A/P3-B/P3-C.
- P3-C promoted replay #57 passed the same complete matrix on registry commit `ab6911e5`.
- The Lane Defense timing defect discovered during P3-C was repaired in game-side strategy code by replacing
  a frame-sensitive modulo hit window with a deterministic 650 ms defender cooldown; #56/#57 prove the
  inherited P2-C journey remains green after that repair.
- P3-C strengthened proofs include Action Roguelite reset, Boss phase-two speed change, Heist hazard/alarm,
  Survivor's 15-second no-upgrade hold plus explicit upgrade collection, and visible particle feedback.

## Implemented but not fully workbench-verified after the accepted commit

- **M7R1 repair merged at `bf8e4de4`.** Source/static inspection complete; dedicated full workbench browser/
  regression ladder still pending even though repository `npm run validate` is now repeatedly green in CI.
- **Starter-kit expansion infrastructure merged at `d919cf1f`.** Its control plane and many generated-game
  paths are now runtime exercised by the active expansion CI, but this does not equal a full workbench UI pass.
- **`rich-starter-kit` depth.** Implemented and populated by 39 expansion registrations on the active branch;
  preset-browser/Game-Seed presentation still needs the dedicated workbench UI revalidation.
- **69 per-preset scaffold records.** Complete as control-plane data; 39 have promoted playable kits and 30
  remain unpromoted.
- **`starter-kits:status` and `starter-kits:bootstrap`.** Source-complete; direct interactive use is not the
  evidence source for the current generated-game promotion pipeline.
- **Real-device touch.** Still unverified; responsive historical evidence is Chromium viewport emulation.
- **Wall-clock performance.** No benchmark claim.
- **Optional `AssetGenerationProvider`.** Interface only; no provider ships.

## Deliberately not implemented / not yet complete

- **The remaining 30 unpromoted expansion starters.** Scaffolding exists, but each stays out of the registry
  until its loop, semantic roles, generated-game proof, inherited replay and promoted replay all pass.
- **Sprite-sheet animation playback.** Frame groups are detected/recorded; one representative frame is used.
- **Host-side JPEG/WebP decoding.** Browser handles derivation for those formats.
- **A universal weapon, bullet-hell, procedural-generation, grappling, pathfinding, RTS, vehicle-physics,
  dialogue, creature-AI or advanced-physics engine.** Starter implementations continue to prefer bounded
  game-side code over pretending those reusable subsystems already exist.

## Known validation debt / execution boundary

The available ChatGPT execution container still cannot clone/run the repository directly because its
network path cannot resolve `github.com`. GitHub connector reads/writes and GitHub Actions now provide a
real execution path for the starter-expansion baseline and generated-game browser matrix. That evidence is
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

Activate **P3-D vehicle movement** as a QA-only batch containing:

- `kart-racer`
- `endless-driving`
- `boat-flight-racer`

The activation may add its browser runner, package script, CI matrix lane, and this operational-state
update. It must **not** register the three kits or change preset maturity. First measure the existing
vehicle builder. Then repair only evidence-backed mechanic/semantic-role gaps, with particular attention
to visible `particle` feedback for the kart/boat roles and altitude-dependent hazard traversal for Boat.

A P3-D kit may be promoted only after the complete candidate matrix is green. After registry promotion,
the complete matrix must pass again on the promoted state before P3-D is closed.