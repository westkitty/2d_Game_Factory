# ADR-0005: The runtime consumes bundles, never files

- Status: accepted
- Date: 2026-08-24
- Phase: 1 (Opus 5)

## Context

`MASTER_PROJECT.md` §3.2 requires machine and game to be separable, §11-§14 describe a
schema-validated content model and theme packs, and §20 says the first proofs should prefer
code-drawn shapes so asset sourcing never blocks engine work.

## Decision

The runtime never reads a file, fetches a URL or parses game data. It consumes a
`ContentBundle` produced by a `ContentSource`:

```ts
interface ContentSource { id: string; load(): Promise<ContentBundle>; }
interface ContentBundle { id; schemaVersion; assets; ui?; data; }
```

- Gameplay asks `AssetCatalog.resolve(role)` for a **semantic role** (`player`, `platform`,
  `pickup`, ...) and gets a texture key. A missing role throws naming the role and what the
  bundle does supply.
- An asset is `generated` (drawn in-process from a spec) or `image` (a same-origin file).
  Phase 1 uses only `generated`.
- UI wording lives in `ContentBundle.ui`. The runtime supplies neutral fallbacks and knows
  *that* the game is paused, not what the game calls pausing.

## Consequences

- The foundation runs before any art exists, and the production build has nothing to fetch.
- Swapping a theme changes what is drawn without touching gameplay code.
- Phase 2 replaces the inline source with a schema-validated JSON source and the runtime does
  not change, because it only ever saw a `ContentBundle`.
- `ContentBundle.data` is deliberately open (`Record<string, unknown>`) in Phase 1. Phase 2
  gates every entry through JSON Schema. This is the one place Phase 1 leaves a type hole, and
  it is load-bearing that Phase 2 closes it.

## Rejected

- **Loading assets directly in runtime scenes.** Couples the machine to a game's file layout.
- **Bundling placeholder PNGs.** Binary art in the repo with no licensing story, when a
  rectangle drawn at boot is smaller, clearer and provably local.
- **Baking UI copy into runtime scenes.** `MASTER_PROJECT.md` §15 forbids it, and it is how a
  reusable runtime quietly becomes one game's runtime.
