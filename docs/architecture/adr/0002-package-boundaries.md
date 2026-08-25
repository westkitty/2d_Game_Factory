# ADR-0002: contracts / runtime / game package split

- Status: accepted
- Date: 2026-08-24
- Phase: 1 (Opus 5)

## Context

`MASTER_PROJECT.md` §6 sketches a workspace with runtime, schemas, presets, CLI, QA and a
starter game, while §38 and this phase's brief both say not to create directories that stay
empty placeholders. The separation that actually needs deciding now is which code may know
about a renderer.

## Decision

Three npm workspaces exist today:

```text
@sw2d/contracts   interfaces only. Zero dependencies. No Phaser, no DOM assumptions.
@sw2d/runtime     the reusable machine. Depends on contracts + phaser.
@sw2d/starter     one game composing the runtime. The Phase 1 vertical slice.
```

Packages are consumed as TypeScript source through `exports` pointing at `src/index.ts`; Vite
transpiles them and `optimizeDeps.exclude` keeps them out of prebundling. There is no
per-package build step.

Reserved for later, created when they have a consumer: `@sw2d/schemas`, `@sw2d/presets`,
`@sw2d/packs`, `@sw2d/cli`, `@sw2d/qa`.

## Consequences

- The CLI and schema tooling can read preset, pack and manifest shapes in Node without
  instantiating a renderer. This is the reason `contracts` is a package and not a folder.
- The QA harness can assert against `DebugSnapshot` without a browser.
- Types and future JSON Schemas have one shared source of shape, so they cannot drift into two
  hand-maintained definitions.
- Consuming source rather than build output means one fast feedback loop and no stale `dist/`,
  at the cost of every consumer being a TypeScript-aware bundler. Acceptable: the only
  consumers are Vite and Vitest, which share a transform.
- A `SystemPackDefinition` is generic over its context, so a pack that renders is typed against
  `SceneContext` while a pack that only simulates can be typed against `GameContext` and stay
  engine-free.

## Rejected

- **One package.** Would put Phaser on the CLI's dependency path.
- **Creating all six packages now.** Empty packages imply work that has not happened, and
  `OPERATIONAL_STATE.md` exists precisely to stop that kind of implied progress.
