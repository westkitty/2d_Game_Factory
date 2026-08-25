# Phase 1 Validation Evidence

Run: 2026-08-24. Model: Opus 5. Commit: the Phase 1 foundation commit.

Method and its limits are set out in [ADR-0008](../architecture/adr/0008-phase1-validation-strategy.md).

## Automated ladder

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Dependency install | `npm install` | PASS - 51 packages, 0 vulnerabilities |
| 2 | Static checks | `npm run typecheck` (`tsc --noEmit`) | PASS - exit 0, all packages |
| 3 | Unit tests | `npm test` (Vitest) | PASS - 5 files, 58 tests |
| 4 | Production build | `npm run build` | PASS - `index.html` 1.47 kB, CSS 1.30 kB, JS 1,400.88 kB (366.50 kB gzip) |
| 5 | Offline guard | `npm run check:offline` | PASS - 0 external request constructs in 3 scanned files |

Steps 1-5 run together as `npm run validate`.

Unit coverage by area: disposal ordering and idempotence; event bus listener accounting;
capability registry duplicate/missing errors; pack dependency resolution (ordering, determinism,
cycles, unknown ids, duplicate capabilities, core shadowing); action edges, latched taps,
axis, clamping, focus clearing, adapter lifecycle, press claiming; save namespacing, corruption
recovery, version invalidation and migration; settings normalisation and persistence;
accessibility projection; asset role resolution.

## Browser journey

Production build served by `vite preview` on `http://localhost:4188`, driven in a real browser
(real Phaser 4.2.1, WebGL renderer, real DOM events). Assertions read
`globalThis.__SW2D__.snapshot()`.

**Disclosure:** frames were clocked by calling `game.loop.step(t)` rather than by
`requestAnimationFrame`, because the automation surface keeps the browser pane hidden and
browsers throttle rAF in hidden pages. The executed code path is the production one; only the
clock is driven. This journey is **not yet automated** and does not re-run on commit.

| ID | Journey | Evidence | Result |
|---|---|---|---|
| BOOT-001 | launch -> title | `scene: sw2d.title`, run 0, 0 packs installed | PASS |
| GAME-001 | title -> CONFIRM -> play | `scene: sw2d.play`, run 1, packs `[starter.placeholder-mover]` | PASS |
| GAME-002 | placeholder actor settles on ground | `player {y: 486, vy: 0, onGround: true}` | PASS |
| MOVE-001 | held MOVE_RIGHT moves the actor | `x` 480 -> 553 over 20 frames (~220 px/s, matches config) | PASS |
| MOVE-002 | JUMP leaves the ground | `vy: -265, onGround: false` | PASS |
| PAUSE-001 | play -> PAUSE | `paused: true`, pause scene active, play scene paused | PASS |
| PAUSE-002 | PAUSE -> resume | `paused: false`, play scene resumed, overlay stopped | PASS (after the ADR-0003 fix) |
| RESTART-001 | 8 consecutive pause+restart cycles | run 1 -> 9; counters flat throughout: adapters 2, context disposables 6, scene disposables 1, installed packs 1, debug sections 1 | PASS |
| RESTART-002 | quit to title releases everything | packs 0, scene disposables 0, debug sections 0 | PASS |
| RESTART-003 | fresh run after quit | run 10, packs 1, counters identical to run 1 | PASS |
| SETTINGS-001 | change settings, reload, persist | `masterVolume 0.25`, `reducedMotion true`, `touchControls on` survived reload from `sw2d:sw2d-foundation-slice:settings` | PASS |
| A11Y-001 | accessibility projection is live | `reducedMotion` on forced `screenShakeScale` to 0 without a second setting | PASS |
| TOUCH-001 | mobile viewport, touch drives semantic action | 375x812: `coarsePointer true`, controls visible and unclipped, buttons 56x56; touch pointerdown on the CONFIRM button set `CONFIRM: 1` and started the run | PASS |
| OFFLINE-001 | production build makes no external request | `performance.getEntriesByType('resource')` returned exactly 2 entries, both `http://localhost:4188/assets/...` | PASS |
| AUDIO-001 | gesture-safe unlock | `audioUnlock: locked` before any gesture, `unlocked` after a real click; no autoplay attempt | PASS |

## Defects found and fixed during this phase

1. **A resumed scene re-read the input edge the pause menu had just acted on.** Pressing PAUSE
   to resume immediately re-paused, because the overlay resumed the play scene within the same
   frame and the freshly-resumed scene then saw the same `justPressed('PAUSE')`. Same class as
   the `c_chase` audit's #1 finding. Fixed structurally with `consumePress()` -
   [ADR-0003](../architecture/adr/0003-semantic-input-ownership.md). Regression-tested.
2. **BootScene never stopped.** It stayed active after handing off to the title. Fixed by
   including boot in the router's exclusive scene set.

## Not covered by Phase 1

- Automated browser journeys in CI (Phase 2+, `@sw2d/qa`).
- Real-clock frame pacing and FPS measurement under load.
- Physical touch hardware; only synthetic touch-type pointer events and a mobile viewport.
- Gamepad input; the adapter interface exists, no adapter does.
- Any genre mechanic. This is a foundation proof, not a demo.
