import type { ControllerFamily } from '@sw2d/contracts';

/**
 * One shared template per real controller family (MASTER_PROJECT.md section
 * 8) - never one per recipe. A preset's *primary* controller family
 * (`controllerFamilies[0]`) selects which shell is copied; secondary
 * families are documented in the generated README, not separately
 * implemented (section 8: "Secondary controller families may be
 * represented in metadata/docs without elaborate shell behavior").
 */
const SHELL_FILE_BY_FAMILY: Readonly<Record<ControllerFamily, string>> = {
  platform: 'platformShellPack.ts',
  'top-down': 'topDownShellPack.ts',
  vehicle: 'vehicleShellPack.ts',
  grid: 'gridShellPack.ts',
  pointer: 'pointerShellPack.ts',
  'ui-simulation': 'uiSimulationShellPack.ts',
};

/** The pack id every shell template declares itself as - `game.<family>-shell`, checked by shellTemplates.test.ts against the real template source. */
export function shellPackId(family: ControllerFamily): string {
  return `game.${family}-shell`;
}

export function shellFileFor(controllerFamilies: readonly ControllerFamily[]): string {
  const primary = controllerFamilies[0];
  if (!primary) throw new Error('A preset must declare at least one controller family.');
  const file = SHELL_FILE_BY_FAMILY[primary];
  if (!file) throw new Error(`No generator shell template for controller family "${primary}".`);
  return file;
}

export const ALL_CONTROLLER_FAMILIES: readonly ControllerFamily[] = [
  'platform',
  'top-down',
  'vehicle',
  'grid',
  'pointer',
  'ui-simulation',
];
