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
| waves completed | 0 (inventory) |
| limitations closed | 0 / 69 entries (0 / 52 distinct) |
| remaining machine-executable | 69 |
| blockers | none |
| next exact action | Wave 1: `sw2d.pursuit` pack + ledge grammar in `sw2d.wall`; integrate into platform shell; journeys for chase-platformer, endless-runner, auto-runner, precision-platformer, climbing-game |

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

## Validation evidence

(appended per wave)
