# Project format

A workbench project **is** an ordinary generated SW2D game. The workbench adds
a metadata directory beside it and writes nothing else that the runtime does
not already consume.

```
games/<game-id>/
├── .sw2d/                        workbench metadata - never shipped
│   ├── project.json              preset, display name, panel state, adopted flag
│   ├── assets.json               every source and derived asset
│   ├── blueprint.json            role assignments, palette, seed
│   ├── imports.json              import batch history
│   ├── cache/                    disposable: thumbnails, import staging
│   └── source-assets/            immutable imported originals
├── public/assets/workbench/      derived, game-local, same-origin runtime art
├── content/
│   ├── game.json                 GameDefinition
│   ├── tuning.json
│   ├── themes/default/theme.json ThemeManifest - what the game draws
│   └── levels/main.json          Tiled-shaped level
├── resources/RESOURCE_MANIFEST.json
├── src/game-specific/            starter-kit / shell code
└── ...                           the rest of the canonical generated game
```

Delete `.sw2d/` and you still have a perfectly good SW2D game. You lose the
workbench's memory of how it was assembled - which `adopt on open` can largely
rebuild from the native documents.

---

## Nothing in `.sw2d/` is read at runtime

The runtime consumes `content/**` and `public/**`. It has no idea the workbench
exists. `.sw2d/` is not under `public/`, so Vite never copies it into `dist/`,
and `pack/` is a copy of `dist/` - so workbench metadata cannot reach a release
even by accident. The `WB-BUILD-001` journey asserts that against the release
manifest's own file inventory.

---

## Asset records

```ts
interface AssetRecord {
  id: string;                 // src_<16 hex> | der_<16 hex>  - stable forever
  kind: 'source' | 'derived';
  displayName: string;
  relativePath: string;       // project-relative, never absolute
  mime, width, height, byteSize, sha256;
  sourceAssetId?: string;     // derived only
  transformRecipe?: TransformRecipe;
  roleAssignments: AssetRole[];
  palette?: string[];
  provenance: Provenance;
  stale?: boolean;            // source changed, not yet rebuilt
  group?: string;             // frame-group hint, never load-bearing
  frameIndex?: number;
  folder?: string;            // library grouping only
}
```

**The id is the identity.** It is minted from the first content hash plus an
ordinal and then frozen. Renaming the asset, moving the file, or reimporting
entirely new bytes all change metadata and none of them changes the id - which
is what makes role assignments and derivative lineage survive those operations.

Paths in metadata are always project-relative. Nothing portable ever records an
absolute machine path.

---

## Atomic writes and versioning

Every `.sw2d/` document carries a `version` and is written temp → fsync →
rename, so a crash mid-save leaves either the previous complete document or the
new one, never half-JSON.

A document whose version this workbench does not understand is an **error**,
not a silent reset. So is malformed JSON. Quietly replacing a corrupted asset
index with an empty one would turn a recoverable problem into "you have no
assets".

---

## What the workbench writes into the game

| File | When | What |
|---|---|---|
| `content/themes/default/theme.json` | any role or provenance change, any import that assigns a role, any reimport | assigned roles become `{ kind: 'image', url: 'assets/workbench/…' }`; the rest become `{ kind: 'generated' }` from the palette |
| `public/assets/workbench/*` | same | the actual bytes, copied when the destination's content differs |
| `content/levels/*.json` | Scene Composer save | validated Tiled-shaped level |
| `content/game.json`, `content/tuning.json`, `src/game-specific/**` | project creation | the starter kit's overlay |
| `resources/RESOURCE_MANIFEST.json` | any synthesis | one record per shipped asset, status derived from provenance |

The texture key for an image-backed role embeds the asset's content hash
(`wb/default/player/3735246b…`). That is not decoration: Phaser's texture cache
is keyed by string and the loader skips keys that already exist, so a
stable-per-role key would make a live asset swap silently keep the old pixels
on a warm cache.

---

## Adopting a project the workbench did not make

Opening a project with no `.sw2d/` reads the preset from `package.json` and the
palette from the existing theme's generated fills, then writes `project.json`
and `blueprint.json`. **No game file is touched**, so adopting cannot break a
project. It is marked `adopted: true` and the top bar says so.

`demos/` and `proofs/` are committed reference material and are not adoptable in
place - generate a new project from the same preset and remix that instead.
