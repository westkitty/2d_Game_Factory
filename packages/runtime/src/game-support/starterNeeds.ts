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
  readonly selectedCreatureIndex: number;
  readonly creatures: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly x: number;
    readonly y: number;
    readonly activityId: string | null;
    readonly activityName: string | null;
    readonly decisions: number;
    readonly needValues: Readonly<Record<string, number>>;
  }[];
  readonly relationships: readonly { readonly a: string; readonly b: string; readonly affinity: number }[];
  readonly loadOutcome: string;
}

export interface StarterNeedsBinding {
  readonly active: boolean;
  select(delta: number): void;
  act(): void;
  actByIndex(index: number): void;
  selectCreature(delta: number): void;
  snapshot(): StarterNeedsSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterNeedsBinding = {
  active: false,
  select: () => undefined,
  act: () => undefined,
  actByIndex: () => undefined,
  selectCreature: () => undefined,
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
    selectedCreatureIndex: 0,
    creatures: [],
    relationships: [],
    loadOutcome: 'unavailable',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

export function bindStarterNeeds(context: SceneContext, options?: { readonly hud?: boolean }): StarterNeedsBinding {
  if (!context.capabilities.has(NEEDS_CAPABILITY_ID)) return INERT;
  const needs = context.capabilities.require<NeedsService>(NEEDS_CAPABILITY_ID);
  if (!needs.active()) return INERT;
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
  const actorSprites = hud
    ? needs.creatures().map((creature, index) => ({
        circle: scene.add.circle(creature.x, creature.y, 20, [0x65d0a8, 0x7aa2f7, 0xf0c274][index % 3]!, 1).setDepth(10),
        label: scene.add.text(creature.x, creature.y + 30, '', mutedStyle(12)).setOrigin(0.5).setDepth(11),
      }))
    : [];

  function snapshot(): StarterNeedsSnapshot {
    const needValues: Record<string, number> = {};
    for (const need of needs.needs()) needValues[need.id] = need.value;
    const selected = needs.actions()[needs.selectedIndex()];
    const creatures = needs.creatures().map((creature) => ({
      ...creature,
      needValues: Object.fromEntries(creature.needs.map((need) => [need.id, need.value])),
    }));
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
      selectedCreatureIndex: needs.selectedCreatureIndex(),
      creatures,
      relationships: needs.relationships(),
      loadOutcome: needs.loadOutcome(),
    };
  }

  function render(): void {
    const creatureStates = needs.creatures();
    for (let index = 0; index < actorSprites.length; index++) {
      const visual = actorSprites[index];
      const creature = creatureStates[index];
      if (!visual || !creature) continue;
      visual.circle.setPosition(creature.x, creature.y).setStrokeStyle(index === needs.selectedCreatureIndex() ? 4 : 1, 0xffffff, 0.9);
      visual.label.setPosition(creature.x, creature.y + 30).setText(`${creature.displayName}: ${creature.activityName ?? 'idle'}`);
    }
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

    const relationshipLine = needs.relationships().length
      ? needs.relationships().map((relationship) => `${relationship.a}/${relationship.b} ${Math.round(relationship.affinity)}`).join('   ')
      : `affinity ${Math.round(needs.affinity())}`;
    body.setText([needLine || 'no needs', selectionLine, holdLine, relationshipLine].join('\n\n'));

    const last = needs.lastResult();
    const outcome = needs.outcome();
    status.setText(outcome !== 'playing' ? outcome.toUpperCase() : last ? `last: ${last}` : '');
    const first = needs.actions()[0]?.displayName ?? 'act';
    const second = needs.actions()[1]?.displayName ?? 'act';
    hint.setText(`J ${first}   K ${second}   LEFT/RIGHT action   UP/DOWN creature`);
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
    selectCreature(delta: number): void {
      needs.selectCreatureByDelta(delta);
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
        for (const visual of actorSprites) {
          visual.circle.destroy();
          visual.label.destroy();
        }
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
