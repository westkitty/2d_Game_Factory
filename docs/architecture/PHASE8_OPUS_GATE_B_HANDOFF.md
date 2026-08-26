# Phase 8 -> Opus 5 Architecture Integration Gate B: handoff

- Date: 2026-08-26
- Author: Sonnet 5 (Phase 8)
- Baseline: Phase 7C complete, commit `8adf81e2d067ee7df071353e4f238ce0c6713a35` (`origin/main`)
- Scope: factory CLI (`@sw2d/cli`), generated-game architecture, real-browser QA (`@sw2d/qa`), and
  twelve committed representative demos (`demos/<preset-id>/`)
- Next bounded action: **Phase 9 - Opus 5 - Architecture Integration Gate B** (not executed here)

This is a handoff, not a self-graded review. It records what Phase 8 built, what it verified with
real evidence (not asserted), and every architectural finding, tension, or open question Opus
should weigh before Phase 9's own scope is set.

## 1. Generated-game architecture

`sw2d new <game-id> --preset <preset-id>` produces a real, runnable, standalone npm workspace
package under `games/<game-id>/` (never committed - `.gitignore`'s `games/` entry), built from six
fixed shell templates keyed by controller family
(`packages/cli/src/generator/controllerTemplates.ts`):

| Controller family | Template | Pack id |
|---|---|---|
| platform | `platformShellPack.ts` | `game.platform-shell` |
| top-down | `topDownShellPack.ts` | `game.top-down-shell` |
| vehicle | `vehicleShellPack.ts` | `game.vehicle-shell` |
| grid | `gridShellPack.ts` | `game.grid-shell` |
| pointer | `pointerShellPack.ts` | `game.pointer-shell` |
| ui-simulation | `uiSimulationShellPack.ts` | `game.ui-simulation-shell` |

A generated game is: `content/game.json` (manifest - required packs + the one shell pack, each
with `config: {}` at minimum), `content/tuning.json`, `content/themes/default/theme.json`,
optionally `content/levels/main.json`, a `src/` tree (`main.ts` wiring every `@sw2d/packs` core
plus the shell pack into `createGame`, `game.ts`, `content.ts`, `game-specific/shellPack.ts`),
`tests/content.test.ts` (self-checking schema/token test), `package.json`, `tsconfig.json`
(self-contained - does not `extend` the repo's `tsconfig.base.json`, so a game directory
typechecks correctly even when built outside its normal `games/` location), `vite.config.ts`,
`index.html`, `README.md`. Generation is pure and deterministic: `buildGameFiles()` returns an
in-memory `Map<string, string>`; `writeGameFiles()` is the only step that touches disk. Byte-
identical trees across repeated calls and across all 74 presets are asserted in
`packages/cli/test/generate.test.ts`.

**A generated game never imports runtime source** - it depends on `@sw2d/*` as normal workspace
packages, exactly as `starter/` always has. No template copies `packages/runtime/src` files.

## 2. CLI (`@sw2d/cli`) and its dependency boundaries

Nine commands (`doctor`, `list-presets`, `describe`, `new`, `add-level`, `add-theme`, `validate`,
`build`, `pack`), each loaded via `loadCommand()`'s dynamic `import()` keyed by command name
(`packages/cli/src/index.ts`) - the same ADR-0015 pattern the preset catalog itself uses, extended
to the CLI: `list-presets`/`describe`/`doctor` never trigger an Ajv or Phaser import, because the
module that would import them is never `import()`-ed for those commands. `doctor` never mutates
the project - environment diagnostics only, verified by its own tests
(`packages/cli/test/doctor.test.ts`).

Filesystem safety is centralized: `assertValidSlug` (lowercase/digits/hyphens only, no `..`,
no separators - `packages/cli/src/slug.ts`) and `resolveUnder` + `assertDoesNotExist`
(`packages/cli/src/paths.ts`, `REPO_ROOT` resolved from the file's own location, never
`process.cwd()`) gate every path the CLI writes. No `--force` mode exists anywhere.

`validate` runs the full ladder in order and stops reporting **success**, not just stopping early,
the moment a real browser is unavailable ("Validation is INCOMPLETE", exit 1) - it does not
silently downgrade to "passed" on the steps that did run.

### 2.1 A real regression this ladder caught

The first `main.ts.template` only passed the shell pack to `createGame({ packs: [...] })`. Any
*other* required pack a preset's `content/game.json` selected (e.g. `sw2d.world` for
metroidvania) would fail "unknown pack" at install time - but the initial shallow smoke oracle
only checked the title screen, never started a run, so `SystemHostImpl.install()` never executed
during the check and the gap was invisible. Fixed two ways: `main.ts.template` now imports and
passes every `@sw2d/packs` core; `validate`'s browser smoke now presses CONFIRM and asserts
`scene === 'sw2d.play' && installedPacks.length > 0`. Recorded here because it is exactly the
"metadata that declares a contract nothing evaluates" failure shape Phase 5's own gate flagged -
this is Phase 8's instance of the same class of bug, caught and closed the same way.

## 3. All-74 generation/build evidence

Two tiers, not one, because building all 74 for real on every CI run is not proportionate to what
changes between them:

1. **Exhaustive, fast, static evidence for all 74** (`packages/cli/test/generate.test.ts`, part of
   638 CLI tests / 1585 total repo tests): for every preset, no unresolved `__TOKEN__`s,
   `content/game.json` schema-valid, theme schema-valid, level normalizes and schema-validates,
   tuning + level validate together, the shell template for its controller family resolves,
   `systemPacks` equals required packs + the shell pack **exactly** (optional packs never
   auto-enabled), README documents optional packs and known limitations. Determinism is asserted
   directly: repeated generation of the same preset, and generation of all 74, produces
   byte-identical trees.
2. **Real build evidence for a representative matrix**
   (`tools/scripts/build-matrix.ts`): the twelve demo presets plus `gallery-shooter` (the one
   controller-family class - `pointer` - not otherwise covered by the twelve) were each generated
   into `games/matrix-<preset-id>`, then really built: `npm install` once, then `tsc --noEmit` and
   `vite build` per game, using direct `node_modules/.bin/{tsc,vite}` paths (not `npx`, which in a
   scratch/temp context can resolve an unrelated squatted `tsc` package from the public registry -
   discovered and worked around during this phase). **13/13 real builds passed.** All matrix
   directories were removed in a `finally` block; `git status` is clean of `games/matrix-*`.

**Why 13 real builds is honest evidence for 74 presets, not a hand-wave:** a generated game's
source varies only by (a) which of the six fixed shell templates is copied, selected purely by
`controllerFamilies[0]`, and (b) JSON content data, already exhaustively schema-checked for all 74
in tier 1. The `.ts`/`.json`/`vite.config.ts`/`tsconfig.json` scaffolding is otherwise byte-for-byte
identical across every generated game regardless of preset. Building one real representative per
shell-template equivalence class is therefore real coverage of the class, not an assumption about
untested presets - the untested part (content data) is exactly what tier 1 already checks
statically and exhaustively.

## 4. The twelve demos and smoke status

Every demo was generated through the same `buildGameFiles`/`writeGameFiles` path as `sw2d new`
(`tools/scripts/generate-demos.ts`), then hand-extended with real game-specific logic in
`src/game-specific/shellPack.ts` (and, where the preset's own content needed a real fixture layout
rather than the universal proof level, a custom `content/levels/main.json`). Every demo passed a
**real** Playwright-driven Chrome smoke test (`playwright-core`, system-installed Chrome, no
bundled-browser download) - not a typecheck/build-only check. `npm run qa:smoke`
(`packages/qa/src/runAll.ts`) builds all twelve plus both starter journeys with a real `vite build`
and runs every committed spec through the shared `runSmoke()` oracle (zero console errors, zero
external/cross-origin requests, plus each spec's own scripted assertions) in one reproducible pass.
**14/14 currently pass** (12 demos + 2 starter journeys).

| Preset | Defining mechanic proven | Smoke |
|---|---|---|
| `traditional-platformer` | platform movement, jump, hazard/reset, collectible, reachable exit | PASS |
| `chase-platformer` | movement, real advancing chase-pressure state, paused during pause, reachable finish/fail | PASS |
| `metroidvania` | movement, one ability/unlock flag, previously-blocked path becomes traversable, objective after unlock | PASS |
| `twin-stick-shooter` | independent movement AND aim (ADR-0016), primary fires a projectile, target takes damage, score/clear | PASS |
| `stealth-game` | patrol/guard state, distance-based detection, objective reachable unseen, alarm on detection | PASS |
| `bullet-hell` | movement, deterministic radial projectile pattern, survival/clear, bounded projectile lifecycle | PASS |
| `top-down-racer` | throttle/steering, three ordered checkpoints, lap completion, restart | PASS |
| `sokoban` | grid movement, box push, invalid-push rejection, solved condition, reset, exact undo | PASS |
| `tower-defense` | fixed route, grid-cursor tower placement, currency cost, one wave, tower damage, reachable outcome | PASS |
| `turn-based-tactics` | two sides, select unit, legal-range move, attack/damage, turn advance | PASS |
| `idle-incremental` | deterministic production, job/queue action, one upgrade, real save/reload persistence across a browser navigation | PASS |
| `visual-novel` | visible DOM dialogue/speaker, one choice, branch/flag change, one ending | PASS |

Two starter journeys were also automated for the first time this phase, using the same harness
(`packages/qa/specs/starterFoundation.ts`, `starterTiledProof.ts`), replacing what had been a
manual checklist: boot/title/play, real movement, pause/resume, restart (`runIndex` incrementing,
clean re-entry to play), and - for `tiled-proof.html` - a full ground-level walk from spawn through
a Tiled-sourced checkpoint, collectible, hazard, and exit, proving that layout truly comes from
`content/levels/intro.json` through the content pipeline and entity registry (ADR-0014), not
hard-coded coordinates in the shell pack.

## 5. Maturity promotion

Exactly the twelve preset ids above are now `maturity: 'smoke-validated'`; the other 62 remain
`'recipe'`; zero are `'proof-validated'` or `'experimental'`. `PresetSpec` gained an optional
`maturity` field (`packages/presets/src/shared.ts`, defaults to `'recipe'`) rather than promoting
via a separate override table, so the promotion is visible directly at each preset's own
definition site. `packages/presets/test/honesty.test.ts` asserts the exact 12/62/0 split and the
exact id list, replacing the Phase 7 test that asserted "every preset is `'recipe'`" (that
assertion was Phase 7's own honest floor, not a permanent invariant - Phase 8's whole purpose was
to earn the next tier for a bounded, real-evidence-backed dozen).

## 6. New reusable capability: `TopDownIntent.aimX/aimY/aimMagnitude`

See [ADR-0016](adr/0016-aim-as-a-digital-axis-not-spatial-pointer.md) in full. Summary: aim is a
second digital axis pair (`AIM_LEFT/RIGHT/UP/DOWN`), computed in `topDownController.ts` via the
same `input.axis()` + magnitude-clamp pattern movement already used - no new input-ownership
surface, no spatial pointer service. This is the resolution of the Phase 8 directive's "may trigger
spatial pointer" clause: it did not need to, because a same-shape extension to the existing digital
axis model fully satisfied `twin-stick-shooter`'s independent-aim requirement. Spatial pointer
(world-space position, hover targets, click/drag) remains deferred - `tower-defense`'s tower
placement uses `gridController`'s existing keyboard-driven cursor instead, per the Phase 8
directive's own explicit allowance.

## 7. Demo-support code NOT promoted to `@sw2d/packs` - for Opus to weigh

**`ProjectilePool`** (`demos/twin-stick-shooter/src/game-specific/projectilePool.ts`, copied
verbatim into `bullet-hell` and `tower-defense` - the exact three-consumer trigger the Phase 8
directive named) is a small (~95-line), bounded projectile-lifecycle helper: spawn a moving sprite,
advance it, expire by lifetime or leaving world bounds, dispose cleanly. It has no persistence, no
config schema, and no capability id - it is plain game-specific TypeScript, not a system pack.

**Not promoted this phase.** Copying a 95-line file three times is a smaller, more honest
commitment than adding a `sw2d.projectiles` capability whose real shape (pooling strategy,
collision integration, damage-on-hit as a first-class concept vs. caller-wired overlap callbacks)
is still being discovered demo-by-demo. Promoting speculatively ahead of a fourth or fifth real
consumer risks exactly the "metadata that declares a contract nothing evaluates" failure Phase 5's
gate found and fixed once already. **Recommend Opus decide**: promote now (three real, slightly
divergent consumers already exist to design the interface against), or wait for Phase 9/10's own
consumers. The three copies are not yet divergent enough to make a bad case either way - each
differs only in `textureKey`/`displaySize`/`lifetimeMs` construction arguments, not in behavior.

## 8. Architectural finding: `sw2d.puzzle`'s config is not JSON-serializable

`PuzzleConfig` (`packages/packs/src/puzzle/puzzlePack.ts`) requires TypeScript **functions**
(`createInitialState(): TState`, `isSolved(state: TState): boolean`) as its configuration. Every
other pack's config is plain JSON data validated against a schema
(`config: {}` or a schema-checked object) - `sw2d.puzzle` is the one exception, and it is a real
one: a function cannot be expressed in `content/game.json`, which the generator can only ever
populate with JSON-serializable `config` values.

This was discovered building `sokoban`, which requires `sw2d.puzzle`. **Resolution for this
demo**: `content/game.json` does not select `sw2d.puzzle` at all; `demos/sokoban/src/game-specific/
shellPack.ts` implements grid/push/undo/solved state directly, in the exact shape `PuzzleService`
already defines (`current`/`apply`/`undo`/`reset`/`isSolved`), so the equivalence is inspectable in
the diff rather than asserted. This is a workaround, not a fix to the underlying gap - **any
future preset requiring `sw2d.puzzle` hits the identical wall** and would need the identical
workaround (or a real fix). Two real fixes exist and neither was attempted this phase, since it is
outside Phase 8's bounded scope (generated-game architecture, not pack architecture):

- Give `PuzzleConfig` a JSON-serializable alternative shape (e.g. a small declarative grid/rule
  format the pack itself interprets), which is real new pack-design work, not a CLI change.
- Accept that `sw2d.puzzle`-family presets are permanently "game-specific implementation required,
  no generator-populated config" and document that limitation at the pack level, not just per
  preset (currently only `sokoban`'s own `knownLimitations` mentions it).

**Recommend Opus decide** which, if either, Phase 9/10 should pursue.

## 9. Cross-demo duplicated mechanics (beyond `ProjectilePool`)

- **Grid cursor + confirm/cancel pattern**: `sokoban`, `tower-defense`, and `turn-based-tactics`
  all implement "a `gridController`-driven cursor over hand-authored grid cells, CONFIRM to
  act/select, CANCEL to undo/deselect" independently, with different cell semantics (push-box,
  place-tower, select-and-move-unit). No shared abstraction was extracted - the three differ enough
  in what CONFIRM *means* (push vs. place vs. select-then-act) that a shared "grid cursor" helper
  would need to either encode all three behaviors (defeating the purpose) or stay so thin it saves
  little. Worth Opus's attention if a fourth grid-family demo appears with the same shape.
- **Save/reload via `context.saves`**: only `idle-incremental` uses `SaveStore` this phase, but it
  is a real, already-existing runtime capability (`packages/contracts/src/persistence.ts`,
  predates Phase 8) - not something invented for this demo. No duplication concern; recorded here
  only because it is the first Phase 8 demo to exercise it under real-browser QA (a genuine page
  reload, not an in-memory reset).
- **Hand-authored level layouts** (`metroidvania`'s blocking wall, `top-down-racer`'s ordered
  checkpoints, `sokoban`'s grid, `tower-defense`'s route/placement cells) are all plain TypeScript
  or hand-edited `content/levels/main.json`, not Tiled object classes - the object-class catalog
  stays at nineteen (ADR-0014), unchanged this phase. No demo's mechanic needed a class Tiled
  cannot already express (`Solid`/`PlayerSpawn`/`Checkpoint`/`Collectible`/`Hazard`/`Exit`/
  `Powerup`); the grid/route/waypoint *shapes* are game-specific data, the same conclusion
  puzzle-platformer's own `knownLimitations` already reached before this phase.

## 10. Package-boundary pressure

None found that crosses a protected boundary. `@sw2d/cli` depends on `@sw2d/contracts`,
`@sw2d/content-pipeline`, `@sw2d/presets`, `@sw2d/qa`, `@sw2d/schemas` in production, and on
`@sw2d/packs`/`@sw2d/runtime`/`phaser` only as `devDependencies` (needed to typecheck the template
files the CLI writes, never to run a CLI command). `@sw2d/qa` depends only on `playwright-core`
and `@sw2d/contracts` types - no dependency on `@sw2d/cli` (the reverse would be the boundary
violation; `@sw2d/cli` is what depends on `@sw2d/qa`, one-directionally, for `validate`'s browser
step and for `doctor`'s capability check). `@sw2d/contracts` remains dependency-free.

## 11. Browser-QA architecture

`@sw2d/qa` is a thin, deliberately un-clever harness: `playwright-core` (Apache-2.0, ~13 MB, no
postinstall browser download) launches system-installed Chrome via `chromium.launch({
executablePath })`, resolved by `findSystemChrome()` (checks `PLAYWRIGHT_CHROME_PATH` override,
then platform-default install paths). `serveStatic()` is a ~40-line static file server bound to
port 0 (OS-assigned, never a fixed port - never collides with 4173 or any other in-use port).
`launchHarness()` returns `stepFrames(count)` (advances `window.__SW2D__.phaser.loop.step(t)` at a
fixed 16.67 ms/frame - deterministic, not real-time, the same technique the Phase 1 manual
validation doc originally disclosed for the journeys this harness now automates),
`keyTap`/`keyDown`/`keyUp` (real `KeyboardEvent`s), `consoleErrors()`, and `externalRequests()`
(same-origin oracle). `runSmoke(spec)` is the one shared runner every committed spec goes through:
serves, launches, runs the spec's own scripted interaction, folds in the two universal oracle
checks (zero console errors, zero external requests) on top of whatever the spec itself asserted.
`readSnapshot`/`readShellState` (`packages/qa/src/snapshot.ts`) give every spec typed access to
`window.__SW2D__.snapshot()` and each shell pack's own `debug.contribute()` section, so no spec
hand-writes an unsafe `window as any` cast. `packages/qa/src/runAll.ts` is the one entry point
behind `npm run qa:smoke`: builds every target with a real `vite build` (reproducible, no
hand-built/stale `dist/` dependency), runs its spec, and reports a pass/fail summary with a
non-zero exit code on any failure - CI-usable as written.

**One real flake found and fixed during this phase**: `stealth-game`'s original smoke spec budgeted
exactly 300 simulated frames for the player to reach the exit, and the actual traversal took
essentially exactly 300 - a hairline margin that occasionally landed one frame short. Fixed by
widening the budget to 500 frames (real margin, not a magic-number bump chasing one failure) -
recorded here because it is a real lesson for future specs: budget loops need genuine headroom
against the deterministic-but-precise frame math, not the minimum that happened to pass once.

## 12. Unresolved questions for Phase 9

1. Promote `ProjectilePool` to `@sw2d/packs` now, or wait for more consumers? (Section 7)
2. Give `sw2d.puzzle` a JSON-serializable config path, or formally document "code-configured pack,
   no generator support" as a permanent pack-level limitation? (Section 8)
3. Is a shared "grid cursor" abstraction worth extracting if a fourth grid-family demo needs the
   same shape, or does CONFIRM's differing meaning per demo make that premature? (Section 9)
4. Spatial pointer/hover/click targeting is still fully deferred - `point-and-click`,
   `drawing-game`, and several other presets still cannot be honestly built without it. Should a
   future phase build it, and if so, does it fit the existing `ActionInput` boundary the way the
   aim extension did, or does it genuinely need new input-ownership surface?

## 13. Explicit non-scope this phase

- No preset beyond the twelve above changed maturity.
- The object-class catalog stays at nineteen; no new Tiled class was added.
- No spatial pointer/hover/drag input service was built.
- No package outside `@sw2d/cli`/`@sw2d/qa` and the touched files listed in sections 6/8 changed
  its public API.
- `games/` and every demo's `dist/`/`pack/`/`node_modules/` are not committed - only `demos/*/src`,
  `demos/*/content`, and each demo's generated scaffolding (`package.json`, `tsconfig.json`,
  `vite.config.ts`, `index.html`, `README.md`, `tests/`) are.
