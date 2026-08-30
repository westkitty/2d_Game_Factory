import {
  REACTION_CAPABILITY_ID,
  type InstalledSystemPack,
  type ReactionRoundResult,
  type ReactionService,
  type ReactionState,
} from '@sw2d/contracts';
import { type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 17 proof - reaction-timing.
 *
 * The whole test is `arcade.reaction`: the seeded wait draw, the phase machine
 * (`ready` → `wait` → `stimulus` → `response` / `false-start` → `result` →
 * `summary`), the false-start rule, the timeout, and the summary statistics.
 *
 * This shell contributes the stimulus's *appearance* and the wire from a
 * semantic press to `respond()`. It measures nothing itself - the reaction
 * interval is simulation time the service accumulated, not a clock the shell read.
 */

export const REACTION_SHELL_CAPABILITY_ID = 'game.reaction-shell';

export interface ReactionShellState extends ReactionState {
  /** True exactly while the stimulus is showing - what a player reacts to. */
  readonly stimulusVisible: boolean;
  readonly responses: number;
  /**
   * The real browser transport this proof installs. The reaction test does not
   * consult it - it runs on simulation time - so reporting it here is the one
   * place `BrowserAudioTransport` is observed in an actual page rather than only
   * in unit tests.
   */
  readonly transportState: string;
  readonly transportUsingAudioClock: boolean;
}

export interface ReactionShellService {
  state(): ReactionShellState;
  begin(): void;
  /** Exercise the real transport's state machine, without depending on it. */
  driveTransport(step: 'start' | 'pause' | 'resume' | 'stop'): string;
  /** A semantic press. Deliberately the only way to respond. */
  respond(): ReactionRoundResult | null;
  next(): void;
  reset(): void;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: REACTION_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [REACTION_SHELL_CAPABILITY_ID],
  dependencies: [REACTION_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const reaction = context.capabilities.require<ReactionService>(REACTION_CAPABILITY_ID);

    const transport = context.capabilities.require<{
      state: string;
      start(): void;
      pause(): void;
      resume(): void;
      stop(): void;
      usingAudioClock?: boolean;
    }>('audio.transport');

    const stimulus = scene.add.rectangle(480, 270, 320, 200, 0x65d0a8).setVisible(false);
    let responses = 0;

    function state(): ReactionShellState {
      const snapshot = reaction.state();
      return {
        ...snapshot,
        stimulusVisible: snapshot.phase === 'stimulus',
        responses,
        transportState: transport.state,
        transportUsingAudioClock: transport.usingAudioClock === true,
      };
    }

    const shellService: ReactionShellService = {
      state,
      begin: () => reaction.begin(),
      driveTransport(step) {
        if (step === 'start') transport.start();
        else if (step === 'pause') transport.pause();
        else if (step === 'resume') transport.resume();
        else transport.stop();
        return transport.state;
      },
      respond() {
        const result = reaction.respond();
        if (result) responses += 1;
        return result;
      },
      next: () => reaction.next(),
      reset() {
        reaction.reset();
        responses = 0;
      },
    };

    const serviceHandle = context.capabilities.provide(REACTION_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(REACTION_SHELL_CAPABILITY_ID, state);

    let disposed = false;
    return {
      id: REACTION_SHELL_CAPABILITY_ID,

      update(): void {
        if (disposed) return;
        // A press is a response wherever the machine currently is - including
        // during the wait, which is exactly what makes a false start possible.
        if (context.input.justPressed('CONFIRM')) shellService.respond();

        const phase = reaction.phase();
        stimulus.setVisible(phase === 'stimulus');
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        serviceHandle.dispose();
        try {
          stimulus.destroy();
        } catch {
          /* tearing down */
        }
      },
    };
  },
};
