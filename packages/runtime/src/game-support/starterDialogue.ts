import { DIALOGUE_CAPABILITY_ID, type DialogueService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated ui-simulation / pointer shell to `sw2d.dialogue`
 * (Category-C Wave 3).
 *
 * Inert unless the game installed the pack and the catalog has conversations.
 * Presentation is a high-contrast HUD so a novel / inspect loop is readable
 * in the first short play session. `{ hud: false }` lets expanded kits keep
 * their own presentation.
 */

export interface StarterDialogueSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly kind: string;
  readonly conversationId: string | null;
  readonly nodeId: string | null;
  readonly speaker: string;
  readonly text: string;
  readonly choices: readonly { id: string; text: string }[];
  readonly selectedIndex: number;
  readonly selectedId: string | null;
  readonly flags: readonly string[];
  readonly branch: string | null;
  readonly ending: string | null;
  readonly outcome: string;
  readonly step: number;
  readonly lastResult: string | null;
  readonly hotspots: readonly { id: string; conversationId: string; x: number; y: number; locked: boolean }[];
  readonly scene: { readonly id: string; readonly title: string; readonly background: string; readonly backgroundImage?: string } | null;
  readonly speakerPresentation: { readonly id: string; readonly portrait: string; readonly position: string; readonly color?: string } | null;
}

export interface StarterDialogueBinding {
  readonly active: boolean;
  select(delta: number): void;
  advance(): void;
  choose(): void;
  start(conversationId: string): void;
  snapshot(): StarterDialogueSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterDialogueBinding = {
  active: false,
  select: () => undefined,
  advance: () => undefined,
  choose: () => undefined,
  start: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    kind: 'idle',
    conversationId: null,
    nodeId: null,
    speaker: '',
    text: '',
    choices: [],
    selectedIndex: 0,
    selectedId: null,
    flags: [],
    branch: null,
    ending: null,
    outcome: 'playing',
    step: 0,
    lastResult: null,
    hotspots: [],
    scene: null,
    speakerPresentation: null,
  }),
  render: () => undefined,
  dispose: () => undefined,
};

export function bindStarterDialogue(context: SceneContext, options?: { readonly hud?: boolean }): StarterDialogueBinding {
  if (!context.capabilities.has(DIALOGUE_CAPABILITY_ID)) return INERT;
  const dialogue = context.capabilities.require<DialogueService>(DIALOGUE_CAPABILITY_ID);
  if (!dialogue.active()) return INERT;
  dialogue.reset();
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 36, '', headingStyle(22)).setOrigin(0.5).setScrollFactor(0) : null;
  const body = hud
    ? scene.add
        .text(width * 0.5, height * 0.42, '', headingStyle(18))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setWordWrapWidth(width - 80)
    : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 36, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0) : null;
  const status = hud ? scene.add.text(width * 0.5, height - 64, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0) : null;
  const backdrop = hud ? scene.add.rectangle(width * 0.5, height * 0.42, width - 48, height * 0.58, 0x17233d, 0.96).setDepth(-10) : null;
  const portrait = hud ? scene.add.rectangle(width * 0.22, height * 0.46, 150, 230, 0x8a93a6, 0.95).setStrokeStyle(3, 0xffffff, 0.85).setDepth(-5) : null;
  const portraitLabel = hud ? scene.add.text(width * 0.22, height * 0.46, '', headingStyle(16)).setOrigin(0.5).setDepth(-4).setWordWrapWidth(130) : null;

  function snapshot(): StarterDialogueSnapshot {
    const selected = dialogue.choices()[dialogue.selectedIndex()];
    return {
      active: true,
      mode: dialogue.mode(),
      kind: dialogue.kind(),
      conversationId: dialogue.conversationId(),
      nodeId: dialogue.nodeId(),
      speaker: dialogue.speaker(),
      text: dialogue.text(),
      choices: dialogue.choices(),
      selectedIndex: dialogue.selectedIndex(),
      selectedId: selected?.id ?? null,
      flags: dialogue.flags(),
      branch: dialogue.branch(),
      ending: dialogue.ending(),
      outcome: dialogue.outcome(),
      step: dialogue.step(),
      lastResult: dialogue.lastResult(),
      hotspots: dialogue.hotspots(),
      scene: dialogue.presentation().scene,
      speakerPresentation: dialogue.presentation().speaker,
    };
  }

  function render(): void {
    const presentation = dialogue.presentation();
    const parseColor = (value: string | undefined, fallback: number): number => value && /^#[0-9a-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fallback;
    backdrop?.setFillStyle(parseColor(presentation.scene?.background, 0x17233d), 0.96);
    if (portrait && portraitLabel) {
      const px = presentation.speaker?.position === 'right' ? width * 0.78 : presentation.speaker?.position === 'center' ? width * 0.5 : width * 0.22;
      portrait.setPosition(px, height * 0.46).setFillStyle(parseColor(presentation.speaker?.color, 0x8a93a6), presentation.speaker ? 0.95 : 0.2);
      portraitLabel.setPosition(px, height * 0.46).setText(presentation.speaker ? `${presentation.speaker.displayName}\n\n${presentation.speaker.portrait}` : '');
    }
    if (!title || !body || !hint || !status) return;
    const modeLabel = dialogue.mode() === 'adventure' ? 'ADVENTURE' : 'NOVEL';
    title.setText(`${presentation.scene?.title?.toUpperCase() ?? modeLabel}${dialogue.speaker() ? `  ·  ${dialogue.speaker().toUpperCase()}` : ''}`);

    if (dialogue.kind() === 'idle') {
      body.setText(dialogue.mode() === 'adventure' ? 'Click a hotspot.' : '');
    } else if (dialogue.kind() === 'choice') {
      const lines = dialogue.choices().map((c, i) => (i === dialogue.selectedIndex() ? `[ ${c.text} ]` : `  ${c.text}  `));
      body.setText([dialogue.text(), '', ...lines].join('\n'));
    } else {
      body.setText(dialogue.text());
    }

    const last = dialogue.lastResult();
    const outcome = dialogue.outcome();
    status.setText(outcome !== 'playing' ? (dialogue.ending() ?? outcome).toUpperCase() : last && last !== 'advanced' ? `last: ${last}` : '');
    hint.setText(
      dialogue.kind() === 'choice'
        ? 'ARROWS pick   ENTER chooses'
        : dialogue.kind() === 'idle'
          ? 'CLICK A HOTSPOT'
          : 'ENTER advances',
    );
  }

  render();

  let disposed = false;
  return {
    active: true,
    select(delta: number): void {
      dialogue.selectByDelta(delta);
      render();
    },
    advance(): void {
      dialogue.advance();
      context.audio.playCue('ui.confirm');
      render();
    },
    choose(): void {
      dialogue.choose();
      context.audio.playCue('ui.confirm');
      render();
    },
    start(conversationId: string): void {
      dialogue.start(conversationId);
      context.audio.playCue('ui.confirm');
      render();
    },
    snapshot,
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        body?.destroy();
        hint?.destroy();
        status?.destroy();
        backdrop?.destroy();
        portrait?.destroy();
        portraitLabel?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
