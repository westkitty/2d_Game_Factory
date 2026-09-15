/**
 * Tests for the input recording and replay system.
 */

import { describe, it, expect } from 'vitest';
import { createInputRecorder, createInputReplayer } from '../src/game-support/inputRecorder.ts';

describe('inputRecorder', () => {
  it('starts not recording', () => {
    const recorder = createInputRecorder();
    expect(recorder.isRecording).toBe(false);
    expect(recorder.frameCount).toBe(0);
  });

  it('records frames when started', () => {
    const recorder = createInputRecorder();
    recorder.start('test-game', 42);
    expect(recorder.isRecording).toBe(true);

    recorder.recordFrame(0, 0, { MOVE_LEFT: false, JUMP: false });
    recorder.recordFrame(1, 16, { MOVE_LEFT: true, JUMP: false });
    recorder.recordFrame(2, 33, { MOVE_LEFT: true, JUMP: true });

    expect(recorder.frameCount).toBe(3);
  });

  it('ignores frames when not recording', () => {
    const recorder = createInputRecorder();
    recorder.recordFrame(0, 0, { MOVE_LEFT: true });
    expect(recorder.frameCount).toBe(0);
  });

  it('produces a valid recording on stop', () => {
    const recorder = createInputRecorder();
    recorder.start('test-game', 42);
    recorder.recordFrame(0, 0, { JUMP: false });
    recorder.recordFrame(10, 166, { JUMP: true });

    const recording = recorder.stop();
    expect(recording.version).toBe(1);
    expect(recording.gameId).toBe('test-game');
    expect(recording.seed).toBe(42);
    expect(recording.frameCount).toBe(2);
    expect(recording.durationMs).toBe(166);
    expect(recording.frames).toHaveLength(2);
    expect(recorder.isRecording).toBe(false);
  });
});

describe('inputReplayer', () => {
  it('starts not playing', () => {
    const replayer = createInputReplayer();
    expect(replayer.isPlaying).toBe(false);
    expect(replayer.totalFrames).toBe(0);
  });

  it('loads a recording', () => {
    const replayer = createInputReplayer();
    replayer.load({
      version: 1,
      gameId: 'test',
      seed: 1,
      durationMs: 100,
      frameCount: 2,
      frames: [
        { frame: 0, timeMs: 0, actions: { JUMP: false } },
        { frame: 1, timeMs: 16, actions: { JUMP: true } },
      ],
    });
    expect(replayer.isPlaying).toBe(true);
    expect(replayer.totalFrames).toBe(2);
  });

  it('advances through frames', () => {
    const replayer = createInputReplayer();
    replayer.load({
      version: 1,
      gameId: 'test',
      seed: 1,
      durationMs: 33,
      frameCount: 3,
      frames: [
        { frame: 0, timeMs: 0, actions: { A: false } },
        { frame: 1, timeMs: 16, actions: { A: true } },
        { frame: 2, timeMs: 33, actions: { A: false } },
      ],
    });

    expect(replayer.advance()).toEqual({ A: false });
    expect(replayer.currentFrame).toBe(1);
    expect(replayer.advance()).toEqual({ A: true });
    expect(replayer.advance()).toEqual({ A: false });
    expect(replayer.advance()).toBe(null);
    expect(replayer.isPlaying).toBe(false);
  });

  it('gets frame by number', () => {
    const replayer = createInputReplayer();
    replayer.load({
      version: 1,
      gameId: 'test',
      seed: 1,
      durationMs: 33,
      frameCount: 2,
      frames: [
        { frame: 0, timeMs: 0, actions: { X: true } },
        { frame: 5, timeMs: 83, actions: { X: false } },
      ],
    });

    expect(replayer.getFrame(0)).toEqual({ X: true });
    expect(replayer.getFrame(3)).toEqual({ X: true }); // Before frame 5
    expect(replayer.getFrame(5)).toEqual({ X: false });
  });

  it('reset returns to beginning', () => {
    const replayer = createInputReplayer();
    replayer.load({
      version: 1,
      gameId: 'test',
      seed: 1,
      durationMs: 16,
      frameCount: 2,
      frames: [
        { frame: 0, timeMs: 0, actions: {} },
        { frame: 1, timeMs: 16, actions: {} },
      ],
    });

    replayer.advance();
    replayer.advance();
    expect(replayer.isPlaying).toBe(false);

    replayer.reset();
    expect(replayer.currentFrame).toBe(0);
    expect(replayer.isPlaying).toBe(true);
  });
});
