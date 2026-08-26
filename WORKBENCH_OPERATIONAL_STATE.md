# Workbench operational state

**Authority for the corrective project only.** The original 12-phase master project remains
complete and accepted; `OPERATIONAL_STATE.md` stays the authority for the engine/toolchain
baseline. This file governs the Asset-Driven Game Factory Workbench built on top of it.

| | |
|---|---|
| Existing SW2D core | verified completed baseline `f36350bee47d3e85e58be1672854895aab53e51d` (`HEAD == origin/main`, clean tree at branch point) |
| Corrective project | Asset-Driven Game Factory Workbench |
| Primary product-shape failure | the visual, asset-driven workbench was missing: `npm run dev` opened the Phase 1 foundation slice, not a factory |
| Feature branch | `workbench/asset-driven-factory` (branched from `main`; `main` untouched until the full gate passes) |
| Current milestone | **M7 complete - accepted** |

---

## Milestone ledger

| Milestone | Deliverable | State |
|---|---|---|
| M0 | research, architecture, operational state, implementation map | COMPLETE |
| M1 | workbench workspace, local host, security baseline, home, recent projects, preset browser, root dev route, `starter:dev`, job shell | COMPLETE |
| M2 | asset model, source storage, stable ids, hashing, metadata, bulk + folder intake, analysis, palette, duplicates, provenance, import transaction, lazy thumbnails, memory limits | COMPLETE |
| M3 | Asset Lab: recipe stack, undo/redo, crop/trim, scale/flip/rotate, masking, components, slicing, variants, replay, reimport | COMPLETE |
| M4 | synthesis: role mapper, Game Seeds, 74-preset browser, recommendations, theme synthesis, fallback art, canonical game creation, five proof starter kits, **imported pixels proven in a running generated game** | COMPLETE |
| M5 | Scene Composer + preview lifecycle | COMPLETE |
| M6 | reopen / adopt / remix / Validate / Build / Pack / provenance UX / reveal | COMPLETE |
| M7 | `qa:workbench`, responsive, security QA, full regression, docs, final acceptance | COMPLETE |

---

## Acceptance ledger W01-W28

Full evidence lives in [`docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md`](docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md).
Summary state only here.

| Id | Item | State |
|---|---|---|
| W01 | `npm run dev` launches the workbench | **PASS** |
| W02 | real project home with the four primary actions | **PASS** |
| W03 | Import Inbox: single / multiple / drag-drop / folder | **PASS** |
| W04 | stable asset identity across rename / path change / reimport | **PASS** |
| W05 | source preservation | **PASS** |
| W06 | deterministic, reproducible derivation recipes | **PASS** |
| W07 | Asset Lab crop / mask / component / slice / palette / variant | **PASS** |
| W08 | real non-destructive undo / redo | **PASS** |
| W09 | bulk tolerance + duplicate detection | **PASS** |
| W10 | reimport regenerates derivatives without losing roles | **PASS** |
| W11 | role changes alter the actual game mapping | **PASS** |
| W12 | theme synthesis from imported palette/assets | **PASS** |
| W13 | all 74 presets browsable with honest maturity | **PASS** |
| W14 | Game Seeds from one image, no false claims | **PASS** |
| W15 | creation goes through the canonical generator | **PASS** |
| W16 | **real browser proof: imported pixels drive the rendered game** | **PASS** |
| W17 | five rich proof starter kits | **PASS** |
| W18 | Scene Composer edits a real level that validates | **PASS** |
| W19 | hidden / overlapping objects selectable | **PASS** |
| W20 | preview is the actual generated Phaser game | **PASS** |
| W21 | project state persists across reload / reopen | **PASS** |
| W22 | remix: replace an asset in an existing generated project | **PASS** |
| W23 | Validate / Build / Pack from UI buttons | **PASS** |
| W24 | provenance gate remains authoritative | **PASS** |
| W25 | loopback-only host, narrow API | **PASS** |
| W26 | offline normal workflow | **PASS** |
| W27 | inherited SW2D regression ladder green | **PASS** |
| W28 | `npm run qa:workbench` passes | **PASS** |

---

## Failure-condition ledger F01-F20

All must be `NO` before merge.

| Id | Failure condition | State |
|---|---|---|
| F01 | `npm run dev` still opens SW2D FOUNDATION | **NO** |
| F02 | workbench is a CLI launcher with no asset workflow | **NO** |
| F03 | import stores files but games still render placeholders | **NO** |
| F04 | one image cannot reach playable output | **NO** |
| F05 | source image destructively overwritten | **NO** |
| F06 | filenames / paths are fragile identity | **NO** |
| F07 | reimport breaks roles or derivative lineage | **NO** |
| F08 | creation bypasses the canonical generator | **NO** |
| F09 | preview is an editor mock | **NO** |
| F10 | user must edit JSON for normal level refinement | **NO** |
| F11 | a foreground object makes covered objects unselectable | **NO** |
| F12 | browser can execute arbitrary shell commands | **NO** |
| F13 | workbench can read/write arbitrary machine paths | **NO** |
| F14 | provenance / release gate bypassable | **NO** |
| F15 | recipe-only presets presented as equally proven | **NO** |
| F16 | required workflow needs cloud / key / account / credits | **NO** |
| F17 | large import has unbounded concurrency or all-in-memory behaviour | **NO** |
| F18 | inherited regression suites removed, weakened or failing | **NO** |
| F19 | normal Validate / Build / Pack still requires the terminal | **NO** |
| F20 | completion claimed without a real browser proof | **NO** |

---

## Verified workbench behaviour

Everything below was executed, not inferred. Full evidence per item is in
[`docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md`](docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md).

- `npm run dev` launches the workbench; `npm run starter:dev` still serves the
  Phase 1 slice.
- One image → imported → mapped to `player` → chase-platformer generated
  through the canonical factory → production build → **the running Phaser game
  draws a 96px texture whose key carries the fixture's own sha256**. The
  fixture, the asset record, the shipped file and the untouched source all hash
  identically.
- All five proof-validated presets have rich starter kits, each verified in a
  real browser to boot, install every declared pack, and respond to input, with
  zero console errors and zero external requests.
- Import staging, tolerant frame grouping across three naming conventions,
  content-hash duplicate detection against the whole project, sprite-sheet
  slicing, connected-component split, non-destructive derivation with recipe
  replay, and reimport preserving id / role / lineage while replacing the bytes
  the game loads.
- Scene Composer editing a real level that validates through the real pipeline,
  with covered objects reachable by list, by overlap-cycling and by hide/lock.
- Validate / Build / Pack from buttons, producing a real release candidate;
  unknown provenance blocks Pack and resolving it unblocks Pack.
- Loopback-only host with 42 narrow endpoints, none command- or path-shaped.
- A 60-file import with a measured peak of 3 concurrent uploads against a cap
  of 3.
- Three viewports with no horizontal overflow and all primary controls
  reachable.

## Implemented but unverified

- **Real-device touch.** The responsive journey uses Chromium viewport
  emulation, as the inherited suites do. No claim is made about a physical
  device.
- **Wall-clock performance.** The concurrency evidence is a measured cap, not a
  benchmark. All game QA uses deterministic frame stepping, so no FPS or timing
  claim is made anywhere.
- **The optional `AssetGenerationProvider` interface.** The shape exists and the
  project model accommodates it; no provider ships and none has been exercised.

## Deliberately not implemented

- **Sprite-sheet animation playback.** Frame groups are detected and recorded;
  the runtime draws one representative frame per role, with procedural motion
  supplying the life. Building a universal animation system would have
  destabilised the core for a benefit the asset-to-game workflow does not need.
- **Host-side JPEG/WebP decoding.** Their bytes are stored verbatim and
  derivation happens in the browser, which already has decoders. Adding an
  image-codec dependency was judged the worse trade.
- **Rich starter kits for the other 69 presets.** They get the canonical
  generated shell, and every surface says so.

## Known blockers

None.

---

## Inherited regression baseline (must stay green)

```
npm run validate        PASS
npm run qa:smoke        14/14
npm run qa:proof        5/5
npm run qa:responsive   19/19
npm run release:verify  6/6
npm run qa:matrix       40/40
unit tests              1787/1787 at the inherited baseline
```

New workbench tests raise the unit-test count. No existing test was deleted or weakened.

**Executed final state:**

```
npm run validate        PASS
npm run test            1900/1900   (1787 inherited + 113 workbench)
npm run qa:smoke        14/14
npm run qa:proof        5/5
npm run qa:responsive   19/19
npm run release:verify  PASS, all controller-shell families
npm run qa:matrix       40/40
npm run qa:workbench    16/16
```
