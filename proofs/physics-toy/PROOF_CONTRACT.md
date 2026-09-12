# Proof Contract — physics-toy

Capability program Phase 9 (optional advanced physics & constraints, ADR-0026) - the springs-and-shake consumer. Written retroactively by the Category-C convergence program from the committed spec (`packages/qa/proof-specs/physicsToy.ts`) and the PROOF_MATRIX row; the proof game itself is frozen and unchanged (Wave 24 left it on Matter deliberately).

## Preset

`physics-toy` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `pointer`, required packs (none required; `physicsProfile: 'matter'`). Content roles tuning.

## Reusable capability exercised

- `AdvancedPhysicsService` bodies, `createSpring`, Phase-1 `context.interaction` + `context.spatialPointer`: three rigid balls + a box fall onto a static floor between two walls and a ceiling; a spring links two balls; a click on the centre target shakes every dynamic body.

## Terminal success/failure oracle

- **Success surface:** `bodyCount >= 7`, `constraintCount 1`; the balls settle above the floor; the spring keeps the linked balls within a bounded distance; a spatial-pointer click (`hoveredId 'shaker'`) shakes them upward; they settle again with the spring intact; restart restores the fresh body/constraint counts and clears the shake count.
- **Failure surface:** `bodyCount`, `constraintCount`, ball positions, `hoveredId`, shake count.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`bodyCount >= 7`, `constraintCount 1`).
2. Balls fall and settle above the floor.
3. Linked balls stay within the spring bound.
4. Click the shaker (`hoveredId 'shaker'`) -> bodies move upward; settle again, spring intact.
5. Restart -> fresh counts, shake count 0.

## Acceptance

- Zero console errors, zero external requests.
