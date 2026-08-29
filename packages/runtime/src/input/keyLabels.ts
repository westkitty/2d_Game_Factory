/**
 * Player-facing labels for `KeyboardEvent.code` values, and the start-prompt
 * derivation used by the title state.
 *
 * The runtime consumes the semantic action `CONFIRM`; a player should never be
 * told to "press CONFIRM". The title hint is derived from the game's *effective*
 * `CONFIRM` keyboard bindings so it stays honest even when a game rebinds them.
 */

/** Direct `code -> label` overrides. Enter and Numpad Enter both read as "Enter". */
const KEY_LABELS: Readonly<Record<string, string>> = {
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Space: 'Space',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Tab: 'Tab',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
};

/** A short, human label for one `KeyboardEvent.code` (e.g. `KeyX` -> `X`). */
export function humanizeKeyCode(code: string): string {
  const direct = KEY_LABELS[code];
  if (direct) return direct;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `Numpad ${code.slice(6)}`;
  return code;
}

/**
 * Describes a set of key codes as one readable phrase, deduped and capped.
 * `['Enter', 'Space', 'NumpadEnter']` -> `Enter or Space`.
 */
export function describeKeys(codes: readonly string[], max = 2): string {
  const labels: string[] = [];
  for (const code of codes) {
    const label = humanizeKeyCode(code);
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.length >= max) break;
  }
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}

/**
 * The player-facing start instruction.
 *
 * Content copy wins if the game set one (`content.ui.startPrompt`); otherwise
 * the effective `CONFIRM` keyboard bindings are described, so a rebind is
 * reflected truthfully. `fallback` is used only when there are no bindings to
 * describe at all.
 */
export function startPromptFor(
  confirmKeys: readonly string[] | undefined,
  contentStartPrompt: string | undefined,
  fallback: string,
): string {
  if (contentStartPrompt !== undefined && contentStartPrompt.trim().length > 0) {
    return contentStartPrompt;
  }
  const described = describeKeys(confirmKeys ?? [], 2);
  return described ? `PRESS ${described.toUpperCase()} TO START` : fallback;
}
