import { generateTheme, generateUiCopy } from '@sw2d/cli/factory';
import { getPreset } from '@sw2d/presets';
import type { StarterKit } from '../../contracts.ts';

type SupplementalUiRole = 'background' | 'ui.panel' | 'ui.cursor' | 'ui.button' | 'particle';

const SUPPLEMENTAL_UI_ASSETS = {
  background: {
    role: 'background',
    key: 'theme/default/background',
    spec: {
      kind: 'generated',
      width: 640,
      height: 360,
      fill: '#0b0d13',
      stroke: '#1f2937',
      strokeWidth: 2,
      cornerRadius: 0,
    },
  },
  'ui.panel': {
    role: 'ui.panel',
    key: 'theme/default/ui.panel',
    spec: {
      kind: 'generated',
      width: 320,
      height: 56,
      fill: '#1a1f2b',
      stroke: '#384054',
      strokeWidth: 2,
      cornerRadius: 10,
    },
  },
  'ui.cursor': {
    role: 'ui.cursor',
    key: 'theme/default/ui.cursor',
    spec: {
      kind: 'generated',
      width: 46,
      height: 46,
      fill: '#4f9ee0',
      stroke: '#e8ecf4',
      strokeWidth: 2,
      cornerRadius: 8,
    },
  },
  'ui.button': {
    role: 'ui.button',
    key: 'theme/default/ui.button',
    spec: {
      kind: 'generated',
      width: 92,
      height: 42,
      fill: '#65d0a8',
      stroke: '#e8ecf4',
      strokeWidth: 2,
      cornerRadius: 10,
    },
  },
  particle: {
    role: 'particle',
    key: 'theme/default/particle',
    spec: {
      kind: 'generated',
      width: 12,
      height: 12,
      fill: '#ffe28a',
      stroke: '#fff7d6',
      strokeWidth: 1,
      cornerRadius: 6,
    },
  },
} as const;

function roleOf(asset: unknown): string | null {
  if (typeof asset !== 'object' || asset === null || !('role' in asset)) return null;
  const role = (asset as { readonly role?: unknown }).role;
  return typeof role === 'string' ? role : null;
}

function defaultThemeWithRoles(presetId: string, displayName: string, roles: readonly SupplementalUiRole[]): string {
  // Same ui copy the plain generator would emit (title/subtitle/playHint) -
  // overlaying a kit's theme must not silently revert the game's genre HUD
  // back to the runtime's neutral "MOVE / JUMP" copy.
  let ui: Record<string, string> | undefined;
  try {
    const preset = getPreset(presetId);
    ui = generateUiCopy({
      displayName,
      presetDisplayName: preset.displayName,
      primaryControllerFamily: preset.controllerFamilies[0]!,
      requiredPackIds: preset.requiredSystemPacks.map((selection) => selection.packId),
    });
  } catch {
    ui = undefined; // unknown preset id: theme simply carries no ui copy
  }
  const theme = generateTheme('default', 'Default', ui);
  const assets = Array.isArray(theme.assets) ? [...theme.assets] : [];
  for (const role of roles) {
    if (!assets.some((asset) => roleOf(asset) === role)) assets.push(SUPPLEMENTAL_UI_ASSETS[role]);
  }
  return `${JSON.stringify({ ...theme, assets }, null, 2)}\n`;
}

/**
 * Add only the semantic UI placeholders a starter scaffold explicitly declares.
 * This remains a normal game-side theme overlay: it does not change the shared
 * generator, runtime, preset maturity, or other starter variants.
 */
export function withDefaultThemeRoles(base: StarterKit, roles: readonly SupplementalUiRole[]): StarterKit {
  return {
    ...base,
    overlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
      const files = new Map(base.overlay(gameId, displayName));
      files.set('content/themes/default/theme.json', defaultThemeWithRoles(base.presetId, displayName, roles));
      return files;
    },
  };
}
