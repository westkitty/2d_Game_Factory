/**
 * The create-a-project dialog.
 *
 * Two jobs: pick a preset honestly, and pick an id that will not be refused.
 * The id is validated in the dialog against exactly the CLI's slug rule, so a
 * user never gets as far as a failed job to learn that capital letters are not
 * allowed.
 */

import { button, depthExplanation, depthLabel, el, maturityBadgeClass, replace, toast } from '../dom.ts';
import { getState, type PresetSummary } from '../state.ts';
import { createProject } from '../actions.ts';
import { openModal } from './modal.ts';

const SLUG = /^[a-z][a-z0-9-]*$/;

/** Same rule as `assertValidSlug` in the CLI - stated here so the message can be specific. */
export function slugProblem(value: string): string | null {
  if (value.length === 0) return 'Enter a name.';
  if (!SLUG.test(value)) return 'Lowercase letters, numbers and hyphens only, starting with a letter.';
  if (getState().projects.some((project) => project.gameId === value)) return `"${value}" already exists.`;
  return null;
}

export function suggestSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 40);
}

export interface CreateDialogOptions {
  readonly mode?: 'assets' | 'preset';
  readonly presetId?: string;
  readonly suggestedName?: string;
}

export function openCreateDialog(options: CreateDialogOptions = {}): void {
  const { presets } = getState();
  const proofFirst = [...presets].sort((a, b) => {
    const rank = (preset: PresetSummary): number =>
      preset.maturity === 'proof-validated' ? 0 : preset.maturity === 'smoke-validated' ? 1 : 2;
    return rank(a) - rank(b) || a.displayName.localeCompare(b.displayName);
  });

  let presetId = options.presetId ?? proofFirst[0]?.id ?? '';
  let gameId = suggestSlug(options.suggestedName ?? '') || 'my-game';
  let useStarterKit = true;

  const idInput = el('input', {
    attrs: { type: 'text', value: gameId, spellcheck: 'false', 'aria-label': 'Game id' },
    on: {
      input: (event) => {
        gameId = (event.target as HTMLInputElement).value;
        paintValidity();
      },
    },
  });

  const problemNode = el('div', { class: 'faint', style: { 'font-size': '11px', 'min-height': '15px', 'margin-top': '4px' } });
  const detailNode = el('div');
  const kitNote = el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-top': '4px' } });
  const createButton = button('Create game', () => void submit(), { class: 'btn btn--primary' });

  function paintValidity(): void {
    const problem = slugProblem(gameId);
    problemNode.textContent = problem ?? `Will be created at games/${gameId}/`;
    problemNode.className = problem ? 'errbox' : 'faint';
    if (problem) problemNode.style.fontSize = '11px';
    createButton.disabled = problem !== null;
  }

  function paintPreset(): void {
    const preset = presets.find((candidate) => candidate.id === presetId);
    if (!preset) {
      replace(detailNode);
      return;
    }
    replace(
      detailNode,
      el(
        'div',
        { class: 'row row--wrap', style: { 'margin-bottom': '8px' } },
        el('span', { class: maturityBadgeClass(preset.maturity), text: preset.maturity }),
        el('span', { class: 'badge', text: depthLabel(preset.starterKitDepth) }),
        el('span', { class: 'badge', text: preset.family }),
        ...preset.inputModes.map((mode) => el('span', { class: 'badge', text: mode })),
      ),
      el('div', { class: 'muted', style: { 'font-size': '12px', 'margin-bottom': '8px' }, text: depthExplanation(preset.starterKitDepth) }),
      preset.knownLimitations.length > 0
        ? el(
            'div',
            { class: 'warnbox' },
            el('strong', { text: 'Known limitations of this preset' }),
            el('ul', { style: { margin: '6px 0 0', 'padding-left': '18px' } }, ...preset.knownLimitations.map((limit) => el('li', { text: limit }))),
          )
        : null,
    );
    kitNote.textContent =
      preset.starterKitDepth === 'rich-proof-kit'
        ? 'Unticking this gives you the bare generated shell instead of the playable starting point.'
        : 'This preset has no rich starter kit, so this makes no difference to it.';
  }

  async function submit(): Promise<void> {
    if (slugProblem(gameId)) return;
    close();
    const ok = await createProject({ gameId, presetId, useStarterKit });
    if (!ok) toast('Creation failed - see Activity for the reason.', 'err');
  }

  const presetSelect = el(
    'select',
    {
      attrs: { 'aria-label': 'Preset' },
      on: {
        change: (event) => {
          presetId = (event.target as HTMLSelectElement).value;
          paintPreset();
        },
      },
    },
    ...proofFirst.map((preset) =>
      el('option', {
        text: `${preset.displayName} — ${preset.maturity}`,
        attrs: { value: preset.id, selected: preset.id === presetId },
      }),
    ),
  );

  const close = openModal({
    title: options.mode === 'assets' ? 'Create a project, then bring in your assets' : 'Create a game',
    body: el(
      'div',
      {},
      el('label', { class: 'field' }, el('span', { text: 'Game id' }), idInput, problemNode),
      el('label', { class: 'field' }, el('span', { text: 'Preset' }), presetSelect),
      detailNode,
      el(
        'label',
        { class: 'row', style: { gap: '8px', 'margin-top': '10px' } },
        el('input', {
          attrs: { type: 'checkbox', checked: true },
          on: { change: (event) => { useStarterKit = (event.target as HTMLInputElement).checked; } },
        }),
        el('span', { text: 'Use the starter kit' }),
      ),
      kitNote,
    ),
    footer: [createButton],
  });

  paintValidity();
  paintPreset();
  idInput.focus();
  idInput.select();
}
