# Stinky Weasel 2D Browser Game Factory
## Claude Code Master Project Plan — Opus 5 / Sonnet 5 Routed Build
### Canonical repository: `https://github.com/westkitty/2d_Game_Factory`
### Repository slug: `westkitty/2d_Game_Factory`

> This document is both the master project specification and the execution prompt for Claude Code.
>
> Treat it as the governing source of truth for the initial build unless the user gives a newer explicit instruction.
>
> This file is the full project plan and governing contract. Individual Claude Code sessions should execute only their assigned phase.
>
> **Routing rule:** Sonnet 5 is the default implementation model. Opus 5 is reserved for Phase 1 and the explicit architecture/acceptance gates.

---

# 0. EXECUTIVE DIRECTIVE

You are Claude Code. Build a reusable, local-first, offline-capable 2D browser-game production system called the **Stinky Weasel 2D Browser Game Factory**.

This is not one game and it is not merely a Phaser starter template.

The goal is a governed, modular factory that can rapidly produce many distinct kinds of 2D browser games from reusable controllers, system packs, data schemas, genre presets, theme packs, visual level data, QA journeys, and a local CLI.

The architecture must support at least **74 registered game preset recipes** spanning platformers, top-down action, shooters, racers, puzzles, strategy, management, narrative/exploration, and party/toy games.

Do not create 74 independent engines and do not fork the runtime per genre.

The central architectural thesis is:

> **One reusable runtime + composable system packs + controller families + data-driven content + genre preset recipes + theme packs + proof-driven QA.**

The factory must optimize for:
- fast new-game creation;
- clean architecture;
- agent-safe modification;
- local-first operation;
- no runtime network dependency;
- free/open tooling by default;
- browser deployment;
- desktop and mobile play;
- accessible controls and UI;
- deterministic validation;
- strong provenance and third-party resource hygiene;
- reusable game-feel systems;
- bounded, inspectable changes;
- easy continuation by another coding agent.

The existing `westkitty/c_chase` repository is an important **read-only reference implementation** for proven gameplay feel and production lessons. It is not the codebase to repurpose.

If the current working directory is the `c_chase` repository, do not convert it into the factory. Stop before modifying it and report that the factory needs a separate target repository/directory.

---


# 0A. VERIFIED REPOSITORY TARGET

Canonical remote:

```text
https://github.com/westkitty/2d_Game_Factory
```

Verified project snapshot on **2026-08-24**:

- repository: `westkitty/2d_Game_Factory`;
- visibility: public;
- default branch: `main`;
- repository is currently empty;
- the connected owner account has admin and push permission.

Claude Code must still re-verify the local execution environment and remote before mutation.

This repository is the only authorized Git remote for this project.

`westkitty/c_chase` remains a read-only reference. Never push factory work into `c_chase`.

---

# 0B. MODEL ROUTING POLICY — SONNET BY DEFAULT, OPUS BY EXCEPTION

Cost control is a first-class project constraint.

Use **Claude Sonnet 5** for routine implementation whenever the architecture and acceptance contract are already explicit.

Use **Claude Opus 5** only where its additional reasoning quality materially reduces architectural or cross-system risk.

The expected project routing is:

```text
OPUS 5
Phase 1  - establishment and architecture foundation
Phase 5  - architecture integration gate
Phase 9  - preset/proof-readiness architecture gate
Phase 12 - final cross-system acceptance and cold-start gate

SONNET 5
All normal implementation phases between those gates
```

This is a routing default, not an excuse to block progress.

## Work that belongs to Sonnet 5

Prefer Sonnet for:

- implementing already-defined interfaces;
- schema files and validators;
- ordinary controllers after the controller contract exists;
- system-pack implementation after pack boundaries exist;
- preset definitions;
- repetitive adapters;
- Tiled mappings;
- starter templates;
- CLI subcommands with established conventions;
- tests for already-defined behavior;
- accessibility implementation against explicit criteria;
- documentation updates;
- placeholder/demo content;
- routine bug fixes;
- release scripts;
- preset-family batches;
- representative demo construction;
- most proof-game content work.

## Work that justifies Opus 5

Use Opus when one or more of these conditions is true:

1. the task establishes or changes a shared architecture boundary;
2. the task changes the contract between three or more system families;
3. a schema/API decision will constrain most future games;
4. a proof game exposes an abstraction failure rather than a localized bug;
5. Sonnet has completed one evidence-driven repair pass and the same cross-cutting failure remains;
6. the proposed solution requires a new major dependency or runtime subsystem;
7. the project is about to freeze a major architecture milestone;
8. a broad regression makes the root ownership unclear;
9. final acceptance requires reconciling multiple proof games and repository-wide invariants.

Do **not** use Opus merely because:
- a phase has many files;
- a task is tedious;
- a preset family is large;
- tests need to be written;
- documentation is lengthy;
- Sonnet needs to follow an already-decided pattern.

## Opus stopping rule

When an Opus architecture phase has:
- established the required contracts;
- produced a runnable and validated baseline;
- written the handoff state;
- committed and pushed the validated milestone;

Opus must stop.

It must not consume premium-model time implementing the next Sonnet-owned phase unless the user explicitly overrides the routing plan.

## Sonnet escalation packet

When Sonnet encounters a genuine Opus trigger, it must stop after one bounded repair attempt and write a compact escalation record containing:

```text
affected invariant
earliest failing check
files/systems involved
what was attempted
why the issue appears architectural
smallest decision Opus needs to make
```

Do not send Opus raw exploratory noise when a bounded evidence packet can describe the problem.

---

# 1. SOURCE OF TRUTH AND AUTHORITY ORDER

Apply this authority order:

1. Newest explicit user instruction.
2. This master project contract.
3. `OPERATIONAL_STATE.md`.
4. `PROJECT_BIBLE.md`.
5. Accepted architecture decisions in `docs/architecture/`.
6. Verified tests and observed runtime behavior.
7. Existing implementation conventions.
8. External examples and third-party documentation.
9. Inference.

External examples are evidence and inspiration, not controlling architecture.

If external documentation conflicts with this contract, preserve the project purpose and use the smallest technically correct adaptation.

Do not silently resolve important conflicts. Record them.

---

# 2. PROJECT PURPOSE

The factory exists to make future 2D browser games quickly without rebuilding infrastructure for every game.

A normal future game should mostly require:

- choosing a preset;
- selecting system packs;
- selecting a controller family;
- creating or importing level/content data;
- supplying art/audio/theme assets;
- changing tuning values;
- adding small game-specific behaviors only when needed;
- validating;
- building;
- packaging.

The desired future workflow is conceptually:

```bash
npm run sw2d -- list-presets
npm run sw2d -- new friday-chase --preset chase-platformer
npm run sw2d -- add-level friday-chase 01-intro
npm run sw2d -- validate friday-chase
npm run sw2d -- build friday-chase
npm run sw2d -- pack friday-chase
```

Exact command syntax may be adjusted if implementation evidence justifies it, but preserve the one-command-per-purpose philosophy.

A generated game must be immediately runnable with placeholder content.

---

# 3. NON-NEGOTIABLE DESIGN LAWS

## 3.1 Presets are compositions, not forks

A genre preset must compose existing capabilities.

Example:

```text
METROIDVANIA
= platform controller
+ world/room graph
+ ability gates
+ inventory/progression
+ save/checkpoints
+ map
```

Example:

```text
TOWER DEFENSE
= pointer/grid interaction
+ pathfinding
+ waves
+ placement
+ towers
+ economy
+ upgrades
```

If implementing a new preset requires copying the engine into a genre-specific branch, the architecture has failed.

## 3.2 Separate machine from game

Reusable runtime code and game content must be clearly separated.

The equivalent of this rule must remain obvious in the repository:

> **Runtime/system code is the machine. Game manifests, tuning, level data, themes, and assets are the game.**

## 3.3 No giant single-file runtime

Do not recreate the architectural weakness of `c_chase`.

No thousands-of-lines all-in-one HTML/JavaScript runtime.

Split responsibilities by lifecycle and domain.

## 3.4 No unnecessary framework stack

Use Phaser as the game runtime.

Do not add React, Vue, Svelte, a custom ECS, Redux, a backend, cloud services, or other major architecture merely because they are familiar.

Add a new dependency only when it solves a demonstrated problem better than a small local implementation.

## 3.5 Offline runtime

A production build must make **zero required external network requests at runtime**.

No CDN dependencies.
No Google Fonts.
No remote telemetry.
No remote configuration.
No runtime asset fetch from third-party domains.
No cloud save requirement.
No analytics by default.

Development tooling may use the network to install dependencies and inspect permitted public sources.

## 3.6 Semantic inputs

Gameplay code must consume semantic actions, not physical key codes.

Examples:

```text
MOVE_LEFT
MOVE_RIGHT
MOVE_UP
MOVE_DOWN
JUMP
PRIMARY_ACTION
SECONDARY_ACTION
DASH
PAUSE
INTERACT
AIM
CONFIRM
CANCEL
```

Keyboard, touch, pointer, and gamepad adapters map physical input to actions.

## 3.7 Data-driven tuning

Gameplay tuning values must not be scattered through unrelated source files.

Gravity, jump velocity, acceleration, dash values, enemy speeds, chase pressure, health, score values, timers, camera behavior, and similar values belong in typed/data-validated configuration unless they are algorithmic constants.

## 3.8 Resource provenance is part of engineering

No third-party code, visual asset, audio asset, font, or template should enter the production repository without an identifiable source and license state.

Unverified resources are not approved resources.

## 3.9 Proof beats claims

A build passing does not prove the game works.

A file existing does not prove the feature works.

A preset being registered does not prove the genre is production-ready.

Use explicit evidence states.

## 3.10 Preserve working behavior

Once a proof journey is verified, later changes must not silently break it.

---

# 4. REQUIRED TECHNOLOGY BASELINE

Use this technology direction unless current evidence shows a material blocker:

- Phaser 4 current stable release at implementation time.
- TypeScript.
- Vite current stable release compatible with the chosen Node runtime.
- Node.js current supported LTS compatible with the selected toolchain.
- npm unless the existing target repository already has another package manager that must be preserved.
- Tiled JSON as the primary external visual level format.
- JSON Schema for machine-checkable content contracts.
- Ajv or an equally small, well-maintained JSON Schema validator.
- Vitest or an equivalent lightweight TypeScript unit test runner.
- Playwright or an equivalent browser automation path for representative user journeys.
- Static browser output.
- Optional PWA/offline caching layer after the core static build works.

Before installing:
1. verify current stable versions;
2. verify license;
3. verify Node compatibility;
4. pin exact versions in the lockfile;
5. record the choices in `docs/architecture/DEPENDENCY_BASELINE.md`.

Do not copy old dependency versions from historical examples.

---

# 5. EXTERNAL REFERENCE SET

Use targeted inspection. Do not perform broad archaeology unless necessary.

## 5.1 Primary reference: `westkitty/c_chase`

Treat as read-only.

Inspect these first if accessible:

```text
README.md
cloud_chaser_seattle_remastered_final/cloud_chaser_playable.html
cloud_chaser_seattle_remastered_final/asset_manifest.json
cloud_chaser_seattle_remastered_final/UX_PLAYABILITY_AUDIT.md
RELEASE_NOTES_2026-07-02.md
```

Extract ideas, not architecture.

Important reusable lessons to preserve conceptually:
- coyote time;
- jump buffering;
- double jump support;
- strong air control;
- responsive platform movement;
- hit-stop;
- squash/stretch feedback;
- screen shake;
- damage knockback;
- invulnerability windows;
- recoverable dropped collectibles;
- slow-motion death feedback;
- pursuing storm/chase pressure;
- checkpoints;
- touch input;
- keyboard input;
- gamepad-ready action mapping;
- assist/practice modes;
- reduced motion;
- high-contrast/object cues;
- local persistence;
- replay/ghost concepts;
- boss phase behavior;
- QA snapshot/debug concepts.

Do not port every Cloud Chaser meta-system into the core.

Cloud Chaser's system density is a warning as well as an asset.

Use its movement values only as a starting preset for the `chase-platformer` proof, not as universal engine defaults.

## 5.2 Architecture references

Inspect only when useful:
- `phaserjs/template-vite-ts`
- `phaserjs/examples`
- `ourcade/sidescrolling-platformer-template-phaser3`
- `excaliburjs/sample-platformer`
- KAPLAY architecture/examples
- Tiled JSON documentation

Rules:
- Phaser official sources may inform current API usage.
- The Ourcade project is an old Phaser reference; use architecture ideas, not old dependency versions.
- Excalibur and KAPLAY are architectural comparisons, not dependencies.
- Do not add multiple game engines to this factory.
- Do not copy third-party code unless its license is verified and the copied code is documented.

---

# 6. TARGET REPOSITORY SHAPE

Prefer a compact npm-workspace architecture.

Use this as the target shape unless implementation evidence suggests a smaller equivalent:

```text
/
|-- MASTER_PROJECT.md
|-- OPERATIONAL_STATE.md
|-- PROJECT_BIBLE.md
|-- README.md
|-- package.json
|-- package-lock.json
|-- tsconfig.base.json
|-- resource-policy.json
|
|-- packages/
|   |-- runtime/
|   |   |-- src/
|   |   |   |-- core/
|   |   |   |-- input/
|   |   |   |-- scenes/
|   |   |   |-- systems/
|   |   |   |-- controllers/
|   |   |   |-- actors/
|   |   |   |-- world/
|   |   |   |-- content/
|   |   |   |-- ui/
|   |   |   |-- debug/
|   |   |   `-- index.ts
|   |   `-- package.json
|   |
|   |-- schemas/
|   |   |-- schemas/
|   |   |-- src/
|   |   `-- package.json
|   |
|   |-- presets/
|   |   |-- src/
|   |   |-- catalog/
|   |   `-- package.json
|   |
|   |-- cli/
|   |   |-- src/
|   |   `-- package.json
|   |
|   `-- qa/
|       |-- src/
|       |-- fixtures/
|       `-- package.json
|
|-- starter/
|   |-- src/
|   |-- content/
|   |-- public/
|   |-- themes/
|   `-- vite.config.ts
|
|-- examples/
|   |-- proofs/
|   |-- representative/
|   `-- fixtures/
|
|-- tools/
|   |-- scripts/
|   `-- templates/
|
|-- docs/
|   |-- architecture/
|   |-- resources/
|   |-- presets/
|   |-- qa/
|   `-- handoff/
|
`-- release/
```

Do not create directories that remain meaningless placeholders.

If a smaller structure gives the same separation with less complexity, use the smaller structure and document the decision.

---

# 7. CORE RUNTIME CONTRACT

The reusable runtime should expose a stable context rather than hidden globals.

Conceptual responsibilities:

```text
GameRuntime
GameContext
SceneRouter
ActionInput
AssetCatalog
AudioBus
SaveStore
SettingsStore
EventBus
CapabilityRegistry
SystemRegistry
ContentRegistry
AccessibilityState
DebugState
```

## 7.1 GameContext

Systems should receive explicit access to dependencies through a bounded context.

Avoid:
- arbitrary global mutable state;
- systems importing unrelated systems directly;
- hidden singleton ownership;
- circular dependencies.

## 7.2 Typed events

Use typed semantic events for cross-system communication where appropriate.

Examples:

```text
PLAYER_DAMAGED
PLAYER_DIED
CHECKPOINT_ACTIVATED
COLLECTIBLE_ACQUIRED
ABILITY_USED
LEVEL_STARTED
LEVEL_COMPLETED
OBJECTIVE_COMPLETED
BOSS_PHASE_CHANGED
PAUSE_CHANGED
SETTINGS_CHANGED
```

Do not create an event for every trivial local operation.

## 7.3 Lifecycle discipline

Every reusable system that allocates listeners, timers, physics objects, DOM nodes, audio nodes, or subscriptions must have a clear disposal path.

Scene changes and game restart must not duplicate listeners or leak resources.

---

# 8. SYSTEM PACK MODEL

Implement system packs as composable capabilities.

A pack should have an explicit identity, dependencies, configuration schema, install lifecycle, and disposal lifecycle.

Conceptual contract:

```ts
interface SystemPackDefinition {
  id: string;
  version: string;
  dependencies: string[];
  optionalDependencies?: string[];
  configSchemaId: string;
  install(context: GameContext, config: unknown): InstalledSystemPack;
}

interface InstalledSystemPack {
  dispose(): void;
}
```

Exact code may differ.

Avoid building a universal plugin framework for its own sake.

Build only the extension points required by the proof games and registered presets.

---

# 9. REQUIRED SYSTEM PACK FAMILIES

At minimum, support these logical pack families.

## 9.1 Core pack

Always available:

```text
scene-lifecycle
semantic-input
asset-catalog
audio
save-settings
content-loader
events
accessibility
debug-hooks
```

## 9.2 Platform movement pack

Capabilities may include:

```text
ground movement
air movement
gravity
jump
coyote time
jump buffering
double jump
variable jump
wall slide
wall jump
ledge helpers
dash
moving platforms
one-way platforms
springs
updrafts
```

Do not enable every capability by default.

## 9.3 Top-down movement pack

```text
4-way movement
8-way movement
analog movement
acceleration
dash
collision
facing
aim orientation
```

## 9.4 Vehicle movement pack

```text
throttle
steering
braking
drag
drift
boost
lap/checkpoint integration
```

Keep it arcade-focused.

## 9.5 Grid movement pack

```text
cell navigation
turn actions
push/pull interaction
movement validation
undo-friendly state
```

## 9.6 Pointer interaction pack

```text
hover
click/tap
drag/drop
selection
targeting
placement
camera pan
```

## 9.7 Combat pack

```text
health
damage
invulnerability
knockback
melee
projectiles
weapons
cooldowns
status effects
hit feedback
```

## 9.8 AI pack

```text
idle
patrol
chase
flee
ranged attack
melee attack
vision
awareness
noise response
simple navigation
wave spawning
boss phases
```

Do not create heavyweight behavior trees unless a proof requires them.

## 9.9 World pack

```text
tilemaps
rooms
zones
spawn points
checkpoints
transitions
triggers
camera zones
hazards
exits
world flags
```

## 9.10 Progression pack

```text
inventory
abilities
currencies
XP
unlock flags
collections
quests/objectives
equipment-lite
persistent progression
```

## 9.11 Arcade pack

```text
score
combo
timer
rank
waves
local high scores
splits
ghost/replay hooks
rounds
```

## 9.12 Puzzle pack

```text
grid state
switches
signals
movable objects
sequence conditions
goal conditions
reset
undo
```

## 9.13 Simulation pack

```text
resources
timers
jobs
needs
production
queues
economy
upgrades
scheduled state changes
```

## 9.14 Narrative pack

```text
dialogue
speaker identity
portraits
choices
flags
objectives
codex entries
hotspots
simple branching
```

## 9.15 Strategy pack

```text
selection
placement
teams
pathfinding
turn order
movement range
attack range
waves
economy
capture zones
```

## 9.16 Optional advanced physics pack

Only add if proof evidence requires it.

Use for mechanics such as:
- rope constraints;
- grappling;
- pinball;
- complex rigid-body puzzles.

Keep it optional and isolated.

---

# 10. CONTROLLER FAMILIES

Implement controllers separately from genre logic.

Minimum controller families:

1. platform;
2. top-down;
3. vehicle;
4. grid;
5. pointer;
6. UI/simulation.

A preset selects one or more controller families.

A game should not need to rewrite the input router to change controller style.

---

# 11. CONTENT MODEL

Content should be versioned and schema-validatable.

Minimum conceptual structure for a generated game:

```text
content/
|-- game.json
|-- rules.json
|-- controls.json
|-- accessibility.json
|-- tuning.json
|-- progression.json
|
|-- levels/
|-- worlds/
|-- entities/
|-- enemies/
|-- items/
|-- abilities/
|-- dialogue/
|-- quests/
|-- waves/
|-- puzzles/
`-- presets/
```

Only create/use directories required by the selected preset.

Every major JSON document must contain:
- `schemaVersion`;
- stable IDs;
- explicit references;
- no ambiguous filename-derived identity when avoidable.

Broken references should fail validation with readable messages.

---

# 12. JSON SCHEMA REQUIREMENTS

Create machine-readable schemas for at least:

```text
game manifest
preset definition
system pack configuration
controls
tuning
level metadata
entity definition
enemy definition
item definition
ability definition
dialogue definition
wave definition
theme definition
resource manifest
```

Use JSON Schema validation in development and CI.

Generate TypeScript types from the schemas or otherwise ensure schema/type parity.

Do not maintain two unrelated definitions manually if they can drift.

---

# 13. TILED LEVEL PIPELINE

Use Tiled JSON as the primary visual level-authoring format.

## 13.1 Entity registry

Map Tiled classes/types to semantic factories.

Minimum object classes:

```text
PlayerSpawn
Checkpoint
Exit
Enemy
Hazard
Collectible
Powerup
Spring
Updraft
DashPanel
Trigger
CameraZone
MusicZone
DialogueTrigger
BossTrigger
SpawnZone
Objective
Interactable
```

Additional classes may be added by system packs.

## 13.2 Tiled templates

Provide Tiled object templates or documented property presets where practical.

The user should not have to remember arbitrary property spelling for common objects.

## 13.3 Level loader

The loader must:
- validate required properties;
- detect unknown classes;
- produce useful error messages;
- register spawned objects;
- keep editor coordinates separate from gameplay tuning;
- support tile collision metadata;
- support object layers;
- support triggers;
- support camera bounds.

## 13.4 No hard-coded coordinate archaeology

Normal level design must not require manually writing long lists of platform and collectible coordinates in TypeScript.

---

# 14. THEME PACK SYSTEM

Do not bake a visual style into the engine.

The runtime understands semantic asset roles such as:

```text
player
enemy
pickup
tile
background
portrait
icon
particle
font
panel
button
cursor
```

A theme provides visual implementation.

Conceptual structure:

```text
themes/
`-- example-theme/
    |-- theme.json
    |-- ui.css
    |-- fonts/
    |-- sprites/
    |-- tiles/
    |-- effects/
    `-- ui/
```

Theme swaps should not alter gameplay logic.

Do not hard-code Cloud Chaser, Seattle, SNES, Dexter, Starsilk, Friday, or any other specific identity into the runtime.

---

# 15. SEMANTIC UI AND COPY

The runtime should emit semantic UI states:

```text
TITLE
PAUSED
GAME_OVER
LEVEL_COMPLETE
NEW_ITEM
CHECKPOINT
OBJECTIVE_UPDATED
OBJECTIVE_COMPLETE
SETTINGS
ACCESSIBILITY
```

The game/theme layer supplies presentation and wording.

Do not embed game-specific jokes or lore in core runtime code.

---

# 16. SAVE AND PERSISTENCE

Implement versioned local persistence.

Use:
- `localStorage` for small settings and simple progress where appropriate;
- IndexedDB only when larger data such as replay history materially requires it.

Requirements:
- namespace saves by stable game ID;
- version save schema;
- handle corrupt values safely;
- provide reset controls;
- support migration or explicit invalidation when schema changes;
- never silently cross-load data between generated games.

No cloud account is required.

---

# 17. AUDIO

Use local audio assets and browser-safe playback.

Requirements:
- master volume;
- music volume;
- SFX volume;
- mute;
- user-gesture audio unlock;
- scene-aware music changes;
- clean stop/dispose behavior;
- settings persistence;
- no required remote audio source.

Do not treat autoplay as reliable.

---

# 18. ACCESSIBILITY BASELINE

Every generated game should inherit an accessibility scaffold where relevant.

Minimum baseline:
- keyboard support;
- remappable semantic actions where reasonable;
- touch layout for coarse-pointer/mobile play;
- reduced motion;
- screen shake control;
- master audio controls;
- high-contrast/object cue hooks;
- readable focus states for DOM UI;
- pause when tab becomes hidden when gameplay would otherwise continue unfairly;
- settings persistence;
- no inaccessible critical information conveyed only by color;
- semantic DOM representation for menus/settings and important status announcements where appropriate.

Accessibility settings should be orthogonal to theme.

A game preset may disable irrelevant options but must not remove accessibility architecture.

---

# 19. DEBUG AND DEVELOPER EXPERIENCE

Development builds should expose useful diagnostics without contaminating production UI.

Provide:
- FPS;
- active scene;
- player position;
- collision bounds;
- spawn points;
- camera bounds;
- active system packs;
- entity IDs;
- current input actions;
- current checkpoint;
- game state snapshot;
- content validation errors.

Production builds should omit or gate development-only diagnostics.

Create a stable debug snapshot API suitable for automated QA.

---

# 20. RESOURCE GOVERNANCE

Translate the Gaming Guides project resource-governance philosophy into repository rules. Do not assume external ChatGPT Skills exist inside Claude Code.

Create:

```text
resource-policy.json
docs/resources/CODE_RESOURCE_MANIFEST.json
docs/resources/VISUAL_ASSET_MANIFEST.json
docs/resources/AUDIO_ASSET_MANIFEST.json
docs/resources/THIRD_PARTY_NOTICES.md
docs/resources/RESOURCE_REJECTIONS.md
```

The initial proof games should prefer code-drawn shapes and local placeholder assets so external art/audio does not block engine work.

## 20.1 Default policy

Prefer:
- free resources;
- permissive licenses;
- original project code;
- local assets;
- removable dependencies;
- no accounts;
- no telemetry;
- no runtime network;
- no native binaries unless explicitly justified.

Do not:
- purchase anything;
- create accounts;
- accept custom marketplace terms;
- enable telemetry;
- add native binaries;
- add closed-source runtime dependencies;
- use redistribution-restricted assets;
- add a new registry;
without explicit user approval.

## 20.2 Code dependency record

For every nontrivial direct dependency record:
- name;
- exact version;
- canonical source;
- license;
- purpose;
- whether it has install scripts;
- whether it introduces network/telemetry behavior;
- removal path.

## 20.3 Asset record

For every third-party asset record:
- exact item identity;
- original source;
- license;
- attribution requirements;
- modification status;
- local path.

Unverified provenance means the resource stays out of production.

---

# 21. GENRE PRESET CATALOG

Implement at least the following **74 registered preset recipes**.

Important maturity rule:

- A registered preset is a validated composition recipe, not a claim of full production completeness.
- All 74 must schema-validate and instantiate a runnable starter shell.
- At least 12 representative presets must receive dedicated functional smoke demos.
- Five fundamentally different proof games must receive deep end-to-end validation.
- Do not build 74 large demo games.

## Family A - Platforming

1. `traditional-platformer`
2. `chase-platformer`
3. `endless-runner`
4. `precision-platformer`
5. `metroidvania`
6. `puzzle-platformer`
7. `auto-runner`
8. `climbing-game`
9. `grappling-platformer`
10. `collectathon-platformer`

## Family B - Top-down action

11. `top-down-adventure`
12. `action-adventure`
13. `twin-stick-shooter`
14. `survivor-like`
15. `dungeon-crawler`
16. `action-roguelite`
17. `stealth-game`
18. `heist-game`
19. `arena-combat`
20. `boss-rush`

## Family C - Shooter

21. `horizontal-shmup`
22. `vertical-shmup`
23. `bullet-hell`
24. `asteroids-shooter`
25. `gallery-shooter`
26. `run-and-gun`
27. `rail-shooter`

## Family D - Vehicle and movement

28. `top-down-racer`
29. `kart-racer`
30. `time-trial-racer`
31. `endless-driving`
32. `boat-flight-racer`

## Family E - Puzzle and arcade

33. `sokoban`
34. `match-puzzle`
35. `falling-block-puzzle`
36. `breakout`
37. `pong`
38. `physics-puzzle`
39. `maze-game`
40. `rhythm-action`
41. `reaction-timing`
42. `pinball-lite`

## Family F - Strategy and defense

43. `tower-defense`
44. `lane-defense`
45. `auto-battler`
46. `simple-rts`
47. `turn-based-tactics`
48. `base-defense`
49. `territory-control`

## Family G - Simulation and management

50. `idle-incremental`
51. `shopkeeper`
52. `tycoon-lite`
53. `farming-lite`
54. `pet-creature`
55. `colony-lite`
56. `restaurant`
57. `aquarium-terrarium`

## Family H - Narrative and exploration

58. `exploration-game`
59. `visual-novel`
60. `point-and-click`
61. `interactive-fiction-hybrid`
62. `investigation-game`
63. `museum-exhibit`
64. `escape-room`

## Family I - Party, toy, and weird

65. `microgame-collection`
66. `local-party-game`
67. `physics-toy`
68. `virtual-pet`
69. `dress-up-character-toy`
70. `sandbox-playground`
71. `drawing-game`
72. `fishing-game`
73. `cooking-game`
74. `photography-game`

---

# 22. PRESET DEFINITION CONTRACT

Every preset must declare at least:

```text
id
displayName
family
maturity
controllerFamilies
requiredSystemPacks
optionalSystemPacks
defaultConfig
requiredContentRoles
supportedInputModes
starterScene
validationProfile
knownLimitations
```

Use a typed/schema-validatable format.

Suggested maturity states:

```text
recipe
smoke-validated
proof-validated
experimental
```

Do not label a recipe `proof-validated` unless an end-to-end proof exists.

---

# 23. REPRESENTATIVE FUNCTIONAL PRESETS

Build dedicated smoke demos for at least these 12:

1. traditional platformer;
2. chase platformer;
3. metroidvania;
4. twin-stick shooter;
5. stealth game;
6. bullet hell;
7. top-down racer;
8. Sokoban;
9. tower defense;
10. turn-based tactics;
11. idle/management;
12. visual novel.

These demos may use deliberately simple placeholder art.

Each must demonstrate that its core composition is real, not merely registered.

---

# 24. FIVE DEEP PROOF GAMES

The architecture is not accepted until these five mechanically unrelated proof games work.

## Proof A - Cloud Chaser style mini-level

Purpose:
- platform controller;
- coyote time;
- jump buffer;
- double jump;
- collectible quota;
- chase pressure;
- enemy/hazard;
- checkpoint;
- death/respawn;
- level clear.

Use original placeholder visuals unless user-controlled Cloud Chaser assets are explicitly brought in.

Acceptance:
- no core engine edits are required after the proof content contract is frozen;
- movement feels responsive;
- chase pressure pauses appropriately during noninteractive intro/spawn grace;
- checkpoint respawn works;
- automated journey reaches clear state.

## Proof B - Twin-stick arena

Purpose:
- top-down movement;
- independent aim;
- projectiles;
- enemy waves;
- health;
- score;
- pause/restart.

Acceptance:
- keyboard/mouse and touch-compatible input architecture;
- projectile lifecycle is leak-free;
- wave completion works;
- automated journey can start, damage enemy, survive a wave, and restart.

## Proof C - Tower defense micro-map

Purpose:
- route/path;
- tower placement;
- currency;
- waves;
- targeting;
- upgrades.

Acceptance:
- placement rejects invalid cells;
- enemies follow route;
- towers target enemies;
- currency changes correctly;
- win/fail state is reachable.

## Proof D - Sokoban puzzle

Purpose:
- grid controller;
- pushing;
- goal conditions;
- reset;
- undo.

Acceptance:
- deterministic state;
- invalid push rejected;
- undo restores exact prior state;
- solved state detected.

## Proof E - Tiny management toy

Purpose:
- persistent simulation;
- resources;
- timers;
- queue/job;
- upgrade;
- save/reload.

Acceptance:
- resource changes are deterministic;
- save/reload preserves state;
- offline runtime remains network-free;
- no gameplay loop depends on canvas movement.

---

# 25. GAME FACTORY CLI

Build a local CLI that reduces setup effort.

Minimum commands or equivalent:

```bash
npm run sw2d -- doctor
npm run sw2d -- list-presets
npm run sw2d -- describe <preset>
npm run sw2d -- new <game-id> --preset <preset-id>
npm run sw2d -- add-level <game-id> <level-id>
npm run sw2d -- add-theme <game-id> <theme-id>
npm run sw2d -- validate <game-id>
npm run sw2d -- build <game-id>
npm run sw2d -- pack <game-id>
```

## 25.1 `doctor`

Check:
- Node/npm compatibility;
- dependency install state;
- TypeScript;
- schemas;
- required local directories;
- optional Tiled availability;
- browser QA capability where available.

Do not require Tiled merely to run a generated game.

## 25.2 `new`

Generate:
- game manifest;
- selected preset;
- starter scene/level;
- default tuning;
- controls;
- accessibility settings;
- local placeholder theme;
- tests appropriate to the preset;
- README instructions.

The output must run before custom art exists.

## 25.3 `validate`

Run a bounded validation ladder:

1. schema/content validation;
2. TypeScript/static validation;
3. unit tests relevant to enabled systems;
4. build;
5. focused browser smoke journey.

Broader proof suites may run separately.

## 25.4 `pack`

Produce a clean static release bundle.

---

# 26. GENERATED GAME CONTRACT

A generated game should be understandable without reading the factory source.

Minimum game structure:

```text
game/
|-- README.md
|-- content/
|-- public/
|-- themes/
|-- src/
|   `-- game-specific/
|-- tests/
`-- vite.config.ts
```

Generated games should not be encouraged to edit reusable runtime internals for ordinary content work.

Document the protected boundary:

```text
NORMAL GAME WORK
- content/**
- public/**
- themes/**
- src/game-specific/**

RUNTIME WORK
- reusable engine packages
- shared system packs
- shared controllers
```

If a game needs a new reusable extension:
1. explain why existing capability is insufficient;
2. add the smallest reusable extension;
3. add regression coverage;
4. rerun affected proof games.

---

# 27. AGENT-SAFE DEVELOPMENT CONTRACT

Design the repository for coding agents as well as humans.

Create `docs/AGENT_WORKFLOW.md`.

It must tell an agent:

1. Read `MASTER_PROJECT.md`.
2. Read `OPERATIONAL_STATE.md`.
3. Read relevant `PROJECT_BIBLE.md` entries.
4. Run `npm run sw2d -- doctor`.
5. Inspect only directly relevant files first.
6. Expand search only when evidence requires it.
7. Do not rewrite unrelated systems.
8. Do not change dependencies casually.
9. Run targeted validation.
10. Inspect the diff before claiming completion.
11. Update operational state after meaningful work.

Never request hidden chain-of-thought from an agent.

Require evidence, not narration.

---

# 28. OPERATIONAL STATE

Create `OPERATIONAL_STATE.md` at the project root before substantial implementation.

It must track:

```text
project identity
current baseline
current phase
verified capabilities
implemented but unverified capabilities
known broken behavior
unknown behavior
protected invariants
pending work
validation matrix
next bounded action
revision history
```

Do not mark a feature verified merely because source code exists.

Update it after every meaningful completed phase.

---

# 29. PROJECT BIBLE

Create `PROJECT_BIBLE.md`.

Use it as a concise append-only handoff ledger.

Record:
- major architecture decisions;
- reasons;
- rejected approaches;
- schema changes;
- significant regressions;
- fixes;
- version decisions;
- proof-game results;
- known fragile areas;
- future migrations.

Do not turn it into a raw terminal transcript.

---

# 30. ARCHITECTURE DECISIONS

Create small ADR-style documents under:

```text
docs/architecture/
```

At minimum document:
- Phaser selection;
- runtime/package boundaries;
- controller model;
- system pack model;
- content/schema model;
- Tiled integration;
- persistence;
- QA approach;
- offline policy;
- resource/dependency policy.

Do not produce an ADR for trivial implementation details.

---

# 31. TEST STRATEGY

Use layered validation.

## Layer 1 - Static/schema

Validate:
- TypeScript;
- JSON Schema;
- preset dependency graph;
- duplicate IDs;
- missing content references;
- invalid asset references.

## Layer 2 - Unit

Test:
- input mapping;
- save migration;
- grid state/undo;
- score calculations;
- system pack dependency resolution;
- preset composition;
- deterministic simulation pieces.

## Layer 3 - Runtime integration

Test:
- scene transitions;
- system install/dispose;
- pause/resume;
- restart;
- level loading;
- save/load;
- audio unlock handling.

## Layer 4 - Browser journeys

Create deterministic browser journeys such as:

```text
BOOT-001
launch -> title

GAME-001
title -> play -> player control

MOVE-001
jump -> buffered jump -> coyote jump

CHECKPOINT-001
activate checkpoint -> die -> respawn

PAUSE-001
play -> pause -> resume

SETTINGS-001
change setting -> reload -> persists

TOUCH-001
mobile viewport -> move -> primary action

CLEAR-001
start level -> complete level -> results

OFFLINE-001
block external network -> game still boots and plays

RESTART-001
restart repeatedly -> listeners/resources do not multiply
```

Add genre-specific journeys.

## Layer 5 - Proof regression

All five deep proof games must remain runnable after cross-cutting engine changes.

---

# 32. OFFLINE VALIDATION

Add a browser test that fails if a production build attempts required network access outside the local origin.

Fonts must be local.

Assets must be local.

Dependencies must be bundled.

If a PWA service worker is added:
- version its cache;
- test update behavior;
- do not let stale cache hide broken builds.

Direct `file://` execution is not a Phase 1 requirement because browser module/fetch restrictions vary. The required baseline is a self-contained static build with no external runtime network dependency.

---

# 33. MOBILE AND RESPONSIVE REQUIREMENTS

Generated games must support mobile browser play where the preset is compatible.

Requirements:
- viewport safe-area handling;
- controls must not clip;
- touch targets reasonably sized;
- orientation handling documented;
- gameplay canvas scales predictably;
- menus remain usable;
- desktop-only hover interactions must have touch equivalents;
- touch buttons map through the semantic input layer;
- no game logic duplicated for touch.

Test at least:
- a narrow phone viewport;
- a large phone/tablet viewport;
- desktop.

---

# 34. PERFORMANCE REQUIREMENTS

Do not prematurely micro-optimize, but build sane foundations.

Targets:
- 60 FPS goal on desktop for representative games;
- 60 FPS goal on modern mobile where reasonable;
- graceful behavior at 30 FPS;
- avoid per-frame allocation in hot projectile/enemy loops;
- pool high-frequency projectiles/effects where needed;
- no duplicated input listeners after restarts;
- no unbounded arrays from dead entities;
- release resources on scene teardown.

Create performance diagnostics rather than unsupported performance claims.

Bullet-hell and survivor-like demos must be used as stress references for object lifecycle.

---

# 35. ERROR HANDLING

A generated game must fail informatively.

Examples:
- missing asset -> identify exact asset ID/path;
- invalid preset -> identify dependency problem;
- malformed level -> identify object/class/property;
- invalid save -> recover safely and report;
- unavailable audio -> continue where possible;
- unknown Tiled object -> fail or warn according to configured strictness.

Do not silently swallow structural errors.

---

# 36. GAME-SPECIFIC EXTENSIONS

Provide a clear `src/game-specific/` extension area.

Use it for mechanics that are genuinely unique to one game.

A game-specific module may use stable runtime services but must not monkey-patch engine internals.

If three games independently need substantially the same extension, evaluate promotion into a reusable system pack.

---

# 37. OUT OF SCOPE FOR THIS FACTORY

Do not expand this project into:

- a 3D engine;
- an MMO framework;
- authoritative multiplayer server infrastructure;
- online matchmaking;
- complex rollback-netcode fighting games;
- simulation-grade vehicle physics;
- massive open-world streaming;
- a full Unity/Godot-style editor;
- a backend platform;
- an asset marketplace;
- an AI game-generation cloud service.

Local multiplayer/party input is in scope.

Simple peer/network experiments are not part of the initial master contract.

---

# 38. MODEL-ROUTED PROJECT PHASES

Do not implement the factory as one giant agent session.

Every phase must:
- start from a known commit;
- read `MASTER_PROJECT.md` and `OPERATIONAL_STATE.md`;
- keep the repository runnable;
- validate its own acceptance criteria;
- update operational state;
- stage only intended changes;
- commit a successful phase;
- push the resulting commit to `origin/main`.

The user has explicitly authorized normal initialization, staging, commits, and non-force pushes for this project repository.

Do not deploy, create releases, force-push, rewrite history, or mutate unrelated repositories without separate authorization.

---

## Phase 1 — OPUS 5 — Establishment and Architecture Foundation

**Owner:** Opus 5  
**Why Opus:** This phase creates the durable contracts every cheaper phase will follow.

This is the first phase and must be executed now before any Sonnet implementation wave.

Deliver:

### Repository establishment

- clone or initialize the exact repository `https://github.com/westkitty/2d_Game_Factory`;
- verify `origin`;
- establish branch `main`;
- inspect status before mutation;
- preserve anything discovered unexpectedly;
- place this master plan at repository root as `MASTER_PROJECT.md`.

### Durable control plane

Create:
- `OPERATIONAL_STATE.md`;
- `PROJECT_BIBLE.md`;
- `docs/AGENT_WORKFLOW.md`;
- `docs/architecture/ARCHITECTURE_OVERVIEW.md`;
- `docs/architecture/DEPENDENCY_BASELINE.md`;
- focused ADRs for the architecture decisions actually made in this phase.

### Dependency and environment baseline

Verify current compatible versions of:
- Node LTS;
- npm;
- Phaser 4;
- TypeScript;
- Vite;
- test tooling needed immediately.

Pin real versions.

Do not import stale versions from historical examples.

Record:
- canonical source;
- license;
- reason for use;
- compatibility assumptions.

### Repository architecture

Establish the minimum workspace/package structure needed for:
- runtime;
- schemas;
- presets;
- CLI;
- QA;
- starter/generated game.

Do not create elaborate empty directories simply to match a diagram.

### Core contracts

Define the stable initial interfaces/contracts for:
- `GameContext`;
- semantic action input;
- scene lifecycle;
- system-pack installation/disposal;
- capability registry;
- preset definition;
- content loading boundary;
- game-specific extension boundary.

Keep APIs intentionally small.

### First runnable vertical slice

Implement enough reusable runtime to prove the architecture:

```text
boot
-> title
-> start game
-> controllable placeholder player
-> pause
-> resume
-> restart
```

Requirements:
- Phaser + TypeScript + Vite;
- local assets only;
- semantic input mapping rather than raw key access in game systems;
- clean scene/listener teardown;
- baseline settings persistence;
- baseline audio manager with user-gesture-safe unlock behavior;
- baseline accessibility state;
- baseline debug snapshot API;
- no required runtime network access.

This is a foundation proof, not a genre demo.

### Architecture extraction

If `westkitty/c_chase` is accessible, inspect it read-only and create:

```text
docs/architecture/C_CHASE_EXTRACTION.md
```

Classify findings as:
- PRESERVE;
- GENERALIZE;
- GAME-SPECIFIC;
- DO NOT CARRY FORWARD.

Do not transplant its monolithic architecture.

### Phase 1 validation

At minimum:
- install succeeds;
- TypeScript/static checks pass;
- focused unit tests pass;
- production build passes;
- the first runtime flow is exercised;
- repeated restart does not obviously duplicate input/listeners;
- production output contains no required external runtime URLs;
- repository state is inspectable and clean after commit.

### Phase 1 publication

After validation:

```bash
git add -A
git diff --cached --check
git status --short
git commit -m "feat: establish 2D game factory foundation"
git push -u origin main
```

If the repository already has a valid upstream because of the clone, `git push origin main` is acceptable.

Never force-push.

### Phase 1 stop condition

Once the architecture foundation is validated, state is updated, and the commit is pushed:

**STOP OPUS.**

Do not begin Phase 2.

The next implementation owner is Sonnet 5.

---

## Phase 2 — SONNET 5 — Schema, Registry, and Content Foundation

Implement the contracts Opus established.

Deliver:
- JSON Schema infrastructure;
- schema/type parity;
- content validator;
- system registry implementation;
- capability registry implementation;
- preset schema;
- content loader;
- readable validation failures;
- initial CLI `doctor`, `list-presets`, and `describe`.

Acceptance:
- invalid data produces deterministic useful failures;
- dependency resolution is deterministic;
- schema/type parity has automated coverage;
- foundation proof still passes.

Do not redesign Phase 1 contracts unless a true architecture blocker is proven.

---

## Phase 3 — SONNET 5 — Controller Families

Implement the agreed controller interfaces:

1. platform;
2. top-down;
3. vehicle;
4. grid;
5. pointer;
6. UI/simulation.

Use minimal demonstration fixtures.

Acceptance:
- all controllers use the same semantic input layer;
- no controller duplicates physical input plumbing;
- lifecycle/disposal remains clean;
- focused controller tests pass.

---

## Phase 4 — SONNET 5 — Reusable System Pack Core

Implement first versions of:

- combat;
- AI;
- world;
- progression;
- arcade;
- puzzle;
- simulation;
- narrative;
- strategy.

Keep each pack scoped.

Acceptance:
- dependency graph validates;
- install/dispose is tested;
- no pack requires unrelated genre content;
- systems interact through established boundaries.

If an implementation requires redesigning shared boundaries, use the escalation packet rather than silently inventing a second architecture.

---

## Phase 5 — OPUS 5 — Architecture Integration Gate A

**Owner:** Opus 5  
**Purpose:** Verify that the first major Sonnet implementation wave obeyed the architecture before the project multiplies into dozens of presets.

Opus must inspect:
- current operational state;
- diffs/commit history since Phase 1;
- core contracts;
- schemas;
- registries;
- six controller families;
- system-pack dependencies;
- representative tests.

Opus should answer:

1. Are the original boundaries holding?
2. Is any shared system becoming a god object?
3. Are controller and system responsibilities bleeding together?
4. Are lifecycle/disposal rules consistent?
5. Is configuration genuinely data-driven?
6. Can the architecture plausibly support the 74 preset recipes without copying core code?

Allowed work:
- targeted cross-cutting repairs;
- contract clarification;
- dependency removal when justified;
- architecture documentation updates;
- regression tests for corrected invariants.

Do not spend Opus time implementing genre volume.

Validation:
- rerun affected shared tests;
- run all foundation/controller/system integration checks.

Commit and push a successful gate.

Then stop Opus and hand back to Sonnet.

---

## Phase 6 — SONNET 5 — Tiled, Theme, Accessibility, and Resource Pipeline

Deliver:
- Tiled JSON loader;
- semantic entity registry;
- common object classes;
- readable Tiled validation;
- theme-pack contract;
- local font/assets path;
- baseline responsive/touch UI;
- accessibility implementation against the master criteria;
- resource policy files and manifest schemas.

Acceptance:
- a platform level can be authored without hard-coded coordinate arrays;
- unknown object classes fail usefully;
- theme changes do not change gameplay;
- touch maps through semantic input;
- no external production-runtime requirement.

---

## Phase 7A — SONNET 5 — Preset Catalog Families A-C

Implement and validate preset recipes 1-27:
- platforming;
- top-down action;
- shooter.

Every recipe must:
- declare controller families;
- declare required and optional packs;
- declare starter content roles;
- declare validation profile;
- generate a runnable starter shell.

Do not build large demos yet.

---

## Phase 7B — SONNET 5 — Preset Catalog Families D-F

Implement and validate preset recipes 28-49:
- vehicle/movement;
- puzzle/arcade;
- strategy/defense.

Same acceptance rules as Phase 7A.

---

## Phase 7C — SONNET 5 — Preset Catalog Families G-I

Implement and validate preset recipes 50-74:
- simulation/management;
- narrative/exploration;
- party/toy/weird.

After Phase 7C:
- all 74 recipes must validate;
- all 74 must generate a runnable starter;
- preset IDs must be unique;
- no preset may contain a copied runtime.

---

## Phase 8 — SONNET 5 — Factory CLI and 12 Representative Demos

Finish the CLI:

```text
doctor
list-presets
describe
new
add-level
add-theme
validate
build
pack
```

Build focused smoke demos for:

1. traditional platformer;
2. chase platformer;
3. metroidvania;
4. twin-stick shooter;
5. stealth;
6. bullet hell;
7. top-down racer;
8. Sokoban;
9. tower defense;
10. turn-based tactics;
11. idle/management;
12. visual novel.

Acceptance:
- every demo demonstrates its defining composition;
- each has a focused browser smoke test;
- starter generation remains deterministic;
- demo-specific hacks stay outside reusable core unless justified.

---

## Phase 9 — OPUS 5 — Architecture Integration Gate B

**Owner:** Opus 5  
**Purpose:** Prevent "74 labels over one engine" and test whether the preset factory is structurally real before deep proof work.

Opus must inspect:
- all preset recipes;
- generated starter structure;
- the 12 representative demos;
- CLI generation;
- extension boundaries;
- configuration duplication;
- system-pack coupling;
- any Sonnet escalation packets.

Critical questions:

1. Do the 74 presets represent real compositions rather than renamed placeholders?
2. Is there unnecessary duplicated code between presets?
3. Are some packs actually one hidden monolith?
4. Can new games remain mostly content/theme/game-specific work?
5. Are any schemas becoming impossible to evolve?
6. Are the five planned proof games likely to exercise truly different architectures?

Allowed work:
- small architecture repairs;
- merging genuinely duplicated primitives;
- splitting an overloaded pack;
- adjusting contracts required for proof readiness;
- strengthening regression coverage.

Do not build the five proof games on Opus.

Commit and push the validated gate.

Stop Opus.

---

## Phase 10 — SONNET 5 — Five Deep Proof Games

Build the five deep proofs defined elsewhere in this master plan:

A. Cloud Chaser-style chase mini-level  
B. Twin-stick arena  
C. Tower-defense micro-map  
D. Sokoban puzzle  
E. Tiny management toy

Work in bounded proof batches.

The shared engine should not be casually modified to make one proof pass.

When a proof exposes a genuine architecture failure:
- record evidence;
- attempt one bounded repair if ownership is clear;
- otherwise create an Opus escalation packet.

Acceptance:
- all five end-to-end proof journeys work;
- regressions across prior proofs are checked when shared code changes;
- proof maturity state is accurately recorded.

---

## Phase 11 — SONNET 5 — Release, Hardening, Documentation, and Cold-Start Preparation

Deliver:
- release packer;
- checksums;
- self-contained static output;
- offline browser validation;
- resource manifests and notices;
- responsive/mobile hardening;
- QA documentation;
- preset capability matrix;
- proof matrix;
- cold-start handoff;
- complete README;
- project state cleanup.

Acceptance:
- release build has no required external runtime network;
- another agent can understand normal game-generation workflow;
- known limitations are explicit;
- repository is ready for final Opus acceptance rather than more feature expansion.

---

## Phase 12 — OPUS 5 — Final Cross-System Acceptance Gate

**Owner:** Opus 5  
**Purpose:** Final architecture and evidence reconciliation, not an open-ended polish pass.

Opus must inspect:
- `MASTER_PROJECT.md`;
- `OPERATIONAL_STATE.md`;
- `PROJECT_BIBLE.md`;
- architecture docs;
- dependency baseline;
- all 74 preset states;
- 12 representative demos;
- five proof games;
- release artifacts;
- test matrix;
- resource manifests;
- cold-start handoff.

Run or review the decisive validation appropriate to shared-system risk.

Opus may perform one targeted repair pass for cross-cutting acceptance failures.

Do not add speculative features.

The final verdict must classify the project as:
- Complete;
- Partial;
- Blocked;
- Unverified.

"Complete" is allowed only when the master acceptance contract is actually satisfied.

Commit and push final accepted corrections.

Do not create a GitHub Release or deployment unless separately authorized.

---

# 39. VALIDATION ESCALATION RULE

For ordinary changes use:

1. syntax/schema/static checks;
2. focused tests;
3. relevant integration/build;
4. affected browser journey;
5. broader proof suite only when impact is cross-cutting or evidence requires it.

Do not run every proof game after a documentation-only change.

Do run all affected proof games after changes to:
- input;
- scene lifecycle;
- system registry;
- content loader;
- persistence;
- common collision;
- shared rendering;
- build pipeline.

---

# 40. BOUNDED REPAIR RULE

For a phase:
- perform one cohesive implementation;
- run required validation;
- if validation fails, make one bounded evidence-driven repair pass;
- if the decisive failure remains, stop the phase and record the earliest unresolved failure plus evidence.

Do not repeatedly thrash the same failing approach.

Independent work may continue only when it cannot conceal or compound the failed foundation.

---

# 41. GIT AND FILE SAFETY

Canonical remote:

```text
https://github.com/westkitty/2d_Game_Factory
```

The user explicitly authorizes Claude Code to:
- clone this repository;
- initialize the local project;
- establish/use branch `main`;
- stage intended project files;
- create normal project commits;
- push normal fast-forward commits to this repository.

Before every mutation phase:
- verify `pwd`;
- verify `git remote get-url origin`;
- verify repository identity;
- inspect `git status --short`;
- inspect current branch;
- preserve unexpected user work.

For a successful phase:
1. run required validation;
2. inspect changed files;
3. `git add -A`;
4. `git diff --cached --check`;
5. inspect staged status/diff summary;
6. commit with a concise phase-appropriate message;
7. push to `origin main`;
8. verify the pushed commit when practical.

Never:
- `git reset --hard`;
- `git clean -fd`;
- force-push;
- delete unrelated files;
- overwrite unexpected user changes;
- rewrite history;
- push project code to another repository;
- deploy;
- publish a package;
- create a release;
unless separately authorized.

If authentication prevents push:
- keep the validated local commit;
- record the exact blocker;
- do not pretend the push occurred.

# 42. SECURITY AND PRIVACY

Requirements:
- no secrets in repository;
- no telemetry by default;
- no analytics by default;
- no third-party tracking;
- no dynamic remote code;
- no eval-based plugin loading;
- no credential requirement for generated games;
- no external runtime APIs required by core gameplay.

Static hosting must be sufficient for generated releases.

---

# 43. DOCUMENTATION REQUIREMENTS

Create:

```text
README.md
MASTER_PROJECT.md
OPERATIONAL_STATE.md
PROJECT_BIBLE.md
docs/AGENT_WORKFLOW.md
docs/architecture/ARCHITECTURE_OVERVIEW.md
docs/architecture/DEPENDENCY_BASELINE.md
docs/presets/PRESET_CATALOG.md
docs/presets/PRESET_CAPABILITY_MATRIX.md
docs/qa/PROOF_MATRIX.md
docs/qa/TESTING.md
docs/resources/THIRD_PARTY_NOTICES.md
docs/handoff/COLD_START_HANDOFF.md
```

README should explain normal use.

MASTER_PROJECT is the governing specification.

Do not duplicate the entire master document into every other file.

---

# 44. REQUIRED USER-FACING README FLOW

README should quickly answer:

1. What is this?
2. How do I install?
3. How do I list presets?
4. How do I generate a game?
5. How do I add a level?
6. How do I run it?
7. How do I validate it?
8. How do I build/package it?
9. Where do I put art/audio?
10. How do I create game-specific behavior?
11. Which files should I not casually modify?
12. How do I resume development safely?

---

# 45. SUCCESS METRICS

The factory is successful when:

- a fresh game can be generated without hand-scaffolding;
- all 74 presets exist as valid composition recipes;
- all 74 generate a runnable starter;
- 12 representative demos prove broad composition coverage;
- five deep proof games pass end-to-end;
- new games normally modify content/theme/game-specific areas rather than core;
- no generated game requires runtime internet;
- mobile and desktop baseline input works where relevant;
- Tiled levels load through semantic entities;
- configuration errors are understandable;
- runtime systems clean up correctly;
- agent instructions clearly constrain change scope;
- third-party resources are traceable;
- the release builder produces self-contained static output.

---

# 46. FAILURE CONDITIONS

Do not call the project complete if any of these are true:

- the runtime is still effectively one giant file;
- genre presets duplicate engine code;
- generated games require editing core for ordinary content;
- the 74 preset count is achieved with empty labels that do not compose real capabilities;
- proof games only display title screens;
- the five deep proofs are not mechanically distinct;
- input listeners duplicate after restart;
- save data leaks across games;
- external network is required at runtime;
- asset/dependency provenance is unknown;
- mobile controls clip or become unreachable;
- failures are hidden by stale service-worker cache;
- current state docs claim verification without evidence.

---

# 47. ANTI-OVERENGINEERING RULES

Do not build:
- a generalized ECS unless a proof demands it;
- a custom scripting language;
- a visual editor competing with Tiled;
- a backend;
- an asset store;
- an elaborate plugin marketplace;
- a huge dependency injection framework;
- a universal animation engine;
- a custom physics engine;
- code generation that is harder to debug than the content it replaces.

Prefer small explicit TypeScript APIs.

Every abstraction must earn its existence through at least two real consumers or an immediate architectural requirement.

---

# 48. CLOUD CHASER REFERENCE EXTRACTION

When inspecting `c_chase`, write a concise extraction report to:

```text
docs/architecture/C_CHASE_EXTRACTION.md
```

Separate:

```text
PRESERVE
- proven feel/behavior worth porting

GENERALIZE
- behavior useful as reusable system

GAME-SPECIFIC
- Cloud Chaser identity/content

DO NOT CARRY FORWARD
- architectural debt
- duplicated systems
- fragile hacks
- known UI/input problems
```

Do not copy the 6,000+ line structure.

Use Cloud Chaser as a behavioral donor.

---

# 49. INITIAL CLOUD CHASER TUNING PRESET

Create an optional `chase-platformer-cloud-chaser-like` tuning profile based on inspected values from the actual current reference source.

Do not hard-code those numbers into the engine.

Record the source file and extraction date.

The tuning preset should contain values such as:
- gravity;
- run acceleration;
- friction;
- max run speed;
- jump velocity;
- double-jump velocity;
- coyote window;
- jump buffer;
- invulnerability;
- camera lead;
- chase pressure.

If the current reference differs from prior notes, the current inspected repository wins.

---

# 50. LOCAL-FIRST RELEASE TARGETS

Primary:
- static web build;
- self-contained ZIP;
- GitHub Pages-compatible files;
- ordinary static-host compatible files;
- installable PWA when enabled.

Optional later:
- itch.io HTML package;
- desktop wrapper;
- Android wrapper.

Do not make wrappers part of core acceptance.

---

# 51. SESSION CONTINUATION PROTOCOL

This project may span multiple Claude Code sessions.

At the beginning of every new session:
1. read `MASTER_PROJECT.md`;
2. read `OPERATIONAL_STATE.md`;
3. read latest relevant `PROJECT_BIBLE.md` entries;
4. inspect git status;
5. run `npm run sw2d -- doctor` or the closest available preflight;
6. continue from the recorded next bounded action.

Before context exhaustion or an unavoidable stop:
1. leave the repository in the safest runnable state possible;
2. update `OPERATIONAL_STATE.md`;
3. append concise `PROJECT_BIBLE.md` notes if architecture or evidence changed;
4. record the exact next action;
5. do not claim incomplete work is done.

---

# 52. CLAUDE CODE EXECUTION BEHAVIOR

Do not ask the user to repeat information that is discoverable from this contract or the accessible repository.

Do not spend the session narrating every command.

Provide brief progress updates only when useful.

Do not respond with a massive speculative plan and stop.

Start with targeted inspection, establish project state, and execute Phase 0.

Continue through subsequent phases while the environment and context permit, but do not merge phases into one unsafe blast.

If a decision is reversible and the contract supplies enough direction, make the reasonable choice and document it.

Ask for user input only when:
- a destructive action requires approval;
- a paid/account/custom-license decision appears;
- target repository identity is genuinely ambiguous;
- two incompatible product decisions cannot be resolved from this contract;
- required credentials/hardware are unavailable;
- continuing would violate a protected boundary.

---

# 53. COMPLETION REPORT FORMAT

At the end of a Claude Code session, report only:

## Current state
- phase reached;
- completion state: complete / partial / blocked / unverified.

## Changed
- major artifacts and files changed.

## Validation
- commands/tests run;
- pass/fail results;
- decisive browser proof when available.

## Known limitations
- unresolved failures;
- checks not run;
- evidence still missing.

## Next bounded action
- one exact next step.

Do not dump hidden reasoning.
Do not paste enormous raw logs unless a failure excerpt is necessary.

---

# 54. MASTER ACCEPTANCE CONTRACT

The full project is complete only when all of the following are true:

1. The reusable runtime is modular and not a single giant game file.
2. The factory has a stable semantic input layer.
3. The factory has stable core lifecycle, persistence, audio, content, accessibility, and debug infrastructure.
4. Controller families exist for platform, top-down, vehicle, grid, pointer, and UI/simulation interaction.
5. System packs exist for combat, AI, world, progression, arcade, puzzle, simulation, narrative, and strategy needs.
6. Tiled JSON levels work through a semantic entity registry.
7. JSON Schemas validate the core content model.
8. All 74 required genre presets are registered and valid.
9. All 74 generate a runnable starter shell.
10. At least 12 representative presets have functional smoke demos.
11. All five deep proof games work end-to-end.
12. Generated games do not require ordinary edits to shared runtime internals.
13. Offline network-blocked QA passes for production builds.
14. Mobile/desktop baseline input and responsive UI work for applicable presets.
15. Save data is namespaced and versioned.
16. Repeated restart/scene transitions do not duplicate listeners or leak obvious resources.
17. Resource policy and third-party manifests exist.
18. Release packing produces a self-contained static artifact.
19. Operational state accurately separates verified, unverified, broken, and unknown behavior.
20. Cold-start documentation is sufficient for another coding agent to continue the project without hidden chat context.

Stop when these criteria are actually satisfied and evidenced.

Do not continue polishing merely because more ideas are possible.

---

# 55. FIRST ACTION NOW — OPUS 5 ONLY

Execute **Phase 1 — Opus 5 — Establishment and Architecture Foundation** and nothing beyond it.

Use the canonical repository:

```text
https://github.com/westkitty/2d_Game_Factory
```

The remote was verified empty on 2026-08-24, but re-check before relying on that fact.

Phase 1 must:
- establish the repository correctly;
- save this document as `MASTER_PROJECT.md`;
- establish durable state and architecture documents;
- verify and pin the dependency baseline;
- create the smallest justified workspace structure;
- define the core runtime contracts;
- implement the first reusable runnable vertical slice;
- validate it;
- stage;
- commit;
- push to `origin/main`;
- update state;
- stop.

Do not continue into the Sonnet-owned schema, controller, system-pack, Tiled, preset, demo, or proof-game phases.

The purpose of Phase 1 is to make the expensive architectural decisions once so that Sonnet can safely perform the bulk of the remaining implementation.

