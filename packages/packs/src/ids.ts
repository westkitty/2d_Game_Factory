/**
 * Stable pack and capability ids for every Phase 4 family, in one place so
 * they never drift into scattered string literals. A pack's id and the
 * capability id(s) it provides are deliberately different strings: a pack
 * could in principle be swapped for another implementation providing the
 * same capability.
 *
 * Capability ids follow the project convention (ADR-0011): a reserved
 * `<family>` segment, a dot, and the specific service that family member
 * publishes. The segment before the dot claims a family; the segment after
 * it claims one capability *within* that family, so the fuller systems each
 * family will grow (MASTER_PROJECT.md §9 - combat weapons/projectiles, world
 * tilemaps/camera zones, ...) still have room to publish alongside these
 * foundational cores instead of colliding with them.
 */

export const PACK_IDS = {
  combat: 'sw2d.combat',
  ai: 'sw2d.ai',
  world: 'sw2d.world',
  worldEntities: 'sw2d.world-entities',
  progression: 'sw2d.progression',
  arcade: 'sw2d.arcade',
  puzzle: 'sw2d.puzzle',
  simulation: 'sw2d.simulation',
  narrative: 'sw2d.narrative',
  strategy: 'sw2d.strategy',
  items: 'sw2d.items',
  weapons: 'sw2d.weapons',
  encounters: 'sw2d.encounters',
  navigation: 'sw2d.navigation',
  puzzleRules: 'sw2d.puzzle-rules',
  generation: 'sw2d.generation',
  worldGraph: 'sw2d.world-graph',
  vehicles: 'sw2d.vehicles',
  racing: 'sw2d.racing',
  aiPerception: 'sw2d.ai-perception',
  climbing: 'sw2d.climbing',
  runs: 'sw2d.runs',
  strategyActions: 'sw2d.strategy-actions',
  ballPaddle: 'sw2d.ball-paddle',
  rhythm: 'sw2d.rhythm',
  simulationAgents: 'sw2d.simulation-agents',
  economy: 'sw2d.economy',
  dialogue: 'sw2d.dialogue',
  /** Post-ten Phase 21: towers, bases, lane objectives and capture zones. */
  defense: 'sw2d.defense',
  autoCombat: 'sw2d.auto-combat',
} as const;

export const CAPABILITY_IDS = {
  combat: 'combat.health',
  ai: 'ai.state',
  world: 'world.state',
  /** Phase 6: entity registry, sitting alongside world.state exactly as ADR-0011 anticipated. */
  entities: 'world.entities',
  progression: 'progression.state',
  arcade: 'arcade.score',
  puzzle: 'puzzle.state',
  simulation: 'simulation.resources',
  narrative: 'narrative.state',
  strategy: 'strategy.turns',
  /** Capability program Phase 2: data-driven item definitions, inventory and effects. */
  items: 'items.state',
  /** Capability program Phase 3: data-driven weapon/projectile model (composes with combat.health). */
  weapons: 'combat.weapons',
  /** Capability program Phase 4: waves / phases / bullet patterns / boss phases. */
  encounters: 'combat.encounters',
  /** Capability program Phase 5: deterministic grid pathfinding + reachable range. */
  navigation: 'world.navigation',
  /** Capability program Phase 6: bounded data-driven puzzle rules (sits alongside puzzle.state). */
  puzzleRules: 'puzzle.rules',
  /** Capability program Phase 7: deterministic seeded procedural generation of normalized worlds. */
  generation: 'world.generation',
  /** Capability program Phase 8: location graph, room transitions and map (composes with world.state). */
  worldGraph: 'world.graph',
  /** Capability program Phase 10: reusable vehicle handling (consumes VehicleIntent only). */
  vehicles: 'vehicle.motion',
  /** Capability program Phase 10: race / checkpoint / lap state, separate from vehicle motion. */
  racing: 'race.state',
  /** Capability program Phase 11: AI perception, vision cones, noise events, awareness. */
  aiPerception: 'ai.perception',
  /** Capability program Phase 11: pursuit pressure calculation and state. */
  aiPursuit: 'ai.pursuit',
  /** Capability program Phase 12: platformer climbing, wall-slide, wall-jump & ledge-hang. */
  climbing: 'movement.climbing',
  /** Capability program Phase 13: run lifecycle & roguelite meta-progression. */
  runs: 'progression.runs',
  /** Capability program Phase 14: order lifecycle for RTS/tactics units (sits alongside strategy.turns). */
  strategyOrders: 'strategy.orders',
  /** Capability program Phase 14: bounded tactical actions - range, cost, cooldown, validity. */
  strategyTactics: 'strategy.tactics',
  /** Post-ten Phase 16: ball/paddle arcade simulation (breakout, pong). */
  ballPaddle: 'arcade.ball-paddle',
  /** Post-ten Phase 17: chart judgement against the audio transport. */
  rhythm: 'arcade.rhythm',
  /** Post-ten Phase 17: seeded reaction-test state machine. */
  reaction: 'arcade.reaction',
  /**
   * Post-ten Phase 17: playback position. Provided by the game (the runtime's
   * browser transport, or a scripted one in QA) and consumed by sw2d.rhythm, so
   * the chart is judged against the same clock the music plays on.
   */
  audioTransport: 'audio.transport',
  /**
   * Post-ten Phase 18: needs, utility behaviour, schedules, relationships and
   * work orders. Sits alongside `ai.state` (combat state machines) and
   * `ai.perception` rather than replacing either - an agent here is deciding
   * what it wants, not reacting to a threat.
   */
  simulationAgents: 'simulation.agents',
  /**
   * Post-ten Phase 19: goods, stock, prices and transactions; customer arrival,
   * queueing and service; bounded offline catch-up; prestige. The shop's wallet
   * is `progression.state`, never a second balance.
   */
  economy: 'simulation.economy',
  /** Post-ten Phase 19: recipes, stations, timed jobs and station placement. */
  production: 'simulation.production',
  /**
   * Post-ten Phase 19: the injected wall clock, provided by the game (the
   * runtime ships a browser one). Read **only** at the load/resume boundary, so
   * no contract or pack ever calls `Date.now()` itself.
   */
  wallClock: 'time.wall-clock',
  /**
   * Post-ten Phase 20: an authored dialogue graph and where in it the game is.
   * Distinct from `narrative.state`, which owns the flags, codex entries and
   * choice record a dialogue *writes to* - this owns the script, not the state.
   */
  dialogue: 'narrative.dialogue',
  /** Post-ten Phase 21: placement, targeting, lanes and base breach state. */
  defense: 'strategy.defense',
  /** Post-ten Phase 21: capture ownership and score, separate from turn order. */
  territory: 'strategy.territory',
  autoCombat: 'strategy.auto-combat',
} as const;
