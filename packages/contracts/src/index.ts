/**
 * @sw2d/contracts - engine-agnostic contracts for the SW2D game factory.
 *
 * This package has no runtime dependencies and knows nothing about Phaser. The
 * CLI, schema tooling and QA harness can consume it without pulling in a
 * renderer or a browser environment.
 */
export * from './accessibility.ts';
export * from './actions.ts';
export * from './audio.ts';
export * from './content.ts';
export * from './context.ts';
export * from './controllers.ts';
export * from './debug.ts';
export * from './disposable.ts';
export * from './events.ts';
export * from './game.ts';
export * from './input.ts';
export * from './persistence.ts';
export * from './presets.ts';
export * from './scenes.ts';
export * from './systems.ts';
export * from './ui.ts';
