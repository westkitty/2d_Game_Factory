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
} as const;
