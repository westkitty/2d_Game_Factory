/**
 * Procedural-generation authoring surface (capability program Phase 7).
 *
 * The smallest useful surface: choose a generator from the project's
 * `content/generation.json`, set a seed and the major parameters, regenerate,
 * and read back a reproducible manifest. Same seed in -> same manifest out,
 * every time. "Copy seed" puts the effective seed on the clipboard so a
 * layout can be reproduced later.
 *
 * It never writes: it calls `POST /api/generation/preview`, which runs the
 * pure `runGenerator` from `@sw2d/contracts` server-side. Renders nothing when
 * the project defines no generators.
 */

import { el, button, replace, toast } from '../dom.ts';
import * as api from '../api.ts';

interface PreviewResult {
  generatorId: string;
  generators: { id: string; kind: string }[];
  documentSeed: number;
  effectiveSeed: number;
  manifest: {
    seed: number;
    kind: string;
    chosenTemplates: string[];
    graph: { nodes: string[]; edges: { from: string; to: string; viaDoor: string }[] };
    retries: number;
  };
  validation: { valid: boolean; errors: string[] };
  output: { solids: number; objects: number };
}

export function renderGenerationLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Procedural generation' }), body);

  let generatorId: string | null = null;
  let seedOverride = '';
  let sizeOverride = '';
  let difficultyOverride = '';
  let last: PreviewResult | null = null;
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const res = await api.post<PreviewResult>('/generation/preview', {
        gameId,
        ...(generatorId ? { generatorId } : {}),
        ...(seedOverride.trim() !== '' && Number.isFinite(Number(seedOverride)) ? { seed: Number(seedOverride) } : {}),
        ...(sizeOverride.trim() !== '' && Number.isFinite(Number(sizeOverride)) ? { size: Number(sizeOverride) } : {}),
        ...(difficultyOverride.trim() !== '' && Number.isFinite(Number(difficultyOverride)) ? { difficulty: Number(difficultyOverride) } : {}),
      });
      if (disposed) return;
      last = res;
      generatorId = res.generatorId;
      paint();
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'This project has no content/generation.json generators.' }));
    }
  }

  function field(label: string, value: string, onInput: (v: string) => void, placeholder: string): HTMLElement {
    const input = el('input', {
      class: 'input input--sm',
      attrs: { type: 'number', value, placeholder, style: 'width:96px' },
    }) as HTMLInputElement;
    input.addEventListener('input', () => onInput(input.value));
    input.addEventListener('change', () => void refresh());
    return el('label', { class: 'field', style: { display: 'flex', gap: '6px', 'align-items': 'center' } }, el('span', { class: 'faint', text: label }), input);
  }

  function paint(): void {
    if (!last) {
      replace(body, el('div', { class: 'faint', text: 'Loading…' }));
      return;
    }
    const r = last;
    const select = el('select', { class: 'input input--sm' }) as HTMLSelectElement;
    for (const g of r.generators) {
      const opt = el('option', { attrs: { value: g.id }, text: `${g.id} (${g.kind})` }) as HTMLOptionElement;
      if (g.id === r.generatorId) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      generatorId = select.value;
      void refresh();
    });

    replace(
      body,
      el('div', { class: 'row', style: { gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' } }, el('span', { class: 'faint', text: 'Generator' }), select),
      el(
        'div',
        { class: 'row', style: { gap: '10px', 'margin-top': '8px', 'flex-wrap': 'wrap' } },
        field('Seed', seedOverride, (v) => (seedOverride = v), String(r.documentSeed)),
        field('Size', sizeOverride, (v) => (sizeOverride = v), 'default'),
        field('Difficulty', difficultyOverride, (v) => (difficultyOverride = v), 'default'),
      ),
      el(
        'div',
        { class: 'toolgroup', style: { 'margin-top': '10px' } },
        button('Regenerate', () => void refresh(), { class: 'btn btn--sm btn--primary' }),
        button(`Copy seed (${r.effectiveSeed})`, () => {
          void navigator.clipboard?.writeText(String(r.effectiveSeed)).then(
            () => toast('Seed copied.', 'ok'),
            () => toast('Could not copy.', 'warn'),
          );
        }, { class: 'btn btn--sm' }),
      ),
      el(
        'div',
        { style: { 'margin-top': '12px', 'line-height': '1.6' } },
        el('div', {}, el('strong', { text: 'kind: ' }), el('span', { text: r.manifest.kind })),
        el('div', {}, el('strong', { text: 'effective seed: ' }), el('span', { text: String(r.effectiveSeed) })),
        el(
          'div',
          {},
          el('strong', { text: r.validation.valid ? 'valid ✓' : 'INVALID ✗' }),
          r.validation.errors.length > 0 ? el('span', { class: 'faint', text: ` — ${r.validation.errors.join('; ')}` }) : null,
        ),
        el('div', {}, el('strong', { text: 'geometry: ' }), el('span', { text: `${r.output.solids} solids, ${r.output.objects} objects` })),
        r.manifest.kind === 'room-graph'
          ? el('div', {}, el('strong', { text: 'rooms: ' }), el('span', { text: `${r.manifest.graph.nodes.length} (${r.manifest.graph.edges.length} doors, ${r.manifest.retries} retries)` }))
          : el('div', {}, el('strong', { text: 'segments: ' }), el('span', { text: String(r.manifest.chosenTemplates.length) })),
        el('div', { class: 'faint', style: { 'word-break': 'break-all', 'margin-top': '4px' }, text: r.manifest.chosenTemplates.join(' → ') }),
      ),
      el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-top': '10px' }, text: 'Same seed always reproduces this exact manifest. The game reads the seed from content/generation.json.' }),
    );
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
