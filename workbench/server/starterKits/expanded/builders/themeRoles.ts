import { generateTheme } from '@sw2d/cli/factory';
import type { StarterKit } from '../../contracts.ts';

type SupplementalUiRole = 'ui.panel' | 'ui.cursor' | 'ui.button' | 'particle';

const SUPPLEMENTAL_UI_ASSETS = {
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

function defaultThemeWithRoles(roles: readonly SupplementalUiRole[]): string {
  const theme = generateTheme('default', 'Default');
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
      files.set('content/themes/default/theme.json', defaultThemeWithRoles(roles));
      return files;
    },
  };
}
