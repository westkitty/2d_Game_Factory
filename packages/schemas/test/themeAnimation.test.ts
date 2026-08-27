import { describe, expect, it } from 'vitest';
import { validateDocument } from '../src/validator.ts';

function themeWithFrames(frameCount: number): unknown {
  return {
    schemaVersion: 1,
    id: 'animated',
    displayName: 'Animated',
    assets: [
      {
        role: 'player',
        key: 'theme/animated/player',
        spec: { kind: 'generated', width: 28, height: 44, fill: '#ffffff' },
      },
    ],
    animations: [
      {
        role: 'player',
        key: 'theme/animated/player/walk',
        frames: Array.from({ length: frameCount }, (_, index) => ({
          key: `theme/animated/player/walk/${index}`,
          url: `assets/player-${index}.png`,
        })),
        frameRate: 8,
        repeat: -1,
      },
    ],
    tokens: {
      background: '#000000',
      panel: '#111111',
      panelActive: '#222222',
      text: '#ffffff',
      accent: '#00ffff',
      border: '#444444',
    },
    fonts: { ui: 'sans-serif' },
  };
}

describe('theme animation schema', () => {
  it('accepts a local two-frame semantic-role animation', () => {
    expect(validateDocument('theme-manifest', 'animated-theme', themeWithFrames(2)).valid).toBe(true);
  });

  it('rejects a sequence that cannot animate because it has fewer than two frames', () => {
    const result = validateDocument('theme-manifest', 'animated-theme', themeWithFrames(1));
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.instancePath.includes('/animations/0/frames'))).toBe(true);
  });
});
