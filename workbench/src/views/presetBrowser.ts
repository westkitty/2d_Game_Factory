/**
 * The preset browser: all 74 recipes, honestly labelled (acceptance W13).
 *
 * Progressive disclosure is the whole design problem here. Seventy-four
 * identical cards is not a browser, it is a wall, so: search and filters up
 * front, grouped by family, proof-validated first, and the maturity and
 * starter-kit depth on every card - never softened, because a `recipe` preset
 * dressed up as a proven one is failure condition F15.
 */

import { el, button, replace, depthExplanation, depthLabel, maturityBadgeClass } from '../dom.ts';
import { getState, subscribe, type AppState, type PresetSummary } from '../state.ts';
import { goHome } from '../actions.ts';
import { openCreateDialog } from './createDialog.ts';
import { openModal } from './modal.ts';

const MATURITY_ORDER: Readonly<Record<string, number>> = {
  'proof-validated': 0,
  'smoke-validated': 1,
  recipe: 2,
  experimental: 3,
};

export function renderPresetBrowser(host: HTMLElement): () => void {
  let query = '';
  let family = 'all';
  let maturity = 'all';
  let controller = 'all';

  const results = el('div');
  const counts = el('div', { class: 'faint', style: { 'font-size': '12px', margin: '0 0 12px' } });

  function detail(preset: PresetSummary): void {
    openModal({
      title: preset.displayName,
      body: el(
        'div',
        {},
        el(
          'div',
          { class: 'row row--wrap', style: { 'margin-bottom': '12px' } },
          el('span', { class: maturityBadgeClass(preset.maturity), text: preset.maturity }),
          el('span', { class: 'badge', text: depthLabel(preset.starterKitDepth) }),
          el('span', { class: 'badge', text: preset.family }),
          ...preset.controllerFamilies.map((entry) => el('span', { class: 'badge', text: entry })),
          ...preset.inputModes.map((entry) => el('span', { class: 'badge', text: entry })),
        ),
        el('p', { class: 'muted', text: depthExplanation(preset.starterKitDepth) }),
        el('h3', { class: 'section-title', text: 'Required system packs' }),
        el('div', { class: 'row row--wrap', style: { 'margin-bottom': '12px' } }, ...preset.requiredPackIds.map((id) => el('span', { class: 'badge mono', text: id }))),
        el('h3', { class: 'section-title', text: 'Required content' }),
        el('div', { class: 'row row--wrap', style: { 'margin-bottom': '12px' } }, ...preset.requiredContentRoles.map((role) => el('span', { class: 'badge mono', text: role }))),
        preset.knownLimitations.length > 0
          ? el(
              'div',
              { class: 'warnbox' },
              el('strong', { text: 'Known limitations' }),
              el('ul', { style: { margin: '6px 0 0', 'padding-left': '18px' } }, ...preset.knownLimitations.map((limit) => el('li', { text: limit }))),
            )
          : el('div', { class: 'infobox', text: 'This preset records no known limitations.' }),
      ),
      footer: [button('Create a game from this', () => openCreateDialog({ presetId: preset.id }), { class: 'btn btn--primary' })],
    });
  }

  function card(preset: PresetSummary): HTMLElement {
    return el(
      'div',
      { class: 'card', attrs: { tabindex: '0', role: 'button' }, on: { click: () => detail(preset), keydown: (event) => { const key = (event as KeyboardEvent).key; if (key === 'Enter' || key === ' ') { event.preventDefault(); detail(preset); } } } },
      el('div', { class: 'card__head' }, el('span', { class: 'card__name truncate', text: preset.displayName }), el('span', { class: maturityBadgeClass(preset.maturity), text: preset.maturity.replace('-validated', '') })),
      el('div', { class: 'card__meta' }, el('span', { class: 'mono', text: preset.id }), el('span', { text: depthLabel(preset.starterKitDepth) })),
      preset.knownLimitations.length > 0
        ? el('div', { class: 'faint truncate', style: { 'font-size': '11px' }, text: `⚠ ${preset.knownLimitations[0]}` })
        : null,
    );
  }

  function paint(state: AppState): void {
    const presets = state.presets;
    const filtered = presets
      .filter((preset) => (family === 'all' ? true : preset.family === family))
      .filter((preset) => (maturity === 'all' ? true : preset.maturity === maturity))
      .filter((preset) => (controller === 'all' ? true : preset.controllerFamilies.includes(controller)))
      .filter((preset) => {
        if (query.length === 0) return true;
        const haystack = `${preset.displayName} ${preset.id} ${preset.family} ${preset.controllerFamilies.join(' ')}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
      .sort((a, b) => (MATURITY_ORDER[a.maturity] ?? 9) - (MATURITY_ORDER[b.maturity] ?? 9) || a.displayName.localeCompare(b.displayName));

    counts.textContent = `${filtered.length} of ${presets.length} presets. ${presets.filter((p) => p.maturity === 'proof-validated').length} proof-validated, ${presets.filter((p) => p.maturity === 'smoke-validated').length} smoke-validated, ${presets.filter((p) => p.maturity === 'recipe').length} recipe.`;

    const families = new Map<string, PresetSummary[]>();
    for (const preset of filtered) {
      const bucket = families.get(preset.family);
      if (bucket) bucket.push(preset);
      else families.set(preset.family, [preset]);
    }

    replace(
      results,
      ...[...families.entries()].map(([familyName, group]) =>
        el('div', { style: { 'margin-bottom': '22px' } }, el('h3', { class: 'section-title', text: `${familyName} · ${group.length}` }), el('div', { class: 'cards' }, ...group.map(card))),
      ),
      filtered.length === 0 ? el('div', { class: 'empty', text: 'No preset matches those filters.' }) : null,
    );
  }

  const state = getState();
  const familyOptions = ['all', ...new Set(state.presets.map((preset) => preset.family))];
  const controllerOptions = ['all', ...new Set(state.presets.flatMap((preset) => preset.controllerFamilies))];

  const filterRow = el(
    'div',
    { class: 'row row--wrap', style: { 'margin-bottom': '14px' } },
    el('input', {
      attrs: { type: 'search', placeholder: 'Search presets…', 'aria-label': 'Search presets' },
      style: { 'max-width': '260px' },
      on: { input: (event) => { query = (event.target as HTMLInputElement).value; paint(getState()); } },
    }),
    el('select', { attrs: { 'aria-label': 'Family' }, on: { change: (event) => { family = (event.target as HTMLSelectElement).value; paint(getState()); } } },
      ...familyOptions.map((option) => el('option', { text: option === 'all' ? 'All families' : option, attrs: { value: option } }))),
    el('select', { attrs: { 'aria-label': 'Maturity' }, on: { change: (event) => { maturity = (event.target as HTMLSelectElement).value; paint(getState()); } } },
      el('option', { text: 'All maturities', attrs: { value: 'all' } }),
      el('option', { text: 'Proof-validated', attrs: { value: 'proof-validated' } }),
      el('option', { text: 'Smoke-validated', attrs: { value: 'smoke-validated' } }),
      el('option', { text: 'Recipe', attrs: { value: 'recipe' } })),
    el('select', { attrs: { 'aria-label': 'Controller' }, on: { change: (event) => { controller = (event.target as HTMLSelectElement).value; paint(getState()); } } },
      ...controllerOptions.map((option) => el('option', { text: option === 'all' ? 'All controllers' : option, attrs: { value: option } }))),
  );

  replace(
    host,
    el(
      'div',
      { class: 'home' },
      el(
        'div',
        { class: 'home__inner' },
        el('div', { class: 'row', style: { 'margin-bottom': '8px' } }, button('← Home', () => goHome(), { class: 'btn btn--sm' })),
        el('h1', { class: 'home__title', text: 'Preset catalogue' }),
        el('p', {
          class: 'home__sub',
          text: 'Every genre recipe in the factory, with its real maturity. Proof-validated presets have a deep end-to-end proof game behind them and a rich starter kit here. Recipe presets are working compositions - they boot and take input, but the genre mechanics are yours to write. Nothing on this page is dressed up.',
        }),
        filterRow,
        counts,
        results,
      ),
    ),
  );

  paint(getState());
  return subscribe(paint);
}
