/**
 * A dialog/text presentation system for generated games.
 *
 * Provides a data-driven dialog engine that sequences text, character names,
 * choices, and effects. Pure logic - no rendering dependency. The game's
 * rendering layer reads dialog state and draws accordingly.
 */

export interface DialogLine {
  readonly speaker?: string;
  readonly text: string;
  readonly emotion?: string;
  readonly choices?: readonly DialogChoice[];
  readonly effects?: readonly DialogEffect[];
}

export interface DialogChoice {
  readonly text: string;
  readonly next?: number;
  readonly condition?: (context: DialogContext) => boolean;
  readonly effects?: readonly DialogEffect[];
}

export interface DialogEffect {
  readonly type: 'setFlag' | 'addItem' | 'removeItem' | 'addScore' | 'custom';
  readonly key: string;
  readonly value?: string | number;
}

export interface DialogContext {
  readonly flags: Readonly<Record<string, boolean>>;
  readonly items: ReadonlySet<string>;
  readonly score: number;
  readonly custom: Readonly<Record<string, unknown>>;
}

export interface DialogState {
  readonly isActive: boolean;
  readonly currentLine: DialogLine | null;
  readonly lineIndex: number;
  readonly totalLines: number;
  readonly availableChoices: readonly DialogChoice[];
}

export interface DialogEngine {
  /** Start a dialog sequence. */
  start(lines: readonly DialogLine[], context?: Partial<DialogContext>): void;

  /** Advance to the next line (or end if no choices). */
  advance(): void;

  /** Select a choice by index. */
  choose(index: number): void;

  /** Get the current dialog state. */
  readonly state: DialogState;

  /** Get the current context. */
  readonly context: DialogContext;

  /** End the dialog. */
  end(): void;

  /** Check if a dialog is active. */
  readonly isActive: boolean;

  /** Get all applied effects since dialog started. */
  readonly appliedEffects: readonly DialogEffect[];
}

/**
 * Creates a dialog engine.
 */
export function createDialogEngine(): DialogEngine {
  let lines: readonly DialogLine[] = [];
  let currentIndex = -1;
  let active = false;
  let context: DialogContext = { flags: {}, items: new Set(), score: 0, custom: {} };
  const appliedEffects: DialogEffect[] = [];

  function start(newLines: readonly DialogLine[], ctx?: Partial<DialogContext>): void {
    lines = newLines;
    currentIndex = 0;
    active = true;
    appliedEffects.length = 0;
    context = {
      flags: ctx?.flags ?? {},
      items: new Set(ctx?.items ?? []),
      score: ctx?.score ?? 0,
      custom: ctx?.custom ?? {},
    };

    // Apply effects from first line
    if (lines[0]?.effects) {
      for (const effect of lines[0].effects) applyEffect(effect);
    }
  }

  function applyEffect(effect: DialogEffect): void {
    appliedEffects.push(effect);
    switch (effect.type) {
      case 'setFlag':
        context = { ...context, flags: { ...context.flags, [effect.key]: true } };
        break;
      case 'addItem': {
        const items = new Set(context.items);
        items.add(effect.key);
        context = { ...context, items };
        break;
      }
      case 'removeItem': {
        const items = new Set(context.items);
        items.delete(effect.key);
        context = { ...context, items };
        break;
      }
      case 'addScore':
        context = { ...context, score: context.score + (typeof effect.value === 'number' ? effect.value : 1) };
        break;
      case 'custom':
        context = { ...context, custom: { ...context.custom, [effect.key]: effect.value } };
        break;
    }
  }

  function advance(): void {
    if (!active || currentIndex < 0) return;

    const current = lines[currentIndex];
    if (current?.choices && current.choices.length > 0) return; // Must choose

    currentIndex++;
    if (currentIndex >= lines.length) {
      active = false;
      currentIndex = -1;
      return;
    }

    // Apply effects from new line
    if (lines[currentIndex]?.effects) {
      for (const effect of (lines[currentIndex]!.effects ?? [])) applyEffect(effect);
    }
  }

  function choose(index: number): void {
    if (!active || currentIndex < 0) return;

    const current = lines[currentIndex];
    if (!current?.choices) return;

    const available = current.choices.filter(
      (choice) => !choice.condition || choice.condition(context),
    );
    const choice = available[index];
    if (!choice) return;

    // Apply choice effects
    if (choice.effects) {
      for (const effect of choice.effects) applyEffect(effect);
    }

    // Navigate to next line
    if (choice.next !== undefined) {
      currentIndex = choice.next;
    } else {
      currentIndex++;
    }

    if (currentIndex >= lines.length) {
      active = false;
      currentIndex = -1;
      return;
    }

    // Apply effects from new line
    if (lines[currentIndex]?.effects) {
      for (const effect of (lines[currentIndex]!.effects ?? [])) applyEffect(effect);
    }
  }

  function end(): void {
    active = false;
    currentIndex = -1;
  }

  return {
    start,
    advance,
    choose,
    end,
    get state(): DialogState {
      if (!active || currentIndex < 0 || currentIndex >= lines.length) {
        return { isActive: false, currentLine: null, lineIndex: -1, totalLines: lines.length, availableChoices: [] };
      }
      const line = lines[currentIndex]!;
      const choices = (line.choices ?? []).filter(
        (choice) => !choice.condition || choice.condition(context),
      );
      return {
        isActive: true,
        currentLine: line,
        lineIndex: currentIndex,
        totalLines: lines.length,
        availableChoices: choices,
      };
    },
    get context() {
      return context;
    },
    get isActive() {
      return active;
    },
    get appliedEffects() {
      return appliedEffects;
    },
  };
}
