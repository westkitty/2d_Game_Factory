import type { ActionBindings } from './input.ts';
import type { SystemPackSelection } from './systems.ts';

/**
 * Genre preset contract.
 *
 * A preset is a composition recipe, never an engine fork. Defined in Phase 1 so
 * every later phase composes against a fixed shape; the catalogue itself is
 * built in Phase 7.
 */

export type ControllerFamily =
  | 'platform'
  | 'top-down'
  | 'vehicle'
  | 'grid'
  | 'pointer'
  | 'ui-simulation';

/**
 * Honest maturity labelling. A registered recipe is not a shipped genre.
 * Never promote to 'proof-validated' without an end-to-end proof journey.
 */
export type PresetMaturity = 'recipe' | 'smoke-validated' | 'proof-validated' | 'experimental';

export type InputMode = 'keyboard' | 'pointer' | 'touch' | 'gamepad';

export interface PresetDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly family: string;
  readonly maturity: PresetMaturity;
  readonly controllerFamilies: readonly ControllerFamily[];
  readonly requiredSystemPacks: readonly SystemPackSelection[];
  readonly optionalSystemPacks: readonly SystemPackSelection[];
  readonly defaultConfig: Readonly<Record<string, unknown>>;
  /** Content documents a generated game must supply, e.g. 'levels', 'tuning'. */
  readonly requiredContentRoles: readonly string[];
  /** Capability program Phase 9: when 'matter', the generated game.json opts into the Matter backend. */
  readonly physicsProfile?: 'matter';
  /** Capability program Phase 10: default vehicle profile for the generated content/vehicles.json. */
  readonly vehicleProfile?: 'car' | 'kart' | 'boat' | 'flight';
  readonly supportedInputModes: readonly InputMode[];
  readonly defaultBindings?: ActionBindings;
  readonly starterScene: string;
  /** Named validation profile the CLI runs for games built from this preset. */
  readonly validationProfile: string;
  readonly knownLimitations: readonly string[];
}
