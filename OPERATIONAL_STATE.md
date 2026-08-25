# Operational State

Project: **Stinky Weasel 2D Browser Game Factory** (`sw2d`)
Repository: `westkitty/2d_Game_Factory`
State revision: **2**
Updated: 2026-08-25

Read this before doing anything. Governing spec: [`MASTER_PROJECT.md`](MASTER_PROJECT.md).
Workflow: [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md).

---

## Current phase

**Phase 2 - Schema, Registry, and Content Foundation - COMPLETE (Sonnet 5).**

Next owner: **Sonnet 5, Phase 3**. See [Next bounded action](#next-bounded-action).

## Current baseline

| Item | Value |
|---|---|
| Branch | `main` |
| Workspaces | `@sw2d/contracts`, `@sw2d/runtime`, `@sw2d/schemas`, `@sw2d/starter` |
| Node (supported) | `>=22.12.0`; target 24.x LTS (`.nvmrc` = 24) |
| Node (dev host used) | 26.7.0, npm 11.19.0 |
| Phaser | 4.2.1 (MIT) |
| TypeScript | 7.0.2 (Apache-2.0) |
| Vite | 8.2.2 (MIT) |
| Vitest | 4.1.11 (MIT) |
| Ajv | 8.20.0 (MIT) |
| ajv-formats | 3.0.1 (MIT) |
| Runtime version constant | `0.1.0` |
| Debug snapshot version | `1` |
| Settings schema version | `1` |
| Schema versions (all Phase 2 schemas) | `v1` (encoded in each schema's `$id`, e.g. `urn:sw2d:schema:game-definition:v1`) |

Full rationale: [`docs/architecture/DEPENDENCY_BASELINE.md`](docs/architecture/DEPENDENCY_BASELINE.md).

## Verified capabilities

Backed by the evidence in [`docs/qa/PHASE1_VALIDATION.md`](docs/qa/PHASE1_VALIDATION.md) (Phase 1)
and this revision's validation run (Phase 2).

- `npm install`, `npm run typecheck`, `npm test` (87 tests), `npm run build` and
  `npm run check:offline` all pass.
- Boot -> title -> start -> controllable placeholder actor -> pause -> resume -> restart works
  end to end in a real browser against the production build.
- Restart is clean: 8 consecutive restarts plus a quit-to-title and a fresh run left every
  live-resource counter flat (input adapters, context disposables, scene disposables, installed
  packs, debug contributions). Quitting to the title released all of them to zero.
- Semantic input drives gameplay from both keyboard and DOM touch controls, with no duplicated
  game logic for touch.
- One press produces one effect across overlapping scenes (`consumePress`).
- Settings persist across reload, namespaced by game id and version-stamped.
- The accessibility projection is live and derived, not copied (reduced motion forces screen
  shake to zero without a second setting).
- Audio stays locked until a real user gesture; no autoplay is attempted; Web Audio absence
  degrades to `unavailable` rather than throwing.
- The production build loaded exactly two resources, both same-origin (re-verified this
  revision; still true with `@sw2d/schemas` bundled in).
- Mobile viewport (375x812) shows unclipped 56x56 touch controls and a scaled canvas.
- **(Phase 2)** `@sw2d/schemas` validates GameDefinition, PresetDefinition, SystemPackSelection,
  ActionBindings, GameSettings and a `tuning` content document via Ajv, with located errors
  (`documentId` + `instancePath` + `message`; e.g. `/player/jumpVelocity must be number`).
  29 tests across `validator.test.ts`, `parity.test.ts`, `contentDocuments.test.ts`,
  `presetComposition.test.ts`.
- **(Phase 2)** Schema/type parity is enforced mechanically: each schema's declared property-key
  set is asserted equal to `Object.keys()` of a TypeScript object literal typed
  `satisfies <ContractInterface>` against the real `@sw2d/contracts` type. A field added to or
  removed from a contracts interface without updating the schema (or vice versa) fails
  `parity.test.ts`. See the residual-limitation note in that file.
- **(Phase 2)** `ContentBundle.data` is now `Readonly<Record<string, ContentDocumentEnvelope>>`
  (`schemaId`, `valid`, `value`), not an ungoverned `Record<string, unknown>`. Zero runtime code
  read `.data` before this change (confirmed by search), so the edit required no
  `packages/runtime/**` changes.
- **(Phase 2)** The starter runs from validated JSON: `starter/content/game.json` (validated
  against the GameDefinition schema before `STARTER_GAME` exists) and
  `starter/content/content.json` + `starter/content/tuning.json` (the latter validated through
  the content-document registry) replace the Phase 1 inline TypeScript literals. Verified in a
  real browser: the built starter boots to a title screen rendering the exact JSON-sourced UI
  copy, with zero console errors - proof the validation ran and passed before Phaser
  initialised. `packages/runtime/**` has zero changes (confirmed: `git diff --stat -- packages/runtime/`
  is empty).
- **(Phase 2)** Malformed content fails before runtime use: `starter/test/content.test.ts`
  asserts a `game.json` missing `viewport` and a `tuning.json` with a wrong-typed field both
  throw `SchemaValidationError` from the content loader, not from wherever gameplay code first
  touches the bad field.

## Implemented but unverified

These exist in source and type-check, but have **no** executed evidence yet. Do not treat as
working.

- `PresetDefinition` - schema-validated as of Phase 2, but no preset instance exists yet and
  nothing in the runtime consumes one. Preset *dependency ordering* (topological sort, cycle
  detection) is exercised only for `SystemPackDefinition` via `resolveInstallOrder`
  (`@sw2d/runtime`, Phase 1 coverage, unchanged); `PresetDefinition.requiredSystemPacks` /
  `optionalSystemPacks` carry no dependency edges of their own; the only cross-field rule
  checked so far is duplicate/empty pack references (`validatePresetComposition`,
  `@sw2d/schemas`).
- `SystemPackDefinition.configSchemaId` - still declared, still unenforced. Enforcing it means
  `SystemHostImpl.install()` (`packages/runtime`) calling the Phase 2 validator before a pack
  installs, which Phase 2 was not permitted to touch. Deferred to whichever phase is next
  allowed to edit `@sw2d/runtime`.
- Image-backed (`kind: 'image'`) assets - code path exists, unused; no theme/asset pipeline yet
  (Phase 6).
- `starter/src/content.ts`'s `assets`/`ui` fields have **no JSON Schema**, only a TypeScript
  `satisfies`-then-assert against `AssetDescriptor`/`UiCopy` at the JSON import site (JSON
  imports infer widened primitives, e.g. `role: string` not `AssetRole`, so `satisfies` alone
  cannot narrow them - see the comment in `starter/src/content.ts`). A malformed
  `content.json` asset entry is not currently rejected at the content boundary the way
  `game.json` and `tuning.json` are. Deliberately out of scope: an asset/theme schema belongs to
  Phase 6's Tiled/theme pipeline, not Phase 2's five named contract types.
- `InputDeviceAdapter.poll()` - unit-tested for call cadence; no polling device (gamepad) exists.
- `WebAudioBus.musicNode` - wired into the gain graph, nothing plays through it.
- `SaveStore.migrate` - unit-tested; never exercised against a real schema change.
- `AccessibilityStateImpl.refreshEnvironment()` - no caller re-reads media queries yet.
- `highContrast` - persisted and projected; nothing renders differently for it.
- Reduced motion is honoured by the title prompt only; no other motion exists to suppress.

## Known failures / gaps

- **The browser journey is not automated.** It was driven manually and does not re-run on
  commit. Highest-value QA debt. See [ADR-0008](docs/architecture/adr/0008-phase1-validation-strategy.md).
  Still true in Phase 2; a light manual smoke check confirmed the JSON content path boots
  cleanly, but the full boot -> play -> pause -> restart journey was not manually replayed this
  revision (per the master plan: rerun only when a change demonstrates impact, and Phase 2 never
  touches `packages/runtime/**`).
- **Frames in that journey were clocked manually** via `game.loop.step(t)`, because the
  automation surface keeps the browser pane hidden and rAF is throttled there. The code path is
  the production one; the clock is not wall-clock. FPS under real pacing is unmeasured. The same
  throttling was observed this revision (a `space` keypress did not visibly advance past the
  title scene in the hidden automation pane); not investigated further, as it is pre-existing QA
  debt out of Phase 2's scope, not a regression.
- **Bundle size**: 1.538 MB minified (407 kB gzip), up from 1.4 MB / 366 kB in Phase 1 because
  `@sw2d/schemas` (Ajv + ajv-formats) is now bundled into the starter, which validates its own
  content at boot in production too. No code splitting. Acceptable for a self-contained static
  game; revisit only against a real target.
- **Phaser 4.2.1 typings gap** patched locally in `packages/runtime/src/phaser-augmentations.d.ts`.
  Delete it when upstream declares those `SceneManager` methods.
- JSON Schema validation now exists for GameDefinition, PresetDefinition, SystemPackSelection,
  ActionBindings, GameSettings and the `tuning` content document. It does **not** yet exist for
  asset/theme documents (see "Implemented but unverified" above) or for any document type beyond
  those six - by design; inventing schemas without a Phase 2 consumer was out of scope.

## Unknown

- Whether Phaser 4 can run headlessly under Vitest well enough to automate the journey without
  degrading product code (`generateTexture` needs a renderer). Investigate before committing to
  a headless approach.
- Real-device touch behaviour; only synthetic touch-type pointer events were used.
- Gamepad adapter feasibility against the current `InputDeviceAdapter` shape.
- Whether arcade physics suffices for every planned preset, or whether the optional advanced
  physics pack becomes necessary (`MASTER_PROJECT.md` §9.16).
- Final project software license. Still a user decision; `package.json` says `UNLICENSED`.

## Protected invariants

Breaking one of these is an architecture change, not a bug fix. Escalate rather than work around.

1. `westkitty/c_chase` is read-only. Never modified, never pushed to, its architecture never
   transplanted, its assets never copied (unlicensed - see the extraction report).
2. `westkitty/2d_Game_Factory` is the only authorised remote. No force-push, no history rewrite.
3. **Machine vs game.** Ordinary game work touches `content/`, `public/`, `themes/`,
   `src/game-specific/`. It does not touch `@sw2d/runtime` or `@sw2d/contracts`.
4. `@sw2d/contracts` imports nothing - no Phaser, no DOM library, no dependency at all.
5. Gameplay consumes semantic actions. No `KeyboardEvent.code` outside an input adapter.
6. Input advances exactly once per frame, owned by `ActionInputHost`, driven from `prestep`.
   Discrete mode-changing reads use `consumePress`.
7. Only `SceneRouter` touches Phaser's scene manager.
8. Every system that allocates a listener, timer, body, DOM node, audio node or subscription
   has a disposal path, and restart must leave every snapshot counter flat.
9. No module-level mutable state in the runtime.
10. Zero required external network requests at runtime. No CDN, webfont, telemetry, analytics
    or remote config.
11. Saves are namespaced by game id and carry `schemaVersion`. No silent cross-loading, no
    silent reinterpretation.
12. Accessibility architecture is never removed by a preset or a theme; a preset may hide rows.
13. No game identity, lore or wording in runtime code. Copy comes from the content bundle.
14. No new package or abstraction without a real consumer.
15. Preset maturity labels stay honest. `proof-validated` requires an end-to-end proof.

## Validation matrix

| Layer | State | Command |
|---|---|---|
| Static / schema | TypeScript passing; JSON Schema exists for 5 contract types + 1 content document | `npm run typecheck` |
| Unit | 87 tests passing (58 Phase 1 + 29 Phase 2) | `npm test` |
| Build | passing | `npm run build` |
| Offline (static guard) | passing | `npm run check:offline` |
| Runtime integration | proven manually in-browser, **not automated** | see ADR-0008 |
| Browser journeys | not automated; Phase 2 content-boundary boot re-verified manually this revision | Phase 2+ (QA package still unbuilt) |
| Proof regression | none - no proof games exist | Phase 10 |

`npm run validate` runs typecheck + test + build + offline guard. All four passed this revision.

## Pending work

Phases 3-12 are unstarted. See `MASTER_PROJECT.md` §38 for the routed plan and owners.

## Next bounded action

**Phase 3 - Sonnet 5 - Controller Families.**

Implement the six controller families named in `MASTER_PROJECT.md` §10 (platform, top-down,
vehicle, grid, pointer, UI/simulation) against the semantic input layer, with minimal
demonstration fixtures. Acceptance: every controller consumes the same `ActionInput` surface, no
controller duplicates physical-input plumbing, lifecycle/disposal stays clean, and focused
controller tests pass. This will very likely require real `packages/runtime/**` changes (Phase 2
was the last phase required to leave it untouched) - read `MASTER_PROJECT.md` §10 and the
"System packs" / "Semantic input" sections of `docs/architecture/ARCHITECTURE_OVERVIEW.md`
before starting. Do not start Phase 4 in the same pass. Keep the repository runnable at the
phase boundary.

## Revision history

### Revision 2 - 2026-08-25 (Sonnet 5)
Phase 2 complete. `@sw2d/schemas` created: JSON Schema (draft-07) for GameDefinition,
PresetDefinition, SystemPackSelection, ActionBindings, GameSettings, plus a `tuning` content
document; Ajv 8.20.0 + ajv-formats 3.0.1 validator with located errors (`documentId` +
`instancePath` + `message`); a schema/type parity test keyed off `satisfies`-typed fixtures
against the real contracts interfaces; a small content-document registry
(`validateContentBundleData`) closing the `ContentBundle.data` type hole via a new
`ContentDocumentEnvelope<T>` contracts type; a `validatePresetComposition` semantic check for
duplicate/empty pack references (JSON Schema alone cannot express cross-array uniqueness). The
starter now runs from validated JSON (`starter/content/game.json`, `content.json`,
`tuning.json`) instead of inline TypeScript literals; `packages/runtime/**` received zero edits
(verified via `git diff --stat`). 29 new tests; full `npm run validate` ladder passed; a real
browser smoke check confirmed the built starter boots to title rendering the JSON-sourced UI
copy with no console errors. Known residual gap: `assets`/`ui` fields have no JSON Schema yet
(compile-time `satisfies` only) - deliberately deferred to Phase 6's theme/asset pipeline rather
than invented early. `SystemPackDefinition.configSchemaId` remains declared-but-unenforced;
enforcing it needs a `packages/runtime` edit Phase 2 was not permitted to make.

### Revision 1 - 2026-08-24 (Opus 5)
Phase 1 complete. Repository established; master plan installed; contracts, runtime and the
starter vertical slice implemented; dependency baseline pinned and recorded; eight ADRs written;
`c_chase` extracted read-only; validation ladder run and recorded. Two defects found and fixed
during validation (input edge double-consumption on resume; boot scene never stopping).
