/**
 * Input recording and replay system for generated games.
 *
 * Records player input with timestamps and can replay it deterministically.
 * Useful for:
 * - Ghost replays (race against your best time)
 * - Bug reproduction (share a replay file)
 * - Demo/attract mode playback
 * - QA automation
 *
 * Pure data structure - no DOM or engine dependencies.
 */

export interface InputFrame {
  readonly frame: number;
  readonly timeMs: number;
  readonly actions: Readonly<Record<string, boolean>>;
}

export interface InputRecording {
  readonly version: 1;
  readonly gameId: string;
  readonly seed: number;
  readonly durationMs: number;
  readonly frameCount: number;
  readonly frames: readonly InputFrame[];
}

export interface InputRecorder {
  /** Start recording. */
  start(gameId: string, seed: number): void;

  /** Record a frame of input. */
  recordFrame(frame: number, timeMs: number, actions: Readonly<Record<string, boolean>>): void;

  /** Stop recording and return the recording. */
  stop(): InputRecording;

  /** Check if currently recording. */
  readonly isRecording: boolean;

  /** Get the current frame count. */
  readonly frameCount: number;
}

export interface InputReplayer {
  /** Load a recording for playback. */
  load(recording: InputRecording): void;

  /** Get the input state for a given frame. */
  getFrame(frame: number): Readonly<Record<string, boolean>> | null;

  /** Check if currently playing. */
  readonly isPlaying: boolean;

  /** Get the total frame count. */
  readonly totalFrames: number;

  /** Get the current playback position. */
  readonly currentFrame: number;

  /** Advance to the next frame. */
  advance(): Readonly<Record<string, boolean>> | null;

  /** Reset playback to the beginning. */
  reset(): void;
}

/**
 * Creates an input recorder.
 */
export function createInputRecorder(): InputRecorder {
  let recording = false;
  let gameId = '';
  let seed = 0;
  const frames: InputFrame[] = [];

  function start(game: string, s: number): void {
    recording = true;
    gameId = game;
    seed = s;
    frames.length = 0;
  }

  function recordFrame(frame: number, timeMs: number, actions: Readonly<Record<string, boolean>>): void {
    if (!recording) return;
    frames.push({ frame, timeMs, actions: { ...actions } });
  }

  function stop(): InputRecording {
    recording = false;
    const lastFrame = frames[frames.length - 1];
    return {
      version: 1,
      gameId,
      seed,
      durationMs: lastFrame?.timeMs ?? 0,
      frameCount: frames.length,
      frames: [...frames],
    };
  }

  return {
    start,
    recordFrame,
    stop,
    get isRecording() {
      return recording;
    },
    get frameCount() {
      return frames.length;
    },
  };
}

/**
 * Creates an input replayer.
 */
export function createInputReplayer(): InputReplayer {
  let recording: InputRecording | null = null;
  let currentIndex = 0;

  function load(rec: InputRecording): void {
    recording = rec;
    currentIndex = 0;
  }

  function getFrame(frame: number): Readonly<Record<string, boolean>> | null {
    if (!recording) return null;
    // Binary search for the frame
    let lo = 0;
    let hi = recording.frames.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const midFrame = recording.frames[mid]!.frame;
      if (midFrame === frame) return recording.frames[mid]!.actions;
      if (midFrame < frame) lo = mid + 1;
      else hi = mid - 1;
    }
    // Return the most recent frame before the requested one
    if (lo > 0) return recording.frames[lo - 1]!.actions;
    return {};
  }

  function advance(): Readonly<Record<string, boolean>> | null {
    if (!recording || currentIndex >= recording.frames.length) return null;
    const frame = recording.frames[currentIndex]!;
    currentIndex++;
    return frame.actions;
  }

  function reset(): void {
    currentIndex = 0;
  }

  return {
    load,
    getFrame,
    get isPlaying() {
      return recording !== null && currentIndex < (recording?.frameCount ?? 0);
    },
    get totalFrames() {
      return recording?.frameCount ?? 0;
    },
    get currentFrame() {
      return currentIndex;
    },
    advance,
    reset,
  };
}
