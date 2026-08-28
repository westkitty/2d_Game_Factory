# Free sprite sourcing

The workbench can find coherent, free-to-use **raster** sprite packs that fit the
game being made, check their rights, let the user audition them, and map them onto
semantic roles through the ordinary import pipeline. This is an authoring feature;
a finished game never depends on it.

## The flow

```
game / preset ──▶ Sprite Requirement Profile ──▶ ranked packs ──▶ rights check
                                                                       │
                       playable local game ◀── canonical import ◀── audition
```

- **Requirement profile** (`workbench/server/sources/requirements.ts`) is derived,
  not hand-written: the controller family implies the camera, the starter kit's
  `usefulRoles` are the genre's real mechanic-driven roles, and a small
  controller-family default covers presets without a kit. Role importance is a
  property of the role, applied the same way across genres.
- **Matching** (`matching.ts`) is deterministic. Hard gates (rights acceptable,
  usable PNG) exclude a candidate outright - no score buys past a licence failure.
  Every point in the score is traceable, and the "why this fits" lines come from
  the same checks. A single coherent pack that covers the core roles beats a
  scattering of partial matches.
- **Reverse discovery** (`reverse.ts`) runs the same matcher backwards: given a
  pack, rank the presets it could serve. Compatibility is decided from real role
  coverage, never genre labels.

## Provider architecture

`workbench/server/sources/` is a **closed** provider registry. One provider ships:
Kenney (`kenney.ts`), whose packs are CC0 1.0 with no attribution obligation. The
catalogue (`catalog.ts`) is hand-verified data - provider id, pack id, source
page, download URL, SPDX licence, the evidence URL and the date it was checked -
not a crawler.

### Adding a provider safely

1. Add its exact hostname(s) to `PROVIDER_HOST_ALLOWLIST` in `net.ts`.
2. Add a `SourceProvider` implementation (`listCandidates` / `getCandidate` /
   `download` / `online`) and one line in `registry.ts`.
3. Every candidate must carry a real licence id and evidence URL. Rights are
   evaluated by `evaluateRights` against `resource-policy.json`'s
   `acceptableLicenses` - there is no second policy. A mixed-licence source
   (e.g. OpenGameArt) must verify **each** item; site-wide permission is never
   assumed.
4. Do not widen `net.ts`. There is no `fetch(url)` a caller can steer: URLs come
   from provider code, hosts are re-checked on every redirect hop, and any
   hostname that resolves to loopback/private/link-local/CGNAT space is refused.

## The authoring-only network boundary

`net.ts` is the **only** outbound path in the workbench. It is HTTPS-only,
per-provider host-allowlisted, DNS-guarded, size-capped and timeout-bounded.
Provider requests happen only when the user explicitly acts (opening Find Free
Sprites, acquiring a pack). Nothing on a required path makes a network request,
and none of this code is reachable from a generated game.

## Verified local vault

`vault.ts` caches acquired pack bytes at `workbench/.sw2d-vault/` (gitignored;
`SW2D_VAULT_DIR` overrides the location), keyed by SHA-256 so identical downloads
dedupe. Each entry keeps the **licence/provenance snapshot taken at acquisition**;
a later policy change never rewrites it. `acquirePack` checks the vault before the
network, so a pack acquired once re-acquires offline.

Freshness is recomputed on read and `reverify` re-checks the recorded licence
against the current policy. A stale entry stays usable for what was already built;
staleness never becomes silent invalidity.

**The vault is authoring infrastructure, not runtime.** A generated game holds its
own local copies of everything it uses. Deleting the vault, or any entry, cannot
break an existing or packed game, and no game ever reads the vault path.

## Offline runtime guarantee

Acquired sprites are staged and committed through the same
`stage → analyse → plan → commit` flow local imports use. The commit copies bytes
into `games/<id>/public/assets/workbench/`, writes them into the theme as
same-origin `{ kind: 'image' }` descriptors, and records real provenance in
`games/<id>/resources/RESOURCE_MANIFEST.json`. `sw2d pack` refuses a game with
unknown/unsupported provenance, and now also writes
`THIRD_PARTY_ASSET_NOTICES.txt` - human-readable credits grouped by source, with
licence, attribution obligation and the exact shipped file list. The offline guard
(`check:offline`) still passes: the packed game contains no remote URL on any path.

## SVG

SVG is recorded but never used. `stagePack` skips `.svg`/`.svgz` entries (and PNG
files that are actually SVG text) with a counted reason; a pack whose only usable
images are SVG reports `svgOnly` and is treated as unsuitable. There is no
SVG-to-PNG conversion.
