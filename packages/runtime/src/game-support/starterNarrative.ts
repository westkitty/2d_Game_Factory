import type { CodexService } from '@sw2d/contracts';
import { CODEX_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind generated shells to `sw2d.narrative` (Category-C Wave 14).
 *
 * Inert unless the game installed the pack *and* the generated packConfig
 * names a fiction or case starter. The pack stays a node/flag/choice/seen
 * store — this file is presentation, not a parser or evidence-board.
 * Fiction mode renders the catalog parser input; case mode renders the codex
 * evidence board while those packs remain the state owners.
 */

const NARRATIVE_CAPABILITY_ID = 'narrative.state';

export type NarrativeStarterMode = 'fiction' | 'case';

export interface StarterNarrativeSnapshot {
  readonly active: boolean;
  readonly mode: NarrativeStarterMode | null;
  readonly nodeId: string | null;
  readonly text: string;
  readonly selectedIndex: number;
  readonly selectedVerb: string | null;
  readonly flags: readonly string[];
  readonly seen: readonly string[];
  readonly choices: readonly string[];
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly ending: string | null;
  readonly outcome: 'playing' | 'complete';
  readonly transcript: readonly string[];
  readonly lastCommand: string | null;
  readonly inputVisible: boolean;
  readonly boardEntries: readonly { readonly id: string; readonly title: string; readonly unlocked: boolean }[];
  readonly links: readonly (readonly [string, string])[];
  readonly conclusion: string | null;
  readonly invalidAttempts: number;
}

export interface StarterNarrativeBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  setPlayer(x: number, y: number): void;
  select(delta: number): void;
  act(): void;
  snapshot(): StarterNarrativeSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterNarrativeBinding = {
  active: false,
  startX: () => 0,
  startY: () => 0,
  setPlayer: () => undefined,
  select: () => undefined,
  act: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    nodeId: null,
    text: '',
    selectedIndex: 0,
    selectedVerb: null,
    flags: [],
    seen: [],
    choices: [],
    nearId: null,
    lastResult: null,
    ending: null,
    outcome: 'playing',
    transcript: [],
    lastCommand: null,
    inputVisible: false,
    boardEntries: [],
    links: [],
    conclusion: null,
    invalidAttempts: 0,
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface NarrativeStore {
  currentNode(): string | null;
  goTo(nodeId: string): void;
  setFlag(flag: string, value: boolean): void;
  hasFlag(flag: string): boolean;
  choose(choiceId: string, resultNodeId: string): void;
  markSeen(entryId: string): void;
  hasSeen(entryId: string): boolean;
  seenEntries(): readonly string[];
  chosenChoices(): readonly string[];
  parserActive(): boolean;
  submit(command: string): { readonly ok: boolean; readonly reason: string; readonly text: string };
  transcript(): readonly string[];
  lastCommand(): string | null;
  lastText(): string;
  outcome(): 'playing' | 'complete';
  ending(): string | null;
  reset(): void;
}

const FICTION_VERBS = ['LOOK', 'TAKE', 'LEAVE'] as const;
const FICTION_START = 'start';
const FLAG_SAW_NOTE = 'saw-note';
const FLAG_HAS_KEY = 'has-key';
const SEEN_NOTE = 'note';
const START_X = 120;
const START_Y = 270;
const CLUES = [
  { id: 'print', label: 'PRINT', x: 280, y: 270, radius: 64 },
  { id: 'photo', label: 'PHOTO', x: 620, y: 270, radius: 64 },
] as const;
const DESK = { id: 'desk', label: 'DESK', x: 850, y: 270, radius: 72 };
const MARK_COLOR = 0xf0c274;
const SEEN_COLOR = 0x65d0a8;
const DESK_COLOR = 0xb98af0;

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function fictionText(nodeId: string | null, ending: string | null): string {
  if (ending === 'escaped') return 'You take the key and step outside.';
  if (ending === 'walked-away') return 'You leave the cabin as you found it.';
  if (nodeId === 'looked') return 'A crumpled note: take the brass key.';
  return 'A locked cabin. Dust, a desk, a door.';
}

export function bindStarterNarrative(
  context: SceneContext,
  options?: { readonly mode?: NarrativeStarterMode | null; readonly hud?: boolean },
): StarterNarrativeBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'fiction' && mode !== 'case') return INERT;
  if (!context.capabilities.has(NARRATIVE_CAPABILITY_ID)) return INERT;
  const narrative = context.capabilities.require<NarrativeStore>(NARRATIVE_CAPABILITY_ID);
  const codex = context.capabilities.get<CodexService>(CODEX_CAPABILITY_ID);

  narrative.reset();
  if (mode !== 'fiction' || !narrative.parserActive()) narrative.goTo(mode === 'fiction' ? FICTION_START : 'scene');

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const body = hud
    ? scene.add
        .text(width * 0.5, mode === 'fiction' ? height * 0.42 : 54, '', mode === 'fiction' ? headingStyle(18) : mutedStyle(14))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(50)
        .setWordWrapWidth(width - 80)
    : null;
  const status = hud ? scene.add.text(width * 0.5, height - 56, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const commandInput = hud && mode === 'fiction' && narrative.parserActive()
    ? (() => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Type a command, e.g. LOOK AT NOTE';
        input.setAttribute('aria-label', 'Story command');
        input.dataset.sw2dNarrativeCommand = 'true';
        Object.assign(input.style, {
          position: 'fixed', left: '50%', bottom: '64px', transform: 'translateX(-50%)', width: 'min(720px, 75vw)',
          padding: '12px 16px', zIndex: '9999', color: '#ffffff', background: '#111827', border: '2px solid #65d0a8',
          font: '16px monospace', borderRadius: '6px',
        });
        (scene.game.canvas.parentElement ?? document.body).appendChild(input);
        return input;
      })()
    : null;

  const markers: { setFillStyle(color: number, alpha?: number): unknown; destroy(): void }[] = [];
  const labels: { setText(value: string): unknown; destroy(): void }[] = [];
  const evidenceLink = hud && mode === 'case'
    ? scene.add.rectangle((CLUES[0].x + CLUES[1].x) * 0.5, CLUES[0].y, CLUES[1].x - CLUES[0].x, 4, SEEN_COLOR, 0).setDepth(15)
    : null;
  const conclusionText = hud && mode === 'case'
    ? scene.add.text(width * 0.5, 116, '', accentStyle(15)).setOrigin(0.5).setDepth(51).setWordWrapWidth(width - 120)
    : null;
  if (hud && mode === 'case') {
    for (const clue of CLUES) {
      markers.push(scene.add.rectangle(clue.x, clue.y, 36, 36, MARK_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20));
      labels.push(scene.add.text(clue.x, clue.y - 32, clue.label, mutedStyle(12)).setOrigin(0.5).setDepth(21));
    }
    markers.push(scene.add.rectangle(DESK.x, DESK.y, 44, 52, DESK_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20));
    labels.push(scene.add.text(DESK.x, DESK.y - 40, DESK.label, mutedStyle(12)).setOrigin(0.5).setDepth(21));
  }

  let selectedIndex = 0;
  let playerX = START_X;
  let playerY = START_Y;
  let lastResult: string | null = null;
  let ending: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;

  function nearId(): string | null {
    if (mode !== 'case') return null;
    for (const clue of CLUES) {
      if (dist(playerX, playerY, clue.x, clue.y) <= clue.radius) return clue.id;
    }
    if (dist(playerX, playerY, DESK.x, DESK.y) <= DESK.radius) return DESK.id;
    return null;
  }

  function snapshot(): StarterNarrativeSnapshot {
    const verb = mode === 'fiction' ? FICTION_VERBS[selectedIndex] ?? null : null;
    return {
      active: true,
      mode,
      nodeId: narrative.currentNode(),
      text: mode === 'fiction' ? (narrative.parserActive() ? narrative.lastText() : fictionText(narrative.currentNode(), ending)) : `${narrative.seenEntries().length}/${CLUES.length} clues`,
      selectedIndex,
      selectedVerb: verb,
      flags: [
        ...(narrative.hasFlag(FLAG_SAW_NOTE) ? [FLAG_SAW_NOTE] : []),
        ...(narrative.hasFlag(FLAG_HAS_KEY) ? [FLAG_HAS_KEY] : []),
        ...(narrative.hasFlag('case-closed') ? ['case-closed'] : []),
      ],
      seen: narrative.seenEntries(),
      choices: narrative.chosenChoices(),
      nearId: nearId(),
      lastResult,
      ending: narrative.parserActive() ? narrative.ending() : ending,
      outcome: narrative.parserActive() ? narrative.outcome() : outcome,
      transcript: narrative.transcript(),
      lastCommand: narrative.lastCommand(),
      inputVisible: Boolean(commandInput?.isConnected),
      boardEntries: codex?.entries().map((entry) => ({ id: entry.id, title: entry.title, unlocked: codex.unlocked().includes(entry.id) })) ?? [],
      links: codex?.links() ?? [],
      conclusion: codex?.conclusion() ?? null,
      invalidAttempts: codex?.invalidAttempts() ?? 0,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (mode === 'case') {
      for (let i = 0; i < CLUES.length; i++) {
        const clue = CLUES[i]!;
        const seen = narrative.hasSeen(clue.id);
        markers[i]?.setFillStyle(seen ? SEEN_COLOR : MARK_COLOR, 0.95);
        labels[i]?.setText(seen ? `${clue.label} SEEN` : clue.label);
      }
      const ready = CLUES.every((clue) => narrative.hasSeen(clue.id));
      markers[CLUES.length]?.setFillStyle(snap.outcome === 'complete' ? SEEN_COLOR : ready ? MARK_COLOR : DESK_COLOR, 0.95);
      labels[CLUES.length]?.setText(snap.outcome === 'complete' ? 'CLOSED' : ready ? 'DEDUCE' : DESK.label);
      evidenceLink?.setFillStyle(SEEN_COLOR, snap.links.length > 0 ? 0.9 : 0);
      conclusionText?.setText(snap.conclusion ?? (snap.invalidAttempts > 0 ? 'That theory does not fit the evidence.' : ''));
    }
    if (!title || !body || !status || !hint) return;
    if (mode === 'fiction') {
      title.setText(snap.outcome === 'complete' ? (snap.ending ?? 'COMPLETE').toUpperCase() : narrative.parserActive() ? 'INTERACTIVE FICTION' : 'FICTION');
      const verbs = FICTION_VERBS.map((verb, index) => (index === selectedIndex ? `< ${verb} >` : verb)).join('   ');
      body.setText(narrative.parserActive() ? [...snap.transcript.slice(-4), snap.text].join('\n\n') : `${snap.text}\n\n${snap.outcome === 'complete' ? '' : verbs}`);
      status.setText(snap.lastResult ? `last: ${snap.lastResult}` : '');
      hint.setText(narrative.parserActive() ? 'TYPE A COMMAND   ENTER SUBMITS' : 'ARROWS PICK A VERB   ENTER ACTS');
    } else {
      title.setText(snap.outcome === 'complete' ? 'CASE CLOSED' : 'CASE');
      body.setText(`clues ${snap.seen.length}/${CLUES.length}${snap.nearId ? `  ·  near ${snap.nearId}` : ''}`);
      status.setText(snap.lastResult ? `last: ${snap.lastResult}` : '');
      hint.setText(
        snap.outcome === 'complete'
          ? 'CASE CLOSED'
          : snap.seen.length >= CLUES.length
            ? 'WALK TO THE DESK   J DEDUCES'
            : 'WALK TO A MARKER   J INSPECTS',
      );
    }
  }

  function actFiction(): void {
    if (narrative.parserActive()) {
      commandInput?.focus();
      lastResult = 'type-command';
      return;
    }
    const verb = FICTION_VERBS[selectedIndex];
    if (!verb) return;
    if (verb === 'LOOK') {
      narrative.setFlag(FLAG_SAW_NOTE, true);
      narrative.markSeen(SEEN_NOTE);
      narrative.goTo('looked');
      lastResult = 'looked';
      return;
    }
    if (verb === 'TAKE') {
      if (!narrative.hasFlag(FLAG_SAW_NOTE)) {
        lastResult = 'locked';
        return;
      }
      narrative.choose('take', 'taken');
      ending = 'escaped';
      outcome = 'complete';
      lastResult = 'escaped';
      return;
    }
    narrative.choose('leave', 'left');
    ending = 'walked-away';
    outcome = 'complete';
    lastResult = 'left';
  }

  function actCase(): void {
    const id = nearId();
    if (!id) {
      lastResult = 'too-far';
      return;
    }
    if (id === DESK.id) {
      if (!CLUES.every((clue) => narrative.hasSeen(clue.id))) {
        lastResult = 'need-clues';
        return;
      }
      if (codex?.active()) {
        const solved = codex.deduce(codex.invalidAttempts() === 0 ? 'false-lead' : 'window-route');
        if (!solved) {
          lastResult = codex.lastResult();
          return;
        }
      }
      narrative.setFlag('case-closed', true);
      narrative.choose('deduce', 'closed');
      ending = 'closed';
      outcome = 'complete';
      lastResult = 'deduced';
      return;
    }
    if (narrative.hasSeen(id)) {
      lastResult = 'already';
      return;
    }
    if (codex?.active()) codex.inspect(id);
    narrative.markSeen(id);
    lastResult = 'inspected';
  }

  paint();

  const onCommand = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || !commandInput) return;
    event.preventDefault();
    event.stopPropagation();
    const result = narrative.submit(commandInput.value);
    lastResult = result.reason;
    commandInput.value = '';
    paint();
  };
  commandInput?.addEventListener('keydown', onCommand);

  return {
    active: true,
    startX: () => START_X,
    startY: () => START_Y,
    setPlayer(x: number, y: number): void {
      if (disposed) return;
      playerX = x;
      playerY = y;
    },
    select(delta: number): void {
      if (disposed || mode !== 'fiction' || outcome !== 'playing' || narrative.parserActive()) return;
      selectedIndex = wrap(selectedIndex + delta, FICTION_VERBS.length);
      paint();
    },
    act(): void {
      if (disposed || outcome !== 'playing') return;
      if (mode === 'fiction') actFiction();
      else actCase();
      context.audio.playCue('ui.confirm');
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        body?.destroy();
        status?.destroy();
        hint?.destroy();
        for (const marker of markers) marker.destroy();
        for (const label of labels) label.destroy();
        evidenceLink?.destroy();
        conclusionText?.destroy();
        commandInput?.removeEventListener('keydown', onCommand);
        commandInput?.remove();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
