# ADR-0006: Offline is structural, and it is checked

- Status: accepted
- Date: 2026-08-24
- Phase: 1 (Opus 5)

## Context

`MASTER_PROJECT.md` §3.5 requires zero required external network requests at runtime: no CDN,
no Google Fonts, no telemetry, no remote config, no third-party asset fetch. §32 asks for a
test that fails when a production build reaches outside its origin.

## Decision

Make it structural first, then verify it.

- Fonts are system stacks (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`). No
  webfont, no font loader, no `ctx.font` monkey-patching.
- Placeholder art is generated in-process. Real art, when it exists, is an `image` asset served
  from the game's own `public/`.
- Audio cues are synthesised with Web Audio oscillators. No audio files.
- Dependencies are bundled by Vite. `base: './'` keeps output portable to any static host.
- No analytics, telemetry, error reporting or remote config exists to be disabled.

`npm run check:offline` (`tools/scripts/check-offline-build.mjs`) scans the build output for the
constructs that actually cause a request - HTML `src`/`href`, CSS `url()` and `@import`, dynamic
and static `import` from an absolute URL, `importScripts`, `fetch`, `XHR.open` - plus a
denylist of known CDN and webfont hosts. Bare URLs in comments and licence headers are reported
but do not fail, because they are not requests.

## Consequences

- The check is part of `npm run validate` and gates the commit.
- It is a fast structural guard, not proof. The decisive evidence is browser-level: a
  production build was observed loading exactly two same-origin resources and nothing else
  (`docs/qa/PHASE1_VALIDATION.md`).
- If a PWA service worker is added later it must version its cache and be tested for update
  behaviour, so a stale cache cannot hide a broken build (`MASTER_PROJECT.md` §32).

## Rejected

- **Failing on any `https://` string.** Phaser's own banner and licence headers contain URLs;
  a check that cries wolf gets disabled.
- **Relying only on the browser check.** It needs a running server and a driven browser, so it
  cannot gate every commit.
- **Direct `file://` execution as a requirement.** Explicitly out of scope
  (`MASTER_PROJECT.md` §32); a static HTTP server is the baseline.
