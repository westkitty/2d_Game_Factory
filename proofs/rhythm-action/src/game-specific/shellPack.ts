import {
  RHYTHM_CAPABILITY_ID,
  type ActionId,
  type InstalledSystemPack,
  type Judgement,
  type RhythmService,
  type RhythmState,
} from '@sw2d/contracts';
import { type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 17 proof - rhythm-action.
 *
 * Every timing rule comes from `arcade.rhythm`: beat conversion, the judgement
 * windows, which note a press consumes, the once-only guarantee, combo, score,
 * accuracy, miss expiry and calibration. This shell contributes presentation and
 * the wire from semantic input to `press()`.
 *
 * It holds no chart time of its own. The transport is the clock, and the shell
 * never reads one - which is the whole point of the phase.
 */

export const RHYTHM_SHELL_CAPABILITY_ID = 'game.rhythm-shell';

/** The actions this shell forwards to the judge, and the lane it names for each. */
const JUDGED_ACTIONS: readonly { readonly action: ActionId; readonly lane?: string }[] = [
  { action: 'CONFIRM' },
  { action: 'PRIMARY_ACTION', lane: 'right' },
];

export interface RhythmShellState extends RhythmState {
  readonly transportState: string;
  readonly calibrationMs: number;
  readonly lastJudgement: Judgement | null;
  readonly lastDeltaMs: number | null;
  readonly lastNoteId: string | null;
  /** Presses that landed on no note at all - the "swing at nothing" count. */
  readonly emptyPresses: number;
  /** Notes judged by a PRESS. Expired notes never pass through here. */
  readonly judgedNoteIds: readonly string[];
  /**
   * Every note the service has judged, however it was judged - presses and
   * window expiries alike. This is the service's own record, which is the only
   * place an expired miss is visible.
   */
  readonly allJudgedIds: readonly string[];
}

export interface RhythmShellService {
  state(): RhythmShellState;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  /** Drive a judged press directly, so the proof can hit an exact chart position. */
  press(action: ActionId, lane?: string): { judged: boolean; judgement: Judgement | null; deltaMs: number | null };
  setCalibration(ms: number): void;
  /** Advance the scripted transport by hand - the QA clock, not a game rule. */
  advance(deltaMs: number): void;
  seek(timeMs: number): void;
  reset(): void;
}

/** The scripted transport this proof installs. Kept minimal and local. */
interface ScriptedTransport {
  advance(deltaMs: number): void;
  seek(timeMs: number): void;
  readonly state: string;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: RHYTHM_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [RHYTHM_SHELL_CAPABILITY_ID],
  dependencies: [RHYTHM_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const rhythm = context.capabilities.require<RhythmService>(RHYTHM_CAPABILITY_ID);
    const transport = context.capabilities.require<ScriptedTransport>('audio.transport');

    let lastJudgement: Judgement | null = null;
    let lastDeltaMs: number | null = null;
    let lastNoteId: string | null = null;
    let emptyPresses = 0;
    const judgedNoteIds: string[] = [];

    // A minimal visual: one marker per upcoming note, redrawn each frame.
    const markers: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 8; i++) {
      markers.push(scene.add.rectangle(480, 300, 20, 20, 0x65d0a8).setVisible(false));
    }

    function record(outcome: ReturnType<RhythmService['press']>): {
      judged: boolean;
      judgement: Judgement | null;
      deltaMs: number | null;
    } {
      if (outcome.kind === 'none') {
        emptyPresses += 1;
        return { judged: false, judgement: null, deltaMs: null };
      }
      lastJudgement = outcome.result.judgement;
      lastDeltaMs = outcome.result.deltaMs;
      lastNoteId = outcome.result.noteId;
      judgedNoteIds.push(outcome.result.noteId);
      return { judged: true, judgement: outcome.result.judgement, deltaMs: outcome.result.deltaMs };
    }

    function state(): RhythmShellState {
      return {
        ...rhythm.state(),
        transportState: transport.state,
        calibrationMs: rhythm.calibrationMs(),
        lastJudgement,
        lastDeltaMs,
        lastNoteId,
        emptyPresses,
        judgedNoteIds: [...judgedNoteIds],
        allJudgedIds: rhythm.judged().map((entry) => entry.noteId),
      };
    }

    const shellService: RhythmShellService = {
      state,
      start() {
        rhythm.start();
        judgedNoteIds.length = 0;
        lastJudgement = null;
        lastDeltaMs = null;
        lastNoteId = null;
        emptyPresses = 0;
      },
      pause: () => rhythm.pause(),
      resume: () => rhythm.resume(),
      stop: () => rhythm.stop(),
      press: (action, lane) => record(rhythm.press(action, lane)),
      setCalibration: (ms) => rhythm.setCalibrationMs(ms),
      advance: (deltaMs) => transport.advance(deltaMs),
      seek: (timeMs) => transport.seek(timeMs),
      reset() {
        rhythm.reset();
        judgedNoteIds.length = 0;
        lastJudgement = null;
        lastDeltaMs = null;
        lastNoteId = null;
        emptyPresses = 0;
      },
    };

    const serviceHandle = context.capabilities.provide(RHYTHM_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(RHYTHM_SHELL_CAPABILITY_ID, state);

    let disposed = false;
    return {
      id: RHYTHM_SHELL_CAPABILITY_ID,

      update(): void {
        if (disposed) return;
        // Forward semantic presses to the judge. The shell decides *which*
        // actions are musical; the judge decides what they hit and when.
        for (const entry of JUDGED_ACTIONS) {
          if (context.input.justPressed(entry.action)) record(rhythm.press(entry.action, entry.lane));
        }

        const snapshot = rhythm.state();
        markers.forEach((marker, index) => {
          const note = snapshot.upcoming[index];
          if (!note) {
            marker.setVisible(false);
            return;
          }
          // Position purely by how far ahead the note is - the transport drives
          // the visual exactly as it drives the judgement.
          const lead = note.timeMs - snapshot.timeMs;
          marker.setVisible(true).setPosition(120 + (lead / 2000) * 700, note.lane === 'right' ? 340 : 260);
        });
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        serviceHandle.dispose();
        try {
          for (const marker of markers) marker.destroy();
        } catch {
          /* tearing down */
        }
        markers.length = 0;
      },
    };
  },
};
