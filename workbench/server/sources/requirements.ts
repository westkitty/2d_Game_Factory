/**
 * Deriving a Sprite Requirement Profile from what the factory already knows.
 *
 * Nothing here is a per-genre table. The inputs are the preset's controller
 * family (which implies a camera), its starter kit's `usefulRoles` when one
 * exists (the roles that genre's real mechanics actually draw), and a small
 * set of controller-family defaults for presets without a kit. Role
 * importance is assigned by role identity, consistently across genres.
 */

import type { PresetDefinition } from '@sw2d/contracts';
import type { WorkbenchAssetRole } from '../../shared/types.ts';
import { WORKBENCH_ASSET_ROLES } from '../../shared/types.ts';
import { starterKitFor } from '../starterKits/index.ts';

function asRole(value: string): WorkbenchAssetRole | null {
  return (WORKBENCH_ASSET_ROLES as readonly string[]).includes(value) ? (value as WorkbenchAssetRole) : null;
}
import type { CameraPerspective, ProfileRole, RoleImportance, SpriteRequirementProfile } from './types.ts';

/** Camera implied by a preset's controller families. */
export function cameraForControllers(controllers: readonly string[]): CameraPerspective {
  if (controllers.includes('platform')) return 'side';
  if (controllers.includes('top-down')) return 'top-down';
  if (controllers.includes('vehicle')) return 'top-down';
  if (controllers.includes('grid')) return 'top-down';
  return 'mixed'; // pointer / ui-simulation - no strong world camera
}

/** Roles a controller family draws when there is no starter kit to read from. */
const CONTROLLER_DEFAULT_ROLES: Readonly<Record<string, readonly WorkbenchAssetRole[]>> = {
  platform: ['player', 'background', 'platform', 'pickup', 'hazard', 'enemy', 'checkpoint', 'exit'],
  'top-down': ['player', 'background', 'enemy', 'pickup', 'tile', 'hazard'],
  vehicle: ['player', 'background', 'tile', 'hazard', 'pickup', 'particle'],
  grid: ['player', 'background', 'tile', 'pickup', 'checkpoint'],
  pointer: ['background', 'ui.panel', 'ui.button', 'ui.cursor', 'player'],
  'ui-simulation': ['background', 'ui.panel', 'ui.button', 'player'],
};

/** Importance is a property of the role, not the genre - a player sprite is always core. */
const ROLE_IMPORTANCE: Readonly<Record<WorkbenchAssetRole, RoleImportance>> = {
  player: 'required',
  background: 'required',
  platform: 'important',
  tile: 'important',
  enemy: 'important',
  pickup: 'important',
  'ui.panel': 'important',
  'ui.button': 'important',
  hazard: 'optional',
  checkpoint: 'optional',
  exit: 'optional',
  particle: 'optional',
  'ui.cursor': 'optional',
};

function importanceOf(role: WorkbenchAssetRole): RoleImportance {
  return ROLE_IMPORTANCE[role] ?? 'optional';
}

/**
 * Builds the profile for one preset. `kit.usefulRoles` is preferred because it
 * is the genre's real mechanic-driven role list; the controller-family default
 * is the honest fallback when no kit has been built yet.
 */
export function deriveProfile(preset: PresetDefinition): SpriteRequirementProfile {
  const kit = starterKitFor(preset.id);
  const derivedFromKit = kit !== undefined;
  const rawRoles: readonly WorkbenchAssetRole[] = kit
    ? kit.usefulRoles.map(asRole).filter((role): role is WorkbenchAssetRole => role !== null)
    : preset.controllerFamilies.flatMap((family) => CONTROLLER_DEFAULT_ROLES[family] ?? []);

  const seen = new Set<WorkbenchAssetRole>();
  const roles: ProfileRole[] = [];
  for (const role of rawRoles) {
    if (seen.has(role)) continue;
    seen.add(role);
    roles.push({ role, importance: importanceOf(role) });
  }
  if (roles.length === 0) roles.push({ role: 'player', importance: 'required' }, { role: 'background', importance: 'required' });

  const camera = cameraForControllers(preset.controllerFamilies);
  const has = (role: WorkbenchAssetRole): boolean => seen.has(role);
  const worldCamera = camera === 'side' || camera === 'top-down' || camera === 'isometric';
  const actorGenre = has('player') && worldCamera;

  return {
    presetId: preset.id,
    presetDisplayName: preset.displayName,
    family: preset.family,
    camera,
    tileBased: has('tile') || has('platform') || preset.controllerFamilies.includes('grid'),
    roles,
    pixelArtPreferred: null, // nothing in preset metadata states this
    animationUseful: actorGenre,
    directionalAnimationUseful: actorGenre && camera === 'top-down' && preset.controllerFamilies.includes('top-down'),
    environmentArtNeeded: has('tile') || has('platform'),
    backgroundNeeded: has('background'),
    uiArtNeeded: has('ui.panel') || has('ui.button') || has('ui.cursor'),
    derivedFromKit,
  };
}
