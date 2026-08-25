/**
 * Neutral presentation constants for the runtime's own scenes.
 *
 * Deliberately drab: this is scaffolding a theme pack replaces, not a visual
 * identity. Fonts are generic CSS families so nothing is ever fetched.
 */
export const RUNTIME_UI = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  background: '#11141c',
  overlay: 'rgba(8, 10, 16, 0.82)',
  textPrimary: '#e8ecf4',
  textMuted: '#8a93a6',
  accent: '#65d0a8',
} as const;

export function headingStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: RUNTIME_UI.fontFamily, fontSize: `${size}px`, color: RUNTIME_UI.textPrimary };
}

export function mutedStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: RUNTIME_UI.fontFamily, fontSize: `${size}px`, color: RUNTIME_UI.textMuted };
}

export function accentStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: RUNTIME_UI.fontFamily, fontSize: `${size}px`, color: RUNTIME_UI.accent };
}
