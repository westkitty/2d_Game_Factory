import type { DialogueService, DialogueView } from '@sw2d/contracts';

/**
 * Semantic-DOM dialogue presentation (post-ten program Phase 20).
 *
 * This is a runtime bridge because the requirements are genuinely browser
 * requirements: the full line has to reach the accessibility tree immediately,
 * choices have to be real focusable buttons, and reduced motion has to actually
 * shorten the reveal. A canvas text object meets none of those.
 *
 * ## The typewriter never hides text
 *
 * The whole line is written into the DOM the instant it is shown. The reveal is
 * a **clip**, not an append: the text node is complete and readable by a screen
 * reader from the first frame, and the animation only changes how much of it is
 * painted. The common implementation - appending one character at a time - makes
 * a screen reader read a growing fragment over and over, and makes the line
 * genuinely unavailable until the animation finishes.
 *
 * Reduced motion skips the reveal entirely rather than merely speeding it up.
 *
 * ## The reveal runs on simulation time
 *
 * `tick(deltaMs)` is driven from the game's own frame, not a `setInterval`. A
 * timer-driven reveal keeps painting while the game is paused and while the tab
 * is throttled, which is the same class of mistake Phase 17 rejected for rhythm
 * charts. It also makes the reveal deterministic, so a proof can assert on it.
 *
 * ## No focus trap
 *
 * Choice buttons are ordinary buttons in document order. Tab moves through them
 * and then out of the overlay; nothing intercepts focus at the boundary. The
 * game is still there behind the dialogue, and a player who tabs away must be
 * able to get back to it.
 */

export interface DialogueOverlayOptions {
  /** Resolve a portrait asset role to a URL. Return null for "no art". */
  readonly resolvePortrait?: (assetRole: string) => string | null;
  /** Disable the reveal animation. Wire this to the accessibility setting. */
  readonly reducedMotion?: () => boolean;
  /** Milliseconds per character when motion is allowed. */
  readonly revealMsPerCharacter?: number;
  /** Called after any interaction changes the view, so a game can react. */
  readonly onChanged?: (view: DialogueView) => void;
}

export interface DialogueOverlay {
  /** Repaint from the service's current view. */
  refresh(): void;
  /** Advance the reveal by a frame of simulation time. Never a wall clock. */
  tick(deltaMs: number): void;
  /** Complete an in-progress reveal, or advance. What a click/Space should do. */
  advance(): void;
  readonly isVisible: boolean;
  /** True while a reveal animation is still painting. */
  readonly isRevealing: boolean;
  readonly root: HTMLElement;
  dispose(): void;
}

const DEFAULT_REVEAL_MS_PER_CHARACTER = 22;

export function createDialogueOverlay(
  container: HTMLElement,
  dialogue: DialogueService,
  options: DialogueOverlayOptions = {},
): DialogueOverlay {
  const doc = container.ownerDocument;
  const revealRate = options.revealMsPerCharacter ?? DEFAULT_REVEAL_MS_PER_CHARACTER;

  const root = doc.createElement('div');
  root.setAttribute('data-sw2d-dialogue', 'root');
  // `region`, not `dialog`: a modal dialog role implies a focus trap, and this
  // overlay deliberately does not trap focus.
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Dialogue');
  root.hidden = true;
  root.style.cssText =
    'position:absolute;left:0;right:0;bottom:0;z-index:15;display:flex;gap:12px;align-items:flex-end;' +
    'padding:16px;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;color:#eef2f8;' +
    'background:linear-gradient(transparent,rgba(6,8,14,0.92) 32%)';

  const portrait = doc.createElement('img');
  portrait.setAttribute('data-sw2d-dialogue', 'portrait');
  // Decorative: the speaker's name is already text, so announcing the portrait
  // would just repeat it.
  portrait.alt = '';
  portrait.hidden = true;
  portrait.style.cssText = 'width:96px;height:96px;object-fit:contain;image-rendering:pixelated;flex:0 0 auto';

  const panel = doc.createElement('div');
  panel.style.cssText =
    'flex:1 1 auto;min-width:0;background:rgba(18,22,31,0.94);border:1px solid #384054;border-radius:8px;padding:12px 14px';

  const speaker = doc.createElement('p');
  speaker.setAttribute('data-sw2d-dialogue', 'speaker');
  speaker.style.cssText = 'margin:0 0 4px;font-weight:600;color:#9fd0ff';

  const text = doc.createElement('p');
  text.setAttribute('data-sw2d-dialogue', 'text');
  text.style.cssText = 'margin:0;white-space:pre-wrap';

  // `aria-live` is deliberately absent: the text is already in the tree from the
  // first frame, and a live region would announce it again on every repaint.

  const choices = doc.createElement('ul');
  choices.setAttribute('data-sw2d-dialogue', 'choices');
  choices.style.cssText = 'list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px';

  panel.append(speaker, text, choices);
  root.append(portrait, panel);
  container.append(root);

  let disposed = false;
  /**
   * Which line the current reveal belongs to. Keyed on the id rather than the
   * text: two lines can legitimately share wording, and re-entering a node has
   * to replay its reveal rather than silently skip it.
   */
  let revealedLineId: string | null = null;
  let revealElapsedMs = 0;
  let revealing = false;
  let revealedCharacters = 0;
  let fullText = '';

  function stopReveal(): void {
    revealing = false;
  }

  function paintReveal(): void {
    // The text node itself is never truncated. Only the painted portion moves,
    // via a background clip, so the accessibility tree always holds the whole line.
    const ratio = fullText.length === 0 ? 1 : revealedCharacters / fullText.length;
    text.style.setProperty('--sw2d-reveal', String(ratio));
    if (ratio >= 1) {
      text.style.removeProperty('clip-path');
      return;
    }
    text.style.setProperty('clip-path', `inset(0 ${Math.round((1 - ratio) * 100)}% 0 0)`);
  }

  function beginReveal(next: string): void {
    fullText = next;
    // Set the complete text first, always. Everything after this is painting.
    text.textContent = next;
    revealElapsedMs = 0;
    if (options.reducedMotion?.() === true || revealRate <= 0 || next.length === 0) {
      revealing = false;
      revealedCharacters = next.length;
      paintReveal();
      return;
    }
    revealing = true;
    revealedCharacters = 0;
    paintReveal();
  }

  function tick(deltaMs: number): void {
    if (disposed || !revealing || !(deltaMs > 0)) return;
    revealElapsedMs += deltaMs;
    revealedCharacters = Math.min(fullText.length, Math.floor(revealElapsedMs / revealRate));
    paintReveal();
    if (revealedCharacters >= fullText.length) revealing = false;
  }

  function completeReveal(): void {
    revealing = false;
    revealedCharacters = fullText.length;
    paintReveal();
  }

  function renderChoices(view: DialogueView): void {
    choices.replaceChildren();
    if (view.status !== 'choices') return;
    for (const option of view.choices) {
      // Unavailable choices are omitted rather than shown disabled: a visible
      // locked option tells the player about content they cannot reach, which
      // is an authoring decision and not one this overlay gets to make.
      if (!option.available) continue;
      const item = doc.createElement('li');
      const button = doc.createElement('button');
      button.type = 'button';
      button.setAttribute('data-sw2d-choice', option.id);
      button.textContent = option.text;
      button.style.cssText =
        'width:100%;text-align:left;padding:7px 10px;border-radius:6px;border:1px solid #45506a;' +
        'background:#1b2130;color:inherit;font:inherit;cursor:pointer';
      button.addEventListener('click', () => {
        dialogue.choose(option.id);
        refresh();
        options.onChanged?.(dialogue.view());
      });
      item.append(button);
      choices.append(item);
    }
  }

  function refresh(): void {
    if (disposed) return;
    const view = dialogue.view();
    const visible = view.status === 'lines' || view.status === 'choices';
    root.hidden = !visible;
    if (!visible) {
      stopReveal();
      choices.replaceChildren();
      text.textContent = '';
      return;
    }

    speaker.textContent = view.speakerName ?? '';
    speaker.hidden = view.speakerName === null;

    const url = view.portraitRole ? (options.resolvePortrait?.(view.portraitRole) ?? null) : null;
    if (url) {
      portrait.src = url;
      portrait.hidden = false;
    } else {
      portrait.hidden = true;
      portrait.removeAttribute('src');
    }

    if (view.status === 'lines') {
      if (view.lineId !== revealedLineId) {
        revealedLineId = view.lineId;
        beginReveal(view.text);
      }
    } else {
      stopReveal();
      revealedLineId = null;
      text.textContent = '';
      fullText = '';
    }
    renderChoices(view);
  }

  function advance(): void {
    if (disposed) return;
    const view = dialogue.view();
    if (view.status !== 'lines') return;
    // First press completes the reveal, second advances. A player who reads
    // faster than the animation should never lose a line to an eager keypress.
    if (revealing) {
      completeReveal();
      return;
    }
    dialogue.advance();
    refresh();
    options.onChanged?.(dialogue.view());
  }

  refresh();

  return {
    refresh,
    tick,
    advance,
    get isVisible(): boolean {
      return !root.hidden;
    },
    get isRevealing(): boolean {
      return revealing;
    },
    root,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopReveal();
      root.remove();
    },
  };
}
