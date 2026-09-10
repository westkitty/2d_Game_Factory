# Architecture Decision Records

One short record per decision that constrains later work. No ADR for trivia.

| # | Decision | Phase |
|---|---|---|
| [0001](0001-phaser-as-the-runtime.md) | Phaser 4 is the game runtime | 1 |
| [0002](0002-package-boundaries.md) | contracts / runtime / game package split | 1 |
| [0003](0003-semantic-input-ownership.md) | One frame owner, and presses are claimed | 1 |
| [0004](0004-context-services-vs-system-packs.md) | Core services on GameContext, options as packs | 1 |
| [0005](0005-content-loading-boundary.md) | The runtime consumes bundles, never files | 1 |
| [0006](0006-offline-by-construction.md) | Offline is structural, and it is checked | 1 |
| [0007](0007-persistence-model.md) | Namespaced, versioned, corruption-tolerant saves | 1 |
| [0008](0008-phase1-validation-strategy.md) | Phase 1 validation ladder; Playwright deferred | 1 |
| [0009](0009-controller-families.md) | Controllers interpret intent; never physical input or gameplay | 3 |
| [0010](0010-pack-config-validation.md) | Pack config validation is dependency-inverted, not imported | 4 |
| [0011](0011-capability-id-governance.md) | Capability ids are namespaced `<family>.<service>` | 5 |
| [0012](0012-gameplay-events-belong-to-their-package.md) | Gameplay events are declared by the package that raises them | 5 |
| [0013](0013-composition-root-enforces-pack-declarations.md) | A pack's declarations are enforced where the game is composed | 5 |
| [0014](0014-content-pipeline-and-entity-registry.md) | A dedicated content-pipeline package, entity-registry capability, and theme contract | 6 |
| [0015](0015-preset-catalog-and-pack-metadata-boundary.md) | The preset catalog reaches pack identity through side-effect-free subpaths | 7 |
| [0016](0016-aim-as-a-digital-axis-not-spatial-pointer.md) | Aim is a fourth digital axis, not spatial pointer | 8 |
| [0017](0017-pack-config-source-json-or-code.md) | A pack declares whether its config is JSON or code | 9 |
| [0018](0018-spatial-pointer-input-ownership.md) | Spatial pointer is a scene service, not part of ActionInput | Capability program 1 |
| [0019](0019-data-driven-items-and-effects.md) | Data-driven items: one pack, one bounded effect union | Capability program 2 |
| [0020](0020-weapons-model-in-a-pack-projectiles-in-the-runtime.md) | Weapon model is a pack; projectiles are a runtime bridge | Capability program 3 |
| [0021](0021-encounter-orchestration-model-and-runtime.md) | Encounter orchestration: bounded data model + runtime bridge | Capability program 4 |
| [0022](0022-navigation-grid-capability.md) | Navigation is a pure grid capability, separate from AI state | Capability program 5 |
| [0023](0023-data-driven-puzzle-rules.md) | Standard puzzle rules are a bounded data-driven capability | Capability program 6 |
| [0024](0024-deterministic-procedural-generation.md) | Deterministic procedural generation: one bounded capability that emits NormalizedLevel | Capability program 7 |
| [0025](0025-world-graph-rooms-transitions-map.md) | World graph, room transitions and map: one capability that composes with world.state | Capability program 8 |
| [0026](0026-optional-advanced-physics-and-constraints.md) | Advanced physics is an opt-in Matter profile with a renderer-neutral service | Capability program 9 |
| [0027](0027-vehicle-handling-and-racing.md) | Vehicle handling and race state are two separate pure capabilities; the controller stays intent-only | Capability program 10 |
| [0028](0028-customer-demand-transaction-production-economy.md) | Customer demand, stock, transactions and production jobs are one reusable economy capability | Category-C Wave 1 |
| [0029](0029-creature-habitat-companion-needs.md) | Creature, habitat and companion needs are one reusable care capability | Category-C Wave 2 |
| [0030](0030-branching-dialogue-graphs.md) | Branching dialogue graphs, choices, flags and endings are one reusable narrative-presentation capability | Category-C Wave 3 |
| [0031](0031-stealth-perception-suspicion-hiding.md) | Vision cones, suspicion, noise and hiding are one reusable perception capability | Category-C Wave 4 |
| [0032](0032-arcade-ball-paddle-rebound.md) | Ball, paddle, rebound, brick-clear and first-to-N scoring are one reusable arcade capability | Category-C Wave 5 |
| [0033](0033-combat-melee-knockback.md) | Melee strike, knockback and hit-stun are one reusable close-combat capability | Category-C Wave 6 |
| [0034](0034-local-multiplayer-input-ownership.md) | Local hot-seat and versus seats are one reusable input-ownership capability | Category-C Wave 7 |
| [0035](0035-scrolling-stage-camera.md) | Horizontal and vertical scrolling stages are one reusable camera capability | Category-C Wave 8 |
| [0036](0036-puzzle-board-match-and-falling-block.md) | Match and falling-block engines are consumed, not a new pack | Category-C Wave 9 |
| [0037](0037-visual-timing-windows.md) | Visual reaction and beat windows are a timing pack | Category-C Wave 10 |
| [0038](0038-consume-weapons-in-vehicle-and-pointer-shells.md) | Consume existing weapons in vehicle and pointer shells | Category-C Wave 11 |
| [0039](0039-consume-puzzle-code-seam-in-pointer-shell.md) | Consume the puzzle code seam in the pointer shell | Category-C Wave 12 |
| [0040](0040-consume-simulation-ledger-in-farm-and-colony-shells.md) | Consume the simulation ledger in farm and colony shells | Category-C Wave 13 |
| [0041](0041-consume-narrative-store-in-if-and-investigation-shells.md) | Consume the narrative store in IF and investigation shells | Category-C Wave 14 |
| [0042](0042-consume-arcade-score-in-fishing-and-cooking-shells.md) | Consume arcade score in fishing and cooking shells | Category-C Wave 15 |
