# Final Product Completion - durable state

Read this first when resuming. The matrix
([`FINAL_PRODUCT_COMPLETION_MATRIX.md`](FINAL_PRODUCT_COMPLETION_MATRIX.md)) is the ledger; this
file is the cursor.

## Fixed facts

- Starting `origin/main`: `0d00d4a7ae8ca482f1c4b2786e9e409961579355` (verified = accepted baseline).
- Branch: `claude/final-product-completion`; worktree `~/2d_game_factory/final-completion`.
- Protected: `~/2d_game_factory/2d_Game_Factory` (branch `candidate/antigravity-post-ten-program`,
  dirty AntiGravity work) - never checked out, stashed, reset, cleaned, modified, committed, rebased or
  deleted by this program.
- Gate: `npm run limitations:extract` (`tools/scripts/extract-limitations.ts`) must print
  `ZERO-LIMITATIONS GATE: PASS`.

## Cursor

| field | value |
|---|---|
| branch SHA | (see git log; updated per checkpoint below) |
| waves completed | 1 (inventory, platforming movement) |
| limitations closed | 5 / 69 entries (L01-L03; 3 / 52 distinct) |
| remaining machine-executable | 64 |
| blockers | none |
| next exact action | Wave 2: melee combos (L04), twin-stick opposition (L05), survivor escalation + `sw2d.runs` (L06/L08), dungeon room enemies (L07), stealth AI (L09) |

## Checkpoint log

### Wave 0 - inventory
- Created worktree/branch from `0d00d4a`. `npm ci` clean (0 vulnerabilities).
- Extracted 69 entries / 52 distinct texts programmatically; wrote the matrix (L01-L53, X01-X02).
- Added `tools/scripts/extract-limitations.ts` + `npm run limitations:extract` (currently FAIL, 69).
- Proof inventory: 43 of 74 `proofs/<id>/` directories are byte-identical (or template-drift-only)
  canonical factory output; 31 are pre-program hand-authored proofs. Program policy: canonical
  proofs are regenerated from the factory after each wave (`tools/scripts/refresh-canonical-proofs.ts`,
  Wave 1); hand-authored proofs are kept and every changed preset additionally gets a fresh
  generated-game journey (`npm run qa:completion`).

### Wave 1 - platforming movement (L01, L02, L03)
- New reusable pack `sw2d.pursuit` (`movement.pursuit`): `wall` (closing wall) and `chaser` (trailing pursuer that closes while the runner stumbles) modes from `content/pursuit.json`. Consumers: chase-platformer, endless-runner, auto-runner (all now require it).
- `sw2d.wall` ledge grammar: authored ledges, `grounded/airborne/sliding/ledge-hang/climbing` state machine, climb/drop/hang-jump/release, regrab lockout; platform shell pins the body while hanging. Fixed Wave 30's inverted slide/kick direction.
- New program tooling: `npm run qa:completion` (fresh generate → tsc → vite build → real-Chrome journey, `packages/qa/completion-specs/`), `npm run proofs:refresh` / `proofs:check` (canonical proofs regenerated from the factory; 51 canonical, 23 hand-authored), `npm run docs:presets` (mechanical preset-doc tables).
- Honesty test inverted into a closed-limitations regression guard (`packages/presets/test/honesty.test.ts`).

## Validation evidence

### Wave 1
- `npm run typecheck` PASS; `npx vitest run` 208 files / 4160+ tests PASS (includes `pursuit.test.ts`, extended `wall.test.ts`, Wave 1 generate tests).
- `npm run qa:completion` 5/5 PASS (chase-platformer, endless-runner, auto-runner, precision-platformer, climbing-game) - fresh factory output, system Chrome.
- `npm run qa:proof -- chase-platformer endless-runner auto-runner precision-platformer climbing-game traditional-platformer` 6/6 PASS.
- `npm run limitations:extract`: 64 machine-executable remain (was 69).
