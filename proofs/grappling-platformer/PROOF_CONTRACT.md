# Proof Contract — grappling-platformer

Capability program Phase 9 (optional advanced physics & constraints, ADR-0026) - the grapple consumer. Written retroactively by the Category-C convergence program from the committed spec (`packages/qa/proof-specs/grapplingPlatformer.ts`) and the PROOF_MATRIX row; the proof game itself is frozen and unchanged.

## Preset

`grappling-platformer` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world`, `sw2d.world-entities` (`physicsProfile: 'matter'`). Content roles tuning, levels.

## Reusable capability exercised

- `createAdvancedPhysics` (Matter-backed `AdvancedPhysicsService`); `createGrappleService` (a near-rigid distance constraint player↔anchor); named collision categories. The player is a Matter body moved by impulses; SECONDARY_ACTION toggles the grapple; INTERACT/CANCEL reel the rope.

## Terminal success/failure oracle

- **Success surface:** `physicsEnabled`, `constraintCount 0`, 2 eligible anchors; attach -> `constraintCount 1`, `grappleAttached`; the anchor distance stays near the rope length while the position changes (a real pendulum); detach -> 0; re-attach; reel in shortens the rope; restart -> no constraint survives, body count back to fresh.
- **Failure surface:** `constraintCount`, `grappleAttached`, rope length vs anchor distance, body count.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`physicsEnabled`, `constraintCount 0`, 2 anchors).
2. Move under an anchor; attach -> `constraintCount 1`, `grappleAttached`.
3. Swing: anchor distance ≈ rope length while position changes.
4. Detach -> `constraintCount 0`; re-attach; reel in -> rope shorter.
5. Restart -> no constraint, fresh body count.

## Acceptance

- No scripted swing.
- Zero console errors, zero external requests.
