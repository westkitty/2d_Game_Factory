# Operational State

Project: **Stinky Weasel 2D Browser Game Factory** (`sw2d`)
Repository: `westkitty/2d_Game_Factory`
State revision: **1**
Updated: 2026-08-24

Read this before doing anything. Governing spec: [`MASTER_PROJECT.md`](MASTER_PROJECT.md).
Workflow: [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md).

---

## Current phase

**Phase 1 - Establishment and Architecture Foundation - COMPLETE (Opus 5).**

Next owner: **Sonnet 5, Phase 2**. See [Next bounded action](#next-bounded-action).

## Current baseline

| Item | Value |
|---|---|
| Branch | `main` |
| Workspaces | `@sw2d/contracts`, `@sw2d/runtime`, `@sw2d/starter` |
| Node (supported) | `>=22.12.0`; target 24.x LTS (`.nvmrc` = 24) |
| Node (dev host used) | 26.7.0, npm 11.19.0 |
| Phaser | 4.2.1 (MIT) |
| TypeScript | 7.0.2 (Apache-2.0) |
| Vite | 8.2.2 (MIT) |
| Vitest | 4.1.11 (MIT) |
| Runtime version constant | `0.1.0` |
| Debug snapshot version | `1` |
| Settings schema version | `1` |

Full rationale: [`docs/architecture/DEPENDENCY_BASELINE.md`](docs/architecture/DEPENDENCY_BASELINE.md).

## Verified capabilities

Backed by the evidence in [`docs/qa/PHASE1_VALIDATION.md`](docs/qa/PHASE1_VALIDATION.md).

- `npm install`, `npm run typecheck`, `npm test` (58 tests), `npm run build` and
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
- The production build loaded exactly two resources, both same-origin.
- Mobile viewport (375x812) shows unclipped 56x56 touch controls and a scaled canvas.

## Implemented but unverified

These exist in source and type-check, but have **no** executed evidence yet. Do not treat as
working.

- `PresetDefinition` - a type only. No preset exists, nothing consumes it.
- `SystemPackDefinition.configSchemaId` - declared, unenforced until the Phase 2 validator.
- `ContentBundle.data` and image-backed (`kind: 'image'`) assets - code paths exist, unused by
  the Phase 1 bundle.
- `InputDeviceAdapter.poll()` - unit-tested for call cadence; no polling device (gamepad) exists.
- `WebAudioBus.musicNode` - wired into the gain graph, nothing plays through it.
- `SaveStore.migrate` - unit-tested; never exercised against a real schema change.
- `AccessibilityStateImpl.refreshEnvironment()` - no caller re-reads media queries yet.
- `highContrast` - persisted and projected; nothing renders differently for it.
- Reduced motion is honoured by the title prompt only; no other motion exists to suppress.

## Known failures / gaps

- **The browser journey is not automated.** It was driven manually and does not re-run on
  commit. Highest-value QA debt. See [ADR-0008](docs/architecture/adr/0008-phase1-validation-strategy.md).
- **Frames in that journey were clocked manually** via `game.loop.step(t)`, because the
  automation surface keeps the browser pane hidden and rAF is throttled there. The code path is
  the production one; the clock is not wall-clock. FPS under real pacing is unmeasured.
- **Bundle size**: 1.4 MB minified (366 kB gzip), essentially all Phaser. No code splitting.
  Acceptable for a self-contained static game; revisit only against a real target.
- **Phaser 4.2.1 typings gap** patched locally in `packages/runtime/src/phaser-augmentations.d.ts`.
  Delete it when upstream declares those `SceneManager` methods.
- No schema validation exists, so malformed content fails at whatever line touches it rather
  than at a validation boundary. This is Phase 2's first job.

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
| Static / schema | TypeScript passing; **no JSON Schema yet** | `npm run typecheck` |
| Unit | 58 tests passing | `npm test` |
| Build | passing | `npm run build` |
| Offline (static guard) | passing | `npm run check:offline` |
| Runtime integration | proven manually in-browser, **not automated** | see ADR-0008 |
| Browser journeys | not automated | Phase 2+ |
| Proof regression | none - no proof games exist | Phase 10 |

`npm run validate` runs typecheck + test + build + offline guard.

## Pending work

Phases 2-12 are unstarted. See `MASTER_PROJECT.md` §38 for the routed plan and owners.

## Next bounded action

**Phase 2 - Sonnet 5 - Schema, Registry, and Content Foundation.**

Create `packages/schemas` (`@sw2d/schemas`) and implement, against the contracts that already
exist in `@sw2d/contracts`:

1. JSON Schemas for the game manifest, preset definition, system-pack configuration, controls
   and tuning. Mirror the existing TypeScript shapes exactly - `GameDefinition`,
   `PresetDefinition`, `SystemPackSelection`, `ActionBindings`, `GameSettings`.
2. An Ajv-based validator (`ajv` 8.20.0 + `ajv-formats` 3.0.1, both MIT, verified current on
   2026-08-24 and deliberately not yet installed) that fails with readable, located messages.
3. A schema/type parity test so the two definitions cannot drift.
4. A JSON `ContentSource` that validates a bundle before returning it, replacing
   `starter/src/content.ts` without changing one line of `@sw2d/runtime`. That substitution is
   the acceptance test for the content boundary.
5. Close the `ContentBundle.data` type hole recorded above.

Acceptance: invalid configuration fails with a message naming the document, field and problem;
preset dependency resolution stays deterministic; the parity test exists and passes; the
starter still passes the full Phase 1 ladder.

Do not start Phase 3 in the same pass. Keep the repository runnable at the phase boundary.

## Revision history

### Revision 1 - 2026-08-24 (Opus 5)
Phase 1 complete. Repository established; master plan installed; contracts, runtime and the
starter vertical slice implemented; dependency baseline pinned and recorded; eight ADRs written;
`c_chase` extracted read-only; validation ladder run and recorded. Two defects found and fixed
during validation (input edge double-consumption on resume; boot scene never stopping).
