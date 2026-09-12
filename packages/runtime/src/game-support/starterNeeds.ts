import { NEEDS_CAPABILITY_ID, type NeedsService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated ui-simulation shell to `sw2d.needs` (Category-C Wave 2).
 *
 * Inert unless the game installed the pack and the catalog has needs.
 * Presentation is a high-contrast HUD so a pet / habitat / companion is
 * readable in the first short play session. `{ hud: false }` lets expanded
 * starter kits keep their own presentation.
 */

export interface StarterNeedsSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly subject: string | null;
  readonly needValues: Readonly<Record<string, number>>;
  readonly needs: readonly { id: string; displayName: string; value: number }[];
  readonly selectedIndex: number;
  readonly selectedId: string | null;
  readonly affinity: number;
  readonly holdMs: number;
  readonly actionsTaken: number;
  readonly outcome: string;
  readonly lastResult: string | null;
}

export interface StarterNeedsBinding {
  readonly active: boolean;
  select(delta: number): void;
  act(): void;
  actByIndex(index: number): void;
  snapshot(): StarterNeedsSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterNeedsBinding = {
  active: false,
  select: () => undefined,
  act: () => undefined,
  actByIndex: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    subject: null,
    needValues: {},
    needs: [],
    selectedIndex: 0,
    selectedId: null,
    affinity: 0,
    holdMs: 0,
    actionsTaken: 0,
    outcome: 'playing',
    lastResult: null,
  }),
  render: () => undefined,
  dispose: () => undefined,
};

export function bindStarterNeeds(context: SceneContext, options?: { readonly hud?: boolean }): StarterNeedsBinding {
  if (!context.capabilities.has(NEEDS_CAPABILITY_ID)) return INERT;
  const needs = context.capabilities.require<NeedsService>(NEEDS_CAPABILITY_ID);
  if (!needs.active()) return INERT;
  needs.reset();
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

  function snapshot(): StarterNeedsSnapshot {
    const needValues: Record<string, number> = {};
    for (const need of needs.needs()) needValues[need.id] = need.value;
    const selected = needs.actions()[needs.selectedIndex()];
    return {
      active: true,
      mode: needs.mode(),
      subject: needs.subject().displayName,
      needValues,
      needs: needs.needs().map((n) => ({ id: n.id, displayName: n.displayName, value: n.value })),
      selectedIndex: needs.selectedIndex(),
      selectedId: selected?.id ?? null,
      affinity: needs.affinity(),
      holdMs: needs.holdMs(),
      actionsTaken: needs.actionsTaken(),
      outcome: needs.outcome(),
      lastResult: needs.lastResult(),
    };
  }

  function render(): void {
    if (!title || !body || !hint || !status) return;
    const modeLabel = needs.mode() === 'habitat' ? 'HABITAT' : needs.mode() === 'companion' ? 'COMPANION' : 'CREATURE';
    title.setText(`${modeLabel}  ·  ${needs.subject().displayName.toUpperCase()}`);

    const needLine = needs
      .needs()
      .map((n) => `${n.displayName} ${Math.round(n.value)}`)
      .join('   ');
    const action = needs.actions()[needs.selectedIndex()];
    const selectionLine = action ? `> ${action.displayName}` : '> (no actions)';
    const holdTarget = needs.mode() === 'companion' ? 0 : needs.mode() === 'habitat' ? 7 : 1.6;
    const holdLine =
      holdTarget > 0
        ? `hold ${(needs.holdMs() / 1000).toFixed(1)}s / ${holdTarget}s   actions ${needs.actionsTaken()}`
        : `actions ${needs.actionsTaken()}`;

    body.setText([needLine || 'no needs', selectionLine, holdLine, `affinity ${Math.round(needs.affinity())}`].join('\n\n'));

    const last = needs.lastResult();
    const outcome = needs.outcome();
    status.setText(outcome !== 'playing' ? outcome.toUpperCase() : last ? `last: ${last}` : '');
    const first = needs.actions()[0]?.displayName ?? 'act';
    const second = needs.actions()[1]?.displayName ?? 'act';
    hint.setText(`J ${first}   K ${second}   ARROWS pick   ENTER acts`);
  }

  render();

  let disposed = false;
  return {
    active: true,
    select(delta: number): void {
      needs.selectByDelta(delta);
      render();
    },
    act(): void {
      needs.act();
      context.audio.playCue('ui.confirm');
      render();
    },
    actByIndex(index: number): void {
      needs.actByIndex(index);
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
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
