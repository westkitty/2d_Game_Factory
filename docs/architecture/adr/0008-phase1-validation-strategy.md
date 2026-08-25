# ADR-0008: Phase 1 validation ladder; Playwright deferred

- Status: accepted
- Date: 2026-08-24
- Phase: 1 (Opus 5)

## Context

`MASTER_PROJECT.md` §31 defines five validation layers and §39 says to run the smallest
sufficient ladder. Phase 1 must prove: install, static checks, focused unit tests, production
build, the boot -> title -> play -> pause -> resume -> restart flow, no listener duplication
across restarts, and no required external runtime URL. Phase 1's brief also says to add browser
tooling "only where immediately justified".

## Decision

**Design the logic to be testable without an engine.** Lifecycle, action edges, pack
resolution, save migration, settings normalisation and the accessibility projection are all
engine-free by construction, so Vitest runs them in plain Node with no DOM, no canvas and no
renderer. 58 tests, sub-second.

**Prove the flow in a real browser, driven, without adding a dependency.** The production build
was served over a local static server and driven through a real browser: real Phaser, real
WebGL, real DOM events. `globalThis.__SW2D__.snapshot()` is the assertion surface.

Frames were clocked manually via `game.loop.step(t)` rather than by `requestAnimationFrame`,
because the automation surface keeps the pane hidden and browsers throttle rAF in hidden pages.
This is disclosed in `docs/qa/PHASE1_VALIDATION.md`: the code path is the real one, the clock
is not wall-clock.

**Defer Playwright to the QA phase.** Browser journeys (`MASTER_PROJECT.md` §31 Layer 4) become
`@sw2d/qa` when there are journeys worth encoding across many presets. Adding a browser-driver
dependency and a CI browser download to validate one flow would be a dependency ahead of its
consumer.

## Consequences

- The unit layer is fast enough to run on every change and covers the parts most likely to
  regress silently.
- The browser evidence for Phase 1 is real but **not yet automated**. It does not re-run on
  every commit. This is recorded as a known gap in `OPERATIONAL_STATE.md`, not glossed over.
- The `__SW2D__` snapshot hook stays present in production builds. It is read-only, small and
  side-effect-free, and it is the interface the Phase 2+ automated journeys will assert
  against. Verbose development-only diagnostics stay gated behind `debug.enabled`.
- Restart-leak detection depends on the snapshot's counters (`input.adapters`,
  `context.disposables`, `scene.disposables`, installed packs, debug contributions). Keep those
  counters honest; they are the evidence, not decoration.

## The Phase 1 ladder

```text
1  npm install                 dependency install
2  npm run typecheck           tsc --noEmit across every package
3  npm test                    focused unit tests
4  npm run build               production build
5  npm run check:offline       static external-reference guard
6  driven browser journey      BOOT / GAME / MOVE / PAUSE / RESTART / SETTINGS / TOUCH / OFFLINE
```

Steps 1-5 are `npm run validate`. Step 6 is currently manual; automating it is Phase 2+ work.

## Rejected

- **Phaser HEADLESS under jsdom.** Would let the journey run in Vitest, but HEADLESS still
  builds a canvas and `generateTexture` needs a renderer. The likely outcome is degrading real
  product code to make a test environment happy - the wrong trade at the foundation.
- **Skipping browser evidence entirely.** `MASTER_PROJECT.md` §3.9: a build passing does not
  prove the game works.
