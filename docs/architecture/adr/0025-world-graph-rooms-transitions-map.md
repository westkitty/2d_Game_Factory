# ADR-0025: World graph, room transitions and map are one capability that composes with world.state

- Status: accepted
- Date: 2026-08-29
- Phase: Capability program, Phase 8 (Sonnet 5)

## Context

`metroidvania` and `exploration-game` carried `LIMITATIONS.worldGraphAndMap`:
"only flat single-level Tiled maps plus world flags/checkpoints exist". A game
made of several locations had to hand-code one Phaser scene per room.

## Decision

**`sw2d.world-graph` → `world.graph`**, one renderer-neutral capability for a
game made of many authored (or Phase-7 generated) locations. It **composes
with** `world.state` (ADR-0011) - it does not replace it.

- **`WorldGraphDefinition` in `@sw2d/contracts`**: `nodes`, each naming a
  `level` content-document id, with `mapX`/`mapY`, `entrances` (id + position +
  facing) and `connections` (id, destination node + entrance, bounded
  `conditions`, optional `oneWay`, `mapLabel`). `validateWorldGraphDefinition`
  rejects duplicate node ids, an unknown `startNodeId`, an entrance-less node,
  and any connection targeting an unknown node or entrance.
- **Bounded traversal conditions - not expression evaluation**:
  `{ kind: 'flag' | 'item' | 'progression-unlock' | 'visited', ... }`. The
  service reads world flags / item counts / progression unlocks through the
  existing capabilities (`capabilities.get`); it stores none of that itself.
- **`WorldGraphService`**: `currentNode` / `connections` / `canTraverse` /
  `requestTransition` (validates, then moves the graph pointer and marks the
  destination discovered + visited - it touches no scene) / `markDiscovered` /
  `markVisited` / `mapState` / `reset` / `toSave` / `loadSave`.
- **`content/world-graph.json`, schema `world-graph`**
  (`urn:sw2d:schema:content-world-graph:v1`), document `world-graph`, always
  emitted (a single inert node unless the preset installs the pack).
- **Persistence** (opt-in, `config.persist`): only `{ currentNodeId,
  discovered, visited }` ids through `context.saves`. `loadSave` drops unknown
  ids and falls the current node back to start.
- **Transition bridge - `createRoomTransitionRuntime` in `@sw2d/runtime`**:
  owns the *scene lifecycle* of a transition - verify → suppress input for a
  few frames → `teardownRoom()` (shell disposes the current room) → resolve the
  destination `level` document → `buildRoom(level, entrance, node)` (shell
  builds the new room and places the player). A blocked or content-broken
  transition leaves the current room untouched; both rooms are never active at
  once.
- **Map - `createWorldMapOverlay` in `@sw2d/runtime`**: a semantic-DOM overlay
  of the discovered nodes with the current position marked and known edges
  counted. Keyboard operable (↑/↓ select, Esc close). `dispose()` removes every
  listener and node it created.
- **Generated shells**: the `platform` and `top-down` shell templates install
  the capability when present, expose `mapState()` in debug, bind
  `SECONDARY_ACTION` to the map, and take the first traversable connection when
  the player reaches the right edge.
- **Workbench**: `POST /api/world-graph/inspect` runs `validateWorldGraphDefinition`
  + reachability; an inspector-pane panel lists nodes / entrances / connections
  / conditions with the validation result. Read-only; editing is JSON work.

## Consequences

- Proof consumers: `proofs/metroidvania/` (three real rooms; a locked
  `east → treasury` connection; a lever that sets the world flag it is gated
  on; a return trip with the flag still set; the map; graph state persisted
  across a real scene reinstall) and `proofs/exploration-game/` (three areas in
  a loop; discovery / visited state; a persistent world flag surviving every
  transition; the map; **no room-sprite accumulation** after repeated
  back-and-forth). `qa:proof` 17/17 → 19/19.
- `metroidvania` / `exploration-game` now require `sw2d.world-graph` and carry
  role `world-graph`; `LIMITATIONS.worldGraphAndMap` **removed** (constant
  deleted). `metroidvania` stays `smoke-validated`. Seventeen packs now have a
  preset consumer.
- Also fixed a pre-existing timing flake in the Phase-5 `lane-defense` proof
  (`advanceOk` polled instead of a fixed frame window).

## Rejected

- **A Phaser scene per room.** That is exactly the hand-coding this ADR
  removes.
- **An arbitrary condition expression.** Four bounded condition kinds, read
  through existing capabilities.
- **Folding the graph into `world.state`.** `world.state` is flags / checkpoint
  / zone state; the graph is a distinct structure with its own persistence
  shape and its own capability id (ADR-0011).
- **Persisting level or runtime objects.** Only ids are saved.
- **A visual node-graph editor in the Workbench.** A structured read-only list
  plus validation is the "smallest practical" surface the phase asks for.
