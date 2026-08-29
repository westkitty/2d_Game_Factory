import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYBOARD_PROFILES } from '@sw2d/runtime/input-profiles';
import { DEFAULT_KEYBOARD_PROFILE_IDS } from '../server/playersLab.ts';

/**
 * The Workbench server must not load the renderer package, so `playersLab.ts`
 * restates the default keyboard profile ids rather than importing them. That is
 * a duplication with a real drift risk, which is exactly why it is asserted here
 * instead of trusted.
 */
describe('players lab keyboard profile ids', () => {
  it('matches the runtime default profiles exactly, in order', () => {
    expect(DEFAULT_KEYBOARD_PROFILE_IDS).toEqual(DEFAULT_KEYBOARD_PROFILES.map((profile) => profile.id));
  });
});
