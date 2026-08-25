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
