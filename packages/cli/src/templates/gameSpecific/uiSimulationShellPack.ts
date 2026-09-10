import type { AdvancedPhysicsService, InstalledSystemPack } from '@sw2d/contracts';
import {
  bindStarterEconomy,
  bindStarterNeeds,
  bindStarterDialogue,
  bindStarterLocalPlay,
  bindStarterTiming,
  bindStarterSimulation,
  bindStarterNarrative,
  createAdvancedPhysics,
  mutedStyle,
  uiSimulationController,
  type SceneContext,
  type ScenePackDefinition,
} from '@sw2d/runtime';
import { NARRATIVE_STARTER, SIMULATION_STARTER } from './packConfig.ts';

/**
 * Generated starter shell: ui-simulation controller family.
 *
 * A menu-style selection loop - `navigateLeft`/`navigateRight` cycle a
 * fixed option list, `confirm` locks one in. When `sw2d.economy` is
 * installed the option list is replaced by the reusable shop/kitchen/factory
 * loop (Category-C Wave 1). When `sw2d.needs` is installed it is replaced
 * by the creature/habitat/companion care loop (Wave 2). When
 * `sw2d.dialogue` is installed it is replaced by the novel/adventure
 * reading loop (Wave 3). When `SIMULATION_STARTER` is farm or colony the
 * option list is replaced by the existing `sw2d.simulation` ledger/jobs
 * (Wave 13). When `NARRATIVE_STARTER` is fiction the option list is
 * replaced by menu verbs on `sw2d.narrative` (Wave 14). See
 * platformShellPack.ts's file comment for the template pattern.
 */

const OPTIONS = ['Option A', 'Option B', 'Option C', 'Option D'];

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.ui-simulation-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;

    let selectionIndex = 0;
    let confirmed = false;

    const economy = bindStarterEconomy(context);
    const needs = bindStarterNeeds(context);
    const dialogue = bindStarterDialogue(context);
    const seats = bindStarterLocalPlay(context);
    const clock = bindStarterTiming(context);
    const jobs = bindStarterSimulation(context, { mode: SIMULATION_STARTER });
    const story = bindStarterNarrative(context, { mode: NARRATIVE_STARTER });

    // Optional advanced physics (capability program Phase 9). Inert unless
    // content/game.json sets physicsProfile: 'matter'. Then a ball drops onto a
    // static floor through the reusable Matter-backed service; CONFIRM nudges
    // it. A full pinball table is game-specific code built on this.
    const physics: AdvancedPhysicsService | null = context.definition.physicsProfile === 'matter' ? createAdvancedPhysics(scene) : null;
    const ball = physics?.enabled
      ? (() => {
          physics.createBody({ id: 'table-floor', x: width * 0.5, y: height - 20, shape: { kind: 'rect', width, height: 24 }, static: true, category: 'terrain' });
          return physics.createBody({ id: 'ball', x: width * 0.5, y: 60, shape: { kind: 'circle', radius: 12 }, restitution: 0.7, category: 'prop' });
        })()
      : null;

    const label = economy.active || needs.active || dialogue.active || seats.active || clock.active || jobs.active || story.active
      ? null
      : scene.add
          .text(width * 0.5, height * 0.5, '', mutedStyle(20))
          .setOrigin(0.5)
          .setScrollFactor(0);

    function render(): void {
      if (!label) return;
      const marker = confirmed ? '[confirmed] ' : '';
      label.setText(`${marker}< ${OPTIONS[selectionIndex]} >`);
    }
    render();

    const debugHandle = context.debug.contribute('game.ui-simulation-shell', () => ({
      selectionIndex,
      confirmed,
      ...(economy.active ? { economy: economy.snapshot() } : {}),
      ...(needs.active ? { needs: needs.snapshot() } : {}),
      ...(dialogue.active ? { dialogue: dialogue.snapshot() } : {}),
      ...(seats.active ? { localPlay: seats.snapshot() } : {}),
      ...(clock.active ? { timing: clock.snapshot() } : {}),
      ...(jobs.active ? { simulation: jobs.snapshot() } : {}),
      ...(story.active ? { narrative: story.snapshot() } : {}),
      ...(physics ? { physics: { enabled: physics.enabled, bodyCount: physics.bodyCount, ball: ball ? physics.bodyState(ball) : null } } : {}),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs = 16): void {
        if (disposed) return;
        const intent = uiSimulationController.read(context.input);
        if (economy.active) {
          if (intent.navigateLeftPressed || intent.navigateUpPressed) economy.select(-1);
          else if (intent.navigateRightPressed || intent.navigateDownPressed) economy.select(1);
          if (intent.confirmPressed) economy.serve();
          if (context.input.justPressed('SECONDARY_ACTION')) economy.secondary();
          economy.render();
          return;
        }
        if (needs.active) {
          if (intent.navigateLeftPressed || intent.navigateUpPressed) needs.select(-1);
          else if (intent.navigateRightPressed || intent.navigateDownPressed) needs.select(1);
          if (intent.confirmPressed) needs.act();
          if (intent.primaryPressed) needs.actByIndex(0);
          if (context.input.justPressed('SECONDARY_ACTION')) needs.actByIndex(1);
          needs.render();
          return;
        }
        if (dialogue.active) {
          const snap = dialogue.snapshot();
          if (intent.navigateLeftPressed || intent.navigateUpPressed) {
            if (snap.selectedIndex > 0) dialogue.select(-snap.selectedIndex);
          } else if (intent.navigateRightPressed || intent.navigateDownPressed) {
            if (snap.selectedIndex < Math.max(0, snap.choices.length - 1)) dialogue.select(1);
          }
          if (intent.confirmPressed) {
            if (dialogue.snapshot().kind === 'choice') dialogue.choose();
            else dialogue.advance();
          }
          dialogue.render();
          return;
        }
        if (seats.active) {
          if (intent.confirmPressed || intent.primaryPressed) seats.act();
          seats.render();
          return;
        }
        if (clock.active) {
          clock.tick(deltaMs);
          if (intent.confirmPressed || intent.primaryPressed) clock.hit();
          clock.render();
          return;
        }
        if (jobs.active) {
          jobs.tick(deltaMs);
          if (intent.navigateLeftPressed || intent.navigateUpPressed) jobs.select(-1);
          else if (intent.navigateRightPressed || intent.navigateDownPressed) jobs.select(1);
          if (intent.confirmPressed || intent.primaryPressed) jobs.confirm();
          jobs.render();
          return;
        }
        if (story.active) {
          if (intent.navigateLeftPressed || intent.navigateUpPressed) story.select(-1);
          else if (intent.navigateRightPressed || intent.navigateDownPressed) story.select(1);
          if (intent.confirmPressed || intent.primaryPressed) story.act();
          story.render();
          return;
        }
        if (intent.navigateLeftPressed) {
          selectionIndex = (selectionIndex - 1 + OPTIONS.length) % OPTIONS.length;
          confirmed = false;
          render();
        } else if (intent.navigateRightPressed) {
          selectionIndex = (selectionIndex + 1) % OPTIONS.length;
          confirmed = false;
          render();
        } else if (intent.confirmPressed) {
          confirmed = true;
          context.audio.playCue('ui.confirm');
          render();
          if (physics && ball) physics.applyImpulse(ball, 0, -140);
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        economy.dispose();
        needs.dispose();
        dialogue.dispose();
        seats.dispose();
        clock.dispose();
        jobs.dispose();
        story.dispose();
        physics?.dispose();
        try {
          label?.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
