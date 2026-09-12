/**
 * Config for packs that declare `configSource: 'code'` in their definition -
 * config carrying functions, which content/game.json cannot express.
 *
 * Passed to createGame({ packConfig }) by src/main.ts. Packs configured as
 * JSON stay in content/game.json; nothing here overrides those.
 */

export const PACK_CONFIG: Readonly<Record<string, unknown>> = {
  // This preset selects no code-configured pack.
};

/** Category-C Wave 13: farm vs colony presentation of sw2d.simulation. Null otherwise. */
export const SIMULATION_STARTER: 'idle' | 'farm' | 'colony' | null = null;

/** Category-C Wave 14: fiction vs case presentation of sw2d.narrative. Null otherwise. */
export const NARRATIVE_STARTER: 'fiction' | 'case' | null = null;

/** Category-C Wave 15/28: fishing vs cooking vs micro presentation of sw2d.arcade. Null otherwise. */
export const ARCADE_STARTER: 'fishing' | 'cooking' | 'micro' | null = null;

/** Category-C Wave 16: draw vs wardrobe presentation of ADR-0018 interaction. Null otherwise. */
export const POINTER_STARTER: 'draw' | 'wardrobe' | null = null;

/** Category-C Wave 17: survive vs run presentation of sw2d.progression. Null otherwise. */
export const PROGRESSION_STARTER: 'survive' | 'run' | null = 'survive';

/** Category-C Wave 18: tactics vs battler presentation of sw2d.strategy. Null otherwise. */
export const STRATEGY_STARTER: 'tactics' | 'battler' | null = null;

/** Category-C Wave 19: maze vs lane presentation of sw2d.navigation. Null otherwise. */
export const NAV_STARTER: 'maze' | 'lane' | null = null;

/** Category-C Wave 20: photo vs sandbox presentation of ADR-0018 interaction. Null otherwise. */
export const TOY_STARTER: 'photo' | 'sandbox' | null = null;

/** Category-C Wave 21: room vs hold presentation of sw2d.combat. Null otherwise. */
export const COMBAT_STARTER: 'room' | 'hold' | null = null;

/** Category-C Wave 22: course vs endless presentation of auto-run. Null otherwise. */
export const RUN_STARTER: 'course' | 'endless' | null = null;

/** Category-C Wave 23: road vs craft presentation of vehicle.motion. Null otherwise. */
export const VEHICLE_STARTER: 'road' | 'craft' | null = null;

/** Category-C Wave 24: toy vs table presentation of AdvancedPhysics. Null otherwise. */
export const PHYSICS_STARTER: 'toy' | 'table' | null = null;

/** Category-C Wave 25: rts vs zone command/occupy. Null otherwise. */
export const COMMAND_STARTER: 'rts' | 'zone' | null = null;

/** Category-C Wave 26: museum vs rail look/damage. Null otherwise. */
export const LOOK_STARTER: 'museum' | 'rail' | null = null;

/** Category-C Wave 27: precision vs climb parkour. Null otherwise. */
export const PARKOUR_STARTER: 'precision' | 'climb' | null = null;

/** Category-C Wave 29: kart on-demand item-fire. Null otherwise. */
export const KART_STARTER: 'item' | null = null;

/** Category-C Wave 31: closing-wall pursuit. Null otherwise. */
export const CHASE_STARTER: 'pursuit' | null = null;

/** Final Product Completion Wave 2: room-graph dungeon (crawl) vs roguelite run (rogue). Null otherwise. */
export const DUNGEON_STARTER: 'crawl' | 'rogue' | null = null;

/** Final Product Completion Wave 3: pointer target shooter - fixed gallery vs camera rail. Null otherwise. */
export const GALLERY_STARTER: 'gallery' | 'rail' | null = null;

/** Final Product Completion Wave 3: the Asteroids rock field on the vehicle shell. Null otherwise. */
export const ASTEROIDS_STARTER: 'field' | null = null;
