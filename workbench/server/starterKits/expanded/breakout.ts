import type { StarterKit } from '../contracts.ts';
import { breakoutStarterKit } from './builders/breakout.ts';

const baseStarterKit = breakoutStarterKit();
const THEME_ROLES = ['player', 'enemy', 'platform', 'pickup', 'hazard', 'checkpoint', 'exit', 'particle'] as const;

function themeWithParticle(): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    id: 'default',
    displayName: 'Default',
    assets: [
      { role: 'player', key: 'theme/default/player', spec: { kind: 'generated', width: 28, height: 44, fill: '#65d0a8', stroke: '#0b0d13', strokeWidth: 2, cornerRadius: 6 } },
      { role: 'enemy', key: 'theme/default/enemy', spec: { kind: 'generated', width: 26, height: 26, fill: '#e05fa0', stroke: '#3a0010', strokeWidth: 2 } },
      { role: 'platform', key: 'theme/default/platform', spec: { kind: 'generated', width: 64, height: 16, fill: '#39415a', stroke: '#5a678f', strokeWidth: 1 } },
      { role: 'pickup', key: 'theme/default/pickup', spec: { kind: 'generated', width: 14, height: 14, fill: '#f0c274', cornerRadius: 7 } },
      { role: 'hazard', key: 'theme/default/hazard', spec: { kind: 'generated', width: 20, height: 18, fill: '#e0574f', stroke: '#7a1f1a', strokeWidth: 1 } },
      { role: 'checkpoint', key: 'theme/default/checkpoint', spec: { kind: 'generated', width: 20, height: 24, fill: '#4f9ee0', stroke: '#173a5c', strokeWidth: 1 } },
      { role: 'exit', key: 'theme/default/exit', spec: { kind: 'generated', width: 22, height: 44, fill: '#b98af0', stroke: '#3a2159', strokeWidth: 1 } },
      { role: 'particle', key: 'theme/default/particle', spec: { kind: 'generated', width: 10, height: 10, fill: '#ffe28a', cornerRadius: 5 } },
    ],
    tokens: {
      background: '#0b0d13',
      panel: '#1a1f2b',
      panelActive: '#2b3446',
      text: '#e8ecf4',
      accent: '#65d0a8',
      border: '#384054',
    },
    fonts: { ui: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
    highContrastTokens: {
      background: '#000000',
      panel: '#000000',
      panelActive: '#1a1a1a',
      text: '#ffffff',
      accent: '#ffe14d',
      border: '#ffffff',
    },
  }, null, 2)}\n`;
}

function resourceManifestWithParticle(gameId: string): string {
  return `${JSON.stringify({
    manifestVersion: 1,
    updated: 'generated-at-scaffold',
    category: 'visual',
    records: THEME_ROLES.map((role) => ({
      id: `${gameId}.default.${role}`,
      category: 'visual',
      sourceKind: 'project-owned',
      license: 'project-owned',
      attributionRequired: false,
      modificationStatus: 'generated',
      localPath: 'content/themes/default/theme.json',
      status: 'approved',
    })),
  }, null, 2)}\n`;
}

/**
 * Breakout declares `particle` as a useful semantic role. The canonical
 * scaffold theme currently contains only the seven universal roles, so this
 * starter extends its generated game-side theme and provenance manifest with
 * one additional swappable placeholder role instead of hard-coding an effect
 * texture or changing the shared generator for every preset.
 */
export const starterKit: StarterKit = {
  ...baseStarterKit,
  overlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
    const files = new Map(baseStarterKit.overlay(gameId, displayName));
    files.set('content/themes/default/theme.json', themeWithParticle());
    files.set('resources/RESOURCE_MANIFEST.json', resourceManifestWithParticle(gameId));
    return files;
  },
};
