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
| Current milestone | **M0 - research + architecture + control plane** |

---

## Milestone ledger

| Milestone | Deliverable | State |
|---|---|---|
| M0 | research, architecture, operational state, implementation map | IN PROGRESS |
| M1 | workbench workspace, local host, security baseline, home, recent projects, preset browser, root dev route, `starter:dev`, job shell | NOT STARTED |
| M2 | asset model, source storage, stable ids, hashing, metadata, bulk + folder intake, analysis, palette, duplicates, provenance, import transaction, lazy thumbnails, memory limits | NOT STARTED |
| M3 | Asset Lab: recipe stack, undo/redo, crop/trim, scale/flip/rotate, masking, components, slicing, variants, replay, reimport | NOT STARTED |
| M4 | synthesis: role mapper, Game Seeds, 74-preset browser, recommendations, theme synthesis, fallback art, canonical game creation, five proof starter kits, **imported pixels proven in a running generated game** | NOT STARTED |
| M5 | Scene Composer + preview lifecycle | NOT STARTED |
| M6 | reopen / adopt / remix / Validate / Build / Pack / provenance UX / reveal | NOT STARTED |
| M7 | `qa:workbench`, responsive, security QA, full regression, docs, final acceptance | NOT STARTED |

---

## Acceptance ledger W01-W28

Full evidence lives in [`docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md`](docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md).
Summary state only here.

| Id | Item | State |
|---|---|---|
| W01 | `npm run dev` launches the workbench | UNVERIFIED |
| W02 | real project home with the four primary actions | UNVERIFIED |
| W03 | Import Inbox: single / multiple / drag-drop / folder | UNVERIFIED |
| W04 | stable asset identity across rename / path change / reimport | UNVERIFIED |
| W05 | source preservation | UNVERIFIED |
| W06 | deterministic, reproducible derivation recipes | UNVERIFIED |
| W07 | Asset Lab crop / mask / component / slice / palette / variant | UNVERIFIED |
| W08 | real non-destructive undo / redo | UNVERIFIED |
| W09 | bulk tolerance + duplicate detection | UNVERIFIED |
| W10 | reimport regenerates derivatives without losing roles | UNVERIFIED |
| W11 | role changes alter the actual game mapping | UNVERIFIED |
| W12 | theme synthesis from imported palette/assets | UNVERIFIED |
| W13 | all 74 presets browsable with honest maturity | UNVERIFIED |
| W14 | Game Seeds from one image, no false claims | UNVERIFIED |
| W15 | creation goes through the canonical generator | UNVERIFIED |
| W16 | **real browser proof: imported pixels drive the rendered game** | UNVERIFIED |
| W17 | five rich proof starter kits | UNVERIFIED |
| W18 | Scene Composer edits a real level that validates | UNVERIFIED |
| W19 | hidden / overlapping objects selectable | UNVERIFIED |
| W20 | preview is the actual generated Phaser game | UNVERIFIED |
| W21 | project state persists across reload / reopen | UNVERIFIED |
| W22 | remix: replace an asset in an existing generated project | UNVERIFIED |
| W23 | Validate / Build / Pack from UI buttons | UNVERIFIED |
| W24 | provenance gate remains authoritative | UNVERIFIED |
| W25 | loopback-only host, narrow API | UNVERIFIED |
| W26 | offline normal workflow | UNVERIFIED |
| W27 | inherited SW2D regression ladder green | UNVERIFIED |
| W28 | `npm run qa:workbench` passes | UNVERIFIED |

---

## Failure-condition ledger F01-F20

All must be `NO` before merge.

| Id | Failure condition | State |
|---|---|---|
| F01 | `npm run dev` still opens SW2D FOUNDATION | UNVERIFIED |
| F02 | workbench is a CLI launcher with no asset workflow | UNVERIFIED |
| F03 | import stores files but games still render placeholders | UNVERIFIED |
| F04 | one image cannot reach playable output | UNVERIFIED |
| F05 | source image destructively overwritten | UNVERIFIED |
| F06 | filenames / paths are fragile identity | UNVERIFIED |
| F07 | reimport breaks roles or derivative lineage | UNVERIFIED |
| F08 | creation bypasses the canonical generator | UNVERIFIED |
| F09 | preview is an editor mock | UNVERIFIED |
| F10 | user must edit JSON for normal level refinement | UNVERIFIED |
| F11 | a foreground object makes covered objects unselectable | UNVERIFIED |
| F12 | browser can execute arbitrary shell commands | UNVERIFIED |
| F13 | workbench can read/write arbitrary machine paths | UNVERIFIED |
| F14 | provenance / release gate bypassable | UNVERIFIED |
| F15 | recipe-only presets presented as equally proven | UNVERIFIED |
| F16 | required workflow needs cloud / key / account / credits | UNVERIFIED |
| F17 | large import has unbounded concurrency or all-in-memory behaviour | UNVERIFIED |
| F18 | inherited regression suites removed, weakened or failing | UNVERIFIED |
| F19 | normal Validate / Build / Pack still requires the terminal | UNVERIFIED |
| F20 | completion claimed without a real browser proof | UNVERIFIED |

---

## Verified workbench behaviour

Nothing yet. M0 is documentation and control plane only.

## Unverified behaviour

Everything in the milestone ledger from M1 onward.

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

New workbench tests raise the unit-test count. No existing test may be deleted or weakened.
