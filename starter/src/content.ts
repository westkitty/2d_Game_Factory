import type { AssetDescriptor, ContentBundle, ContentSource } from '@sw2d/contracts';

/**
 * The Phase 1 content bundle.
 *
 * Everything is generated in-process, so the slice runs before a single piece of
 * art exists - which is the point: foundation work must never be blocked on
 * sourcing or licensing assets. Phase 2 replaces this inline source with a
 * schema-validated JSON source; the runtime does not change when it does,
 * because it only ever sees a ContentBundle.
 */
const ASSETS: readonly AssetDescriptor[] = [
  {
    role: 'player',
    key: 'placeholder/player',
    spec: {
      kind: 'generated',
      width: 28,
      height: 44,
      fill: '#65d0a8',
      stroke: '#0b0d13',
      strokeWidth: 2,
      cornerRadius: 6,
    },
  },
  {
    role: 'platform',
    key: 'placeholder/platform',
    spec: {
      kind: 'generated',
      width: 64,
      height: 16,
      fill: '#39415a',
      stroke: '#5a678f',
      strokeWidth: 1,
    },
  },
  {
    role: 'pickup',
    key: 'placeholder/pickup',
    spec: { kind: 'generated', width: 14, height: 14, fill: '#f0c274', cornerRadius: 7 },
  },
];

export const starterContent: ContentSource = {
  id: 'sw2d-foundation-slice',
  load: async (): Promise<ContentBundle> => ({
    id: 'sw2d-foundation-slice',
    schemaVersion: 1,
    assets: ASSETS,
    // Wording lives with the game, never in reusable runtime code.
    ui: {
      title: 'SW2D FOUNDATION',
      subtitle: 'phase 1 vertical slice',
      startPrompt: 'PRESS ENTER / SPACE / TAP A',
      playHint: 'ARROWS or A/D move  -  SPACE jump  -  P pause',
      pausedRestart: 'K / C  RESTART RUN',
      pausedQuit: 'BACKSPACE  TITLE',
    },
    data: {},
  }),
};
