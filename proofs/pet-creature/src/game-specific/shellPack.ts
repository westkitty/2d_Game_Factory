import {
  SIMULATION_AGENTS_CAPABILITY_ID,
  type AgentState,
  type BehaviorScore,
  type InstalledSystemPack,
  type SimulationAgentsService,
  type SimulationClock,
} from '@sw2d/contracts';
import { type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 18 proof - pet-creature.
 *
 * Everything about *what the pet wants* comes from `simulation.agents`: needs
 * drifting, urgency, thresholds, utility scoring, preconditions, cooldowns,
 * non-interruptible behaviour, completion effects, the schedule and the
 * relationship metric. The shell contributes presentation and the handful of
 * player interactions a pet game has - offer food, be present as the owner.
 *
 * Note what the shell does *not* contain: no `if (hunger < 20) eat()`. The
 * decision belongs to the capability, and the shell only supplies the world
 * facts (a tag for "there is food") the authored preconditions read.
 */

export const PET_SHELL_CAPABILITY_ID = 'game.pet-shell';

export interface PetShellState {
  readonly clock: SimulationClock;
  readonly pet: AgentState | null;
  readonly owner: AgentState | null;
  readonly scores: readonly BehaviorScore[];
  readonly bond: number;
  /** Behaviours the pet has started, in order - the decision history. */
  readonly startedBehaviors: readonly string[];
  readonly completedBehaviors: readonly string[];
  readonly interruptedBehaviors: readonly string[];
  readonly needLevelChanges: readonly string[];
  readonly scheduleChanges: readonly string[];
}

export interface PetShellService {
  state(): PetShellState;
  /** Put food down: a world fact the authored `eat` precondition reads. */
  offerFood(): boolean;
  takeFoodAway(): boolean;
  /** Remove the owner from the world, so `seek-owner` loses its target. */
  ownerLeaves(): boolean;
  /** Drain a need directly, to reach a state the drift rate would take minutes to reach. */
  drain(needId: string, amount: number): number | null;
  scores(): readonly BehaviorScore[];
  reset(): void;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: PET_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [PET_SHELL_CAPABILITY_ID],
  dependencies: [SIMULATION_AGENTS_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const agents = context.capabilities.require<SimulationAgentsService>(SIMULATION_AGENTS_CAPABILITY_ID);

    agents.spawn('pet', 'pet');
    agents.spawn('owner', 'owner');

    const petSprite = scene.add.sprite(400, 300, context.assets.resolve('player'));
    const ownerSprite = scene.add.sprite(600, 300, context.assets.resolve('enemy'));
    const foodSprite = scene.add.sprite(300, 380, context.assets.resolve('pickup')).setVisible(false);

    const startedBehaviors: string[] = [];
    const completedBehaviors: string[] = [];
    const interruptedBehaviors: string[] = [];
    const needLevelChanges: string[] = [];
    const scheduleChanges: string[] = [];

    const watches = [
      context.events.on('agents:behaviorStarted', (p) => {
        if (p.agentId === 'pet') startedBehaviors.push(p.behaviorId);
      }),
      context.events.on('agents:behaviorCompleted', (p) => {
        if (p.agentId === 'pet') completedBehaviors.push(p.behaviorId);
      }),
      context.events.on('agents:needLevelChanged', (p) => {
        if (p.agentId === 'pet') needLevelChanges.push(`${p.needId}:${p.level}`);
      }),
    ];

    function state(): PetShellState {
      return {
        clock: agents.clock(),
        pet: agents.agent('pet') ?? null,
        owner: agents.agent('owner') ?? null,
        scores: agents.evaluate('pet'),
        bond: agents.relationship('pet', 'owner', 'bond'),
        startedBehaviors: [...startedBehaviors],
        completedBehaviors: [...completedBehaviors],
        interruptedBehaviors: [...interruptedBehaviors],
        needLevelChanges: [...needLevelChanges],
        scheduleChanges: [...scheduleChanges],
      };
    }

    const shellService: PetShellService = {
      state,
      offerFood() {
        const added = agents.addTag('pet', 'has-food');
        foodSprite.setVisible(true);
        return added;
      },
      takeFoodAway() {
        const removed = agents.removeTag('pet', 'has-food');
        foodSprite.setVisible(false);
        return removed;
      },
      ownerLeaves() {
        const gone = agents.despawn('owner');
        if (gone) ownerSprite.setVisible(false);
        return gone;
      },
      drain(needId, amount) {
        return agents.adjustNeed('pet', needId, -amount)?.value ?? null;
      },
      scores: () => agents.evaluate('pet'),
      reset() {
        agents.reset();
        agents.spawn('pet', 'pet');
        agents.spawn('owner', 'owner');
        startedBehaviors.length = 0;
        completedBehaviors.length = 0;
        interruptedBehaviors.length = 0;
        needLevelChanges.length = 0;
        scheduleChanges.length = 0;
        foodSprite.setVisible(false);
        ownerSprite.setVisible(true);
      },
    };

    const serviceHandle = context.capabilities.provide(PET_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(PET_SHELL_CAPABILITY_ID, state);

    let lastActivity: string | null = null;
    let disposed = false;
    return {
      id: PET_SHELL_CAPABILITY_ID,

      update(): void {
        if (disposed) return;
        // Presentation only. The pack advances the simulation; this reads it.
        const pet = agents.agent('pet');
        if (!pet) return;
        if (pet.scheduleActivity !== lastActivity) {
          lastActivity = pet.scheduleActivity;
          scheduleChanges.push(pet.scheduleActivity ?? 'none');
        }
        // A tiny visual so the pet's chosen behaviour is legible on screen.
        petSprite.setAlpha(pet.active?.behaviorId === 'nap' ? 0.4 : 1);
        foodSprite.setVisible(pet.tags.includes('has-food'));
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        for (const watch of watches) watch.dispose();
        debugHandle.dispose();
        serviceHandle.dispose();
        try {
          petSprite.destroy();
          ownerSprite.destroy();
          foodSprite.destroy();
        } catch {
          /* tearing down */
        }
      },
    };
  },
};
