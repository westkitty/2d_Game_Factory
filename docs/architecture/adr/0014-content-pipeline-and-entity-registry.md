# ADR-0014: A dedicated content-pipeline package, an entity-registry capability, and the theme contract

- Status: accepted
- Date: 2026-08-25
- Phase: 6 (Sonnet 5)

## Context

Phase 6 needed three closely related capabilities the Phase 1-5 architecture had no home for:

1. Turning a Tiled JSON export into something the runtime can consume without every scene
   re-parsing Tiled's own on-disk format.
2. A place to register "what does this semantic object class do", separate from the runtime and
   separate from any one game.
3. A theme contract that supplies presentation for the runtime's existing semantic asset roles
   without the runtime knowing a theme exists.

None of these are `@sw2d/schemas`' job (Ajv-based JSON Schema validation) and none are a
`@sw2d/packs` job in the Phase 4 sense (a renderer-independent gameplay-state capability with one
config shape). Forcing them into either package would have blurred a boundary Phase 5's gate
explicitly praised for staying narrow.

## Decision

**A new package, `@sw2d/content-pipeline`.** Depends on `@sw2d/contracts` only - no Ajv, no
Phaser. It owns the parts of Tiled ingestion JSON Schema cannot express cleanly (an object's
required properties differ per semantic class, and a useful error names the exact object and
property), following the same "hand-written cross-field rule" precedent `validatePresetComposition`
already set in `@sw2d/schemas`. It also owns theme resolution (`resolveTheme`), a pure function
folding a validated `ThemeManifest` and the live accessibility projection into what a game
presents.

**Three new shared data types live in `@sw2d/contracts`**: `NormalizedLevel`/`NormalizedLevelObject`
(`level.ts`), `ThemeManifest` (`theme.ts`), `ResourceRecord`/`ResourceManifest` (`resources.ts`).
Same reasoning as `AssetDescriptor`/`ContentBundle` already there: three packages
(`content-pipeline`, `schemas`, `packs`) need to agree on one shape without any of them depending
on either of the others' implementation. This is data, not a `GameContext` field - it does not
reopen `GameContext`, which stays exactly as Phase 5 left it.

**The output of `normalizeTiledMap`, not raw Tiled JSON, is what `@sw2d/schemas` validates**
(`level-document.schema.json`, registered as a `ContentBundle.data` document under the
`levels/<id>` prefix). Two-stage validation, mirroring the existing split: content-pipeline
transforms and does semantic checks a schema cannot express (unknown class, missing required
property, unsupported Tiled feature); schemas re-validates the transform's own output shape at the
content boundary, the same guarantee `tuning.json` already has. Raw Tiled JSON itself is not
schema-validated - Tiled's on-disk format is an authoring-tool detail this factory does not commit
to mirroring in JSON Schema.

**The entity registry is a tenth `@sw2d/packs` capability, `world.entities`**, alongside
`worldPack`'s existing `world.state` - exactly the `<family>.<service>` room ADR-0011 reserved for
it. It is Phaser-free: `register(classId, factory)` / `dispatch(object, context)`, where a factory
is any `(object, context) => result` function. Rendering factories are registered by scene-scoped
game code (`starter/src/game-specific/tiledLevelPack.ts`), typed against `SceneContext` at the call
site - the same widening-cast precedent Phase 4 accepted for `puzzlePack`'s `PuzzleService<TState>`,
not a new pattern.

**The object-class catalog is fixed at eighteen required classes plus one addition, `Solid`.**
`Solid`-classed objects on an object layer are how Phase 6 represents collision/platform geometry;
they are routed into `NormalizedLevel.solids`, not `.objects`, and never reach the entity registry.
MASTER_PROJECT.md section 13.1 explicitly permits system packs to register classes beyond the
required eighteen; nineteen fixed classes, not an extensible registry, is Phase 6's deliberately
bounded choice - see "Rejected" below.

**Supported Tiled subset**: orthogonal, finite maps; `tilelayer` (recorded as name/dimensions only
- see the next paragraph) and `objectgroup` layers; objects with a numeric `id`, an x/y/width/height
rectangle, a `class` (or legacy `type`) naming a catalog class, and string/int/float/bool custom
properties. `class`/`type` resolve to the same field; Tiled has used both names for the same
concept across versions.

**Rejected explicitly, with a named error**: any orientation other than `orthogonal`; `infinite`
maps (chunked tile data); any layer type other than `tilelayer`/`objectgroup` (group layers, image
layers); an object whose class is not in the catalog, in strict mode (the default) - `strict: false`
skips it with a console warning instead, per MASTER_PROJECT.md section 35's "fail or warn according
to configured strictness".

**Tile *image* rendering is explicitly out of scope this phase.** `normalizeTiledMap` records a
tile layer's name and dimensions; it does not read `data` (the per-cell GID array), resolve
tileset firstgid arithmetic, or draw tiles. Every visual and collidable surface in the Phase 6
proof comes from object-layer `Solid` rectangles rendered with the existing generated-texture
pipeline (`createGeneratedTextures`), consistent with the project's no-binary-art baseline. A tile
layer therefore currently proves "this pipeline recognises the layer type and its metadata", not
"this pipeline renders a tilemap". Reopening this needs a real tileset image (a resource-governance
decision) and is a bounded future extension, not a defect.

**Theme contract.** `ThemeManifest` carries `assets` (the same `AssetDescriptor[]` shape
`ContentBundle.assets` already uses), `tokens`/`highContrastTokens` (a small CSS-custom-property
palette for DOM UI), `fonts` (system stacks only) and an optional `ui` copy override. Never
gameplay/tuning/system-pack data - enforced structurally, not by convention: `resolveTheme` only
ever reads and returns those four fields. A theme swap is therefore a different `ContentSource`
answer for `assets`/`ui`, not a different answer for `data` - two content sources loading the same
level with different themes produce byte-identical `data['levels/intro']`, asserted directly in
`starter/test/tiledProofContent.test.ts`.

**`highContrastTokens` is the accessibility/theme integration point.** `resolveTheme(theme,
accessibility)` swaps in a theme's `highContrastTokens` (falling back to the base token per field)
exactly when `accessibility.highContrast` is true - the first real render of a setting Phase 1-5
persisted and projected but nothing ever drew differently for
(`OPERATIONAL_STATE.md`'s "Implemented but unverified" list). Reduced motion gets the same
treatment for the one new motion Phase 6 introduces (the touch-button active-state transition):
`--sw2d-motion-duration` is set to `0ms` when `accessibility.reducedMotion` is true.

**`AccessibilityStateImpl.refreshEnvironment()` is now wired**, inside `createGame` (`packages/runtime/src/core/createGame.ts`),
to `matchMedia('(prefers-reduced-motion: reduce)')`/`matchMedia('(pointer: coarse)')` change events -
guarded exactly like `readAccessibilityEnvironment()` already is, so environments without
`matchMedia` (Vitest's Node environment) get no listener rather than an error. This was flagged in
Phase 5's gate as "no caller re-reads media queries yet"; it is a small, disposed-via-`rootBag`
addition to an existing file, not a new capability, and its trigger is exactly what
MASTER_PROJECT.md section 12 asked for ("if the new theme/UI layer provides a natural consumer").

## Consequences

- Authoring a new level is `content/levels/<id>.json` plus one line selecting it as a content
  document - no `packages/**` change, matching the protected boundary.
- The nineteen-class catalog and the entity registry are two different concerns that happen to
  compose: a class can be catalog-valid (normalizes, validates) with no registered factory
  (`OBJECT_CLASS_CATALOG` has all eighteen-plus-`Solid`; only five of the proof level's classes have
  a starter-side factory) - "not every class needs full gameplay behaviour in Phase 6" is therefore
  mechanically true, not just a policy statement.
- `starter/src/game-specific/tiledLevelPack.ts` is a second worked example of the protected
  boundary, alongside `placeholderMoverPack.ts`: it adds real behaviour (checkpoint activation via
  the existing `worldPack`, collectible/hazard counters, an exit flag) entirely from the game side,
  reading `platformController` intent exactly as the first worked example does.
- `@sw2d/packs` gained a dependency-free-of-Phaser tenth capability without touching any of the
  nine Phase 4 packs or their events.

## Rejected

- **Making the object-class catalog a runtime-extensible registry** (packs registering their own
  classes at boot) instead of a fixed list plus `Solid`. MASTER_PROJECT.md section 13.1 permits it
  in principle, but Phase 6 has exactly one real consumer (the starter's proof level) and no second
  one yet - building the extension point now would be exactly the "abstraction with no consumer"
  invariant 14 forbids. Revisit when a second content-authoring consumer (a preset, Phase 7+) needs
  a class the fixed eighteen-plus-one do not cover.
- **Rendering actual Tiled tile layers this phase.** Would need a real tileset image, which is a
  resource-governance decision (`docs/resources/VISUAL_ASSET_MANIFEST.json`) Phase 6's proof level
  does not need: every required semantic surface (ground, platforms) is representable as `Solid`
  object-layer rectangles today. Recorded as a known limitation, not silently dropped.
- **Live, in-page theme hot-swapping** (changing the selected theme without a reload). The
  `ContentBundle` a running game holds is loaded once at `createGame()` time
  (`ContentSource.load()` has always been a one-shot call); making it swappable live is a bigger,
  unrequested runtime change. The Tiled-proof page instead selects its theme once, from a URL query
  parameter, at load time - proven by loading the same level twice under two themes, which is what
  MASTER_PROJECT.md section 9 actually asks for ("a test can prove the same level/game behaviour
  survives a theme swap").
- **Wiring the Tiled proof into the existing `index.html`/`starter/src/main.ts` in place of
  `placeholderMoverPack`.** Would risk the already-verified Phase 1-5 browser journey for no
  required reason - MASTER_PROJECT.md section 8 explicitly allows "a dedicated small Phase 6
  content fixture" instead. `tiled-proof.html` is a second static entry in the same Vite build
  (`starter/vite.config.ts` `rollupOptions.input`), fully covered by `npm run build` and
  `npm run check:offline`; `placeholderMoverPack.ts` and everything that wires it are untouched.
