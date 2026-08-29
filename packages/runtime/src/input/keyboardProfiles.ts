import type { KeyboardProfile } from '@sw2d/contracts';

/**
 * Default local-multiplayer keyboard profiles (post-ten program Phase 15).
 *
 * These live beside `DEFAULT_BINDINGS` for the same reason it does: they are
 * *data*, expressed in the existing `ActionBindings` structure, not a second
 * mapping format buried inside `PlayerInputHub`. A game or preset replaces or
 * extends them by id through `PlayerRosterConfig.keyboardProfiles`.
 *
 * Two rules shaped the key choices:
 *
 * 1. **The two profiles are disjoint.** No `KeyboardEvent.code` appears in both,
 *    so one player's key can never drive the other player's channel. That is the
 *    property the local-party proof asserts, and it is a property of this table
 *    rather than of any logic.
 * 2. **`PAUSE` is deliberately unbound here.** Pausing is a system action, not a
 *    per-player one; it stays on the game's single global `ActionInput` so two
 *    players cannot fight over the pause edge. The same reasoning the c_chase
 *    extraction applied to double-consumption applies to a per-player pause.
 *
 * Movement keys overlap the global `DEFAULT_BINDINGS` movement keys, which is
 * harmless: the meaning is identical (`KeyA` means "left" on both channels), and
 * the channels are separate hosts. Action keys do not overlap between profiles.
 */

/** Left-hand cluster: WASD to move, nearby letters to act. */
export const KEYBOARD_PROFILE_LEFT: KeyboardProfile = {
  id: 'keyboard-left',
  displayName: 'Keyboard (left: WASD)',
  bindings: {
    MOVE_LEFT: { keyboard: ['KeyA'] },
    MOVE_RIGHT: { keyboard: ['KeyD'] },
    MOVE_UP: { keyboard: ['KeyW'] },
    MOVE_DOWN: { keyboard: ['KeyS'] },
    JUMP: { keyboard: ['KeyV'] },
    PRIMARY_ACTION: { keyboard: ['KeyF'] },
    SECONDARY_ACTION: { keyboard: ['KeyG'] },
    DASH: { keyboard: ['ShiftLeft'] },
    INTERACT: { keyboard: ['KeyR'] },
    CONFIRM: { keyboard: ['KeyF'] },
    CANCEL: { keyboard: ['KeyG'] },
  },
};

/** Right-hand cluster: arrows to move, the punctuation/numpad island to act. */
export const KEYBOARD_PROFILE_RIGHT: KeyboardProfile = {
  id: 'keyboard-right',
  displayName: 'Keyboard (right: arrows)',
  bindings: {
    MOVE_LEFT: { keyboard: ['ArrowLeft'] },
    MOVE_RIGHT: { keyboard: ['ArrowRight'] },
    MOVE_UP: { keyboard: ['ArrowUp'] },
    MOVE_DOWN: { keyboard: ['ArrowDown'] },
    JUMP: { keyboard: ['Numpad0'] },
    PRIMARY_ACTION: { keyboard: ['Slash'] },
    SECONDARY_ACTION: { keyboard: ['Period'] },
    DASH: { keyboard: ['ShiftRight'] },
    INTERACT: { keyboard: ['Comma'] },
    CONFIRM: { keyboard: ['Slash'] },
    CANCEL: { keyboard: ['Period'] },
  },
};

export const DEFAULT_KEYBOARD_PROFILES: readonly KeyboardProfile[] = [
  KEYBOARD_PROFILE_LEFT,
  KEYBOARD_PROFILE_RIGHT,
];

/**
 * Merge authored profiles over the defaults **by id**, preserving default order
 * and appending genuinely new profiles. Replacing `keyboard-left` therefore
 * keeps it as the first offered device rather than moving it to the end.
 */
export function mergeKeyboardProfiles(
  overrides: readonly KeyboardProfile[] | undefined,
): readonly KeyboardProfile[] {
  if (!overrides || overrides.length === 0) return DEFAULT_KEYBOARD_PROFILES;
  const byId = new Map<string, KeyboardProfile>();
  for (const profile of DEFAULT_KEYBOARD_PROFILES) byId.set(profile.id, profile);
  const appended: KeyboardProfile[] = [];
  for (const profile of overrides) {
    if (byId.has(profile.id)) byId.set(profile.id, profile);
    else appended.push(profile);
  }
  return [...DEFAULT_KEYBOARD_PROFILES.map((p) => byId.get(p.id)!), ...appended];
}

/**
 * Every `KeyboardEvent.code` bound by more than one of the supplied profiles.
 * Empty for the defaults; a game that authors overlapping profiles gets a clear,
 * testable answer rather than mysterious cross-talk.
 */
export function keyboardProfileConflicts(profiles: readonly KeyboardProfile[]): readonly string[] {
  const owners = new Map<string, Set<string>>();
  for (const profile of profiles) {
    for (const binding of Object.values(profile.bindings)) {
      for (const code of binding?.keyboard ?? []) {
        let set = owners.get(code);
        if (!set) {
          set = new Set();
          owners.set(code, set);
        }
        set.add(profile.id);
      }
    }
  }
  return [...owners.entries()]
    .filter(([, set]) => set.size > 1)
    .map(([code]) => code)
    .sort();
}
