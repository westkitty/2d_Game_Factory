# Sonnet 5 Starter-Kit Expansion Handoff

You are continuing `westkitty/2d_Game_Factory` after the Asset-Driven Game Factory Workbench. Your job is to implement rich **starter kits**, not to redesign the engine.

## Read first

1. `WORKBENCH_OPERATIONAL_STATE.md`
2. `docs/workbench/STARTER_KIT_EXPANSION.md`
3. `workbench/server/starterKits/scaffolds.ts`
4. `workbench/server/starterKits/authoring.ts`
5. `workbench/server/starterKits/expanded/TEMPLATE.ts` and `expanded/index.ts`
6. `workbench/server/starterKits/index.ts`
7. The closest existing rich kit named by the scaffold's `referenceKit`
8. The target preset definition under `packages/presets/src/catalog/`
9. `workbench/test/starterKits.test.ts` and `starterKitScaffolds.test.ts`

## Objective

Implement the remaining scaffolded starter kits in bounded batches until the 69-item queue is exhausted. Each completed non-proof preset must register as `rich-starter-kit`; do not change its preset maturity.

## Hard boundaries

- Preserve the shared runtime, controllers, packs, preset definitions, current five rich proof kits, demos, and proofs unless a test exposes a true cross-cutting defect. A missing genre capability named in `knownLimitations` is **not** permission to rewrite the engine.
- Normal kit work may write only game-side surfaces through the overlay contract.
- Do not create a second generator, asset runtime, editor format, or preview.
- Do not hard-code imported filenames. Resolve presentation through semantic roles.
- Do not register a stub or partial kit. `expanded/index.ts` is the promotion gate.
- Do not upgrade `recipe` or `smoke-validated` maturity merely because its starter kit becomes good.
- No Docker, paid service, account, cloud dependency, telemetry, force-push, history rewrite, deployment, release, or license change.

## Per-kit procedure

1. Choose the next scaffold from `npm run starter-kits:status` (priority 1 first, then 2, then 3; stay within one family when practical).
2. Run `npm run starter-kits:bootstrap -- <preset-id>`. It creates the scaffold's exact `implementationPath`, prefilled with its loop, roles, required packs, architecture notes, and mechanic-proof TODOs. It refuses to overwrite an existing implementation.
3. Implement the scaffold's `loop`, `usefulRoles`, `mechanicProofs`, and `implementationNotes`. Use the preset's live controllers, required packs, content roles, and known limitations from `allStarterKitScaffolds()`.
4. Keep specialized behavior in `src/game-specific/**` output. Use `authoring.ts` for the normal manifest/level/tuning/presentation overlay shape.
5. Add focused unit tests. Then add/extend real-browser QA so the mechanic proofs are observed in the generated running Phaser game. Do not substitute source-string assertions for behavior.
6. Only after focused validation passes, export the kit from `expanded/index.ts`.
7. Confirm the preset browser still shows its original maturity and now shows `Rich starter kit` depth.
8. Run `npm run workbench:test` and the affected browser journey. At the end of each 3-5 kit batch run `npm run validate` and `npm run qa:workbench`.
9. Inspect the diff. No `package-lock.json` changes should result from ordinary workbench project operations.
10. Commit the bounded batch with evidence.

## Definition of done for one starter kit

- generated through the canonical factory + overlay;
- target implementation is registered only after it is complete;
- designed playable loop, not a placeholder shell;
- semantic asset roles visibly drive the game;
- mechanic proofs from the scaffold pass in a real browser;
- production build passes;
- zero required external requests and zero console errors;
- known limitations remain honest;
- no shared-machine changes unless separately justified by a genuine cross-cutting defect;
- tests and QA evidence are committed with the kit.

## Completion reporting

Report only: kits completed, files changed, exact validation results, any scaffold blocked by an actual architecture decision, and the next queue item. Do not claim all 69 complete until `npm run starter-kits:status` reports 69/69 implemented and every expanded kit has committed runtime proof.
