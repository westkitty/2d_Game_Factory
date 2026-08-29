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
