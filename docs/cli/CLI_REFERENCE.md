# CLI reference: `@sw2d/cli`

Invoked as `npm run sw2d -- <command> [args]`. Nine commands. Every command validates its
arguments (slug format, target existence) before touching the filesystem or spawning a process,
and returns a real process exit code (`0` success, `1` failure) - safe to script.

Loaded via a per-command dynamic `import()` (`packages/cli/src/index.ts`), so a command that
doesn't need Ajv or Phaser never imports them - `doctor`, `list-presets`, and `describe` load
neither.

## `doctor`

```bash
npm run sw2d -- doctor
```

Environment diagnostics only - **never mutates the project**. Checks: Node.js version
(`>=22.12.0`), `npm`/dependency install state, TypeScript resolvability, `@sw2d/schemas`
loadability, the required package directories, optional Tiled (`TILED_PATH` env var), and
real-browser QA capability (system Chrome). Prints `[OK]`/`[WARN]`/`[FAIL]` per check; exits `1`
if anything is `FAIL`.

## `list-presets`

```bash
npm run sw2d -- list-presets
```

Lists all 74 genre preset ids and display names.

## `describe <preset-id>`

```bash
npm run sw2d -- describe traditional-platformer
```

Prints one preset's controller families, required/optional system packs, required content roles,
supported input modes, validation profile, and known limitations.

## `new <game-id> --preset <preset-id>`

```bash
npm run sw2d -- new my-game --preset traditional-platformer
```

Generates a real, runnable game at `games/<game-id>/` (never committed) from the named preset -
`content/game.json`, `content/tuning.json`, a default theme, a universal proof level (where the
preset requires levels), `src/` wired to the right controller-family shell template, a
self-checking content test, and a `package.json`/`tsconfig.json`/`vite.config.ts`/`index.html`.
Refuses to overwrite an existing `games/<game-id>/` - no `--force` flag exists. Generation is pure
and deterministic: the same `game-id`/`preset-id` pair always produces a byte-identical tree.

Next steps it prints: `npm install && npm run sw2d -- validate <game-id>`.

## `add-level <game-id> <level-id>`

```bash
npm run sw2d -- add-level my-game bonus
```

Writes `content/levels/<level-id>.json` (a Tiled-shaped level document) into an existing generated
game. Self-validates before writing: normalizes the level (`@sw2d/content-pipeline`) and schema-
checks it (`@sw2d/schemas`) - a generator bug is caught before the file ever lands on disk, not
discovered later by `validate`. Refuses to overwrite an existing level.

## `add-theme <game-id> <theme-id>`

```bash
npm run sw2d -- add-theme my-game night
```

Writes `content/themes/<theme-id>/theme.json` into an existing generated game, self-validated the
same way `add-level` is. Refuses to overwrite an existing theme. Point `src/content.ts` at the new
theme id to switch a running game's palette.

## `validate <game-id>`

```bash
npm run sw2d -- validate my-game
```

The full ladder, in order, each step gating the next:

1. Schema/content validation + unit tests (`vitest run games/<game-id>/tests`) - the generated
   `tests/content.test.ts` *is* the schema check.
2. TypeScript (`tsc --noEmit`).
3. Production build (`vite build`).
4. Real-browser smoke (only if 1-3 passed and a system browser is available): boots the built
   game, presses CONFIRM, and asserts the play scene came up with every declared system pack
   actually installed.

**If no system browser is available, `validate` reports "INCOMPLETE" and exits `1` - it never
reports success on a ladder it could not fully run.**

## `build <game-id>`

```bash
npm run sw2d -- build my-game
```

Production build only (`vite build`) - `games/<game-id>/dist/`.

## `pack <game-id>`

```bash
npm run sw2d -- pack my-game
```

Builds, then copies `dist/` to a clean `games/<game-id>/pack/` (removing any previous pack
first - never incremental), then runs the offline-build guard
(`tools/scripts/check-offline-build.mjs`) against it. Fails if the pack is not a clean, static,
fully offline-capable bundle.

## Safety invariants every command shares

- Slugs (`game-id`, `level-id`, `theme-id`) must match `^[a-z][a-z0-9-]*$` - no path separators,
  no `..`, no leading dot (`packages/cli/src/slug.ts`).
- Every write is resolved and contained under its root (`GAMES_ROOT`/`DEMOS_ROOT`) before use -
  a resolved path that would escape the root throws before anything is written
  (`packages/cli/src/paths.ts`).
- No command ever overwrites an existing target. There is no `--force`.
- `REPO_ROOT` is resolved from the CLI's own file location, never `process.cwd()` - commands
  behave identically regardless of the directory they're invoked from.
