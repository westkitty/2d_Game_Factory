# Wave 8 continuation intent

Slice Card:
- Goal: close L42-L45 with authored dialogue presentation, parser interaction, evidence deduction, museum presentation, outcomes, restart, and browser proof in freshly generated games.
- Parent plan/spec: `docs/architecture/FINAL_PRODUCT_COMPLETION_STATE.md` and `docs/architecture/FINAL_PRODUCT_COMPLETION_MATRIX.md`.
- Files: existing dialogue/narrative/codex contracts, schemas, packs, binders, generators, preset catalog, proof/completion journeys, and durable state documents.
- Boundary: work only in `~/2d_game_factory/final-completion`; preserve existing dialogue/narrative/codex ownership; do not touch the protected worktree or create duplicate state systems.
- Verification: typecheck, focused tests, five fresh completion journeys, proof refresh/check, five committed-proof journeys, extractor, diff check, commit, and push.
- Stop: Wave 8 is checkpointed only with generated-browser proof; the program proceeds to Wave 9 until the extractor reaches zero.

BaselineUsageDraft:
- Required: final-product state, final-product matrix, current branch/remote SHA, live limitation extractor.
- Acknowledged: Wave 7 checkpoint `e94615fe02807013867a9f68c6af4aa9a632d233`; extractor baseline 15 machine-executable entries.
- Missing: none.
- Decision: continue Wave 8.

ImpactStatementDraft:
- Extends the canonical dialogue, narrative, and codex owners plus generated presentation. No new network, account, renderer, persistence, or protected-worktree surface.
