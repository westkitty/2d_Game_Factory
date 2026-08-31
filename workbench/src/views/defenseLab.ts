/** Phase 21 balance authoring. Spatial routes/zones remain JSON-authored. */
import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface Tower { id: string; cost: number; range: number; blocking?: boolean; upgrades?: { id: string; cost: number }[] }
interface Capture { id: string; captureMs: number; scorePerSecond?: number }
interface DocumentModel { schemaVersion: 1; startingFunds?: number; towers?: Tower[]; captureZones?: Capture[] }
interface Inspect { document: DocumentModel; towerCount: number; blockingTowerCount: number; laneCount: number; routeCount: number; baseCount: number; captureZoneCount: number }

function numberField(label: string, value: number, min = '0'): { row: HTMLElement; input: HTMLInputElement } {
  const input = el('input', { attrs: { type: 'number', value: String(value), min, step: '1' }, style: { width: '76px', padding: '2px 4px', 'font-size': '12px' } }) as HTMLInputElement;
  return { input, row: el('div', { style: { display: 'flex', gap: '6px', 'align-items': 'center', 'margin-bottom': '4px' } }, el('span', { class: 'faint', style: { 'min-width': '104px' }, text: label }), input) };
}

export function renderDefenseLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Defense & Territory' }), body);
  let disposed = false;
  async function refresh(): Promise<void> {
    try {
      const result = await api.post<Inspect>('/defense/inspect', { gameId }); if (disposed) return;
      const doc = result.document; const funds = numberField('Starting funds', doc.startingFunds ?? 0); const status = el('span', { class: 'faint', style: { 'margin-left': '8px' } });
      const towerRows = (doc.towers ?? []).map((tower) => { const cost = numberField('Cost', tower.cost); const range = numberField('Range', tower.range, '0.01'); return { tower, cost, range, upgrades: (tower.upgrades ?? []).map((upgrade) => ({ upgrade, cost: numberField(`${upgrade.id} cost`, upgrade.cost) })), block: el('div', { style: { 'border-top': '1px solid var(--line,#333)', padding: '7px 0' } }, el('strong', { text: tower.id }), tower.blocking ? el('span', { class: 'faint', text: ' · blocks routes' }) : null, cost.row, range.row) }; });
      const captureRows = (doc.captureZones ?? []).map((zone) => { const capture = numberField('Capture ms', zone.captureMs, '1'); const score = numberField('Score / sec', zone.scorePerSecond ?? 0); return { zone, capture, score, block: el('div', { style: { 'border-top': '1px solid var(--line,#333)', padding: '7px 0' } }, el('strong', { text: zone.id }), capture.row, score.row) }; });
      const save = el('button', { class: 'btn btn--sm', text: 'Save' });
      save.addEventListener('click', async () => { const next: DocumentModel = structuredClone(doc); next.startingFunds = Number(funds.input.value); towerRows.forEach(({ tower, cost, range, upgrades }) => { const dst = next.towers?.find((item) => item.id === tower.id)!; dst.cost = Number(cost.input.value); dst.range = Number(range.input.value); upgrades.forEach(({ upgrade, cost: input }) => { const tier = dst.upgrades?.find((item) => item.id === upgrade.id); if (tier) tier.cost = Number(input.input.value); }); }); captureRows.forEach(({ zone, capture, score }) => { const dst = next.captureZones?.find((item) => item.id === zone.id)!; dst.captureMs = Number(capture.input.value); dst.scorePerSecond = Number(score.input.value); }); try { await api.post('/defense/update', { gameId, document: next }); status.textContent = 'Saved.'; } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); } });
      replace(body, el('div', {}, funds.row, save, status), el('p', { class: 'faint', text: `${result.towerCount} towers (${result.blockingTowerCount} blocking), ${result.laneCount} lanes / ${result.routeCount} protected routes, ${result.baseCount} bases, ${result.captureZoneCount} capture zones. Routes and build zones stay structural JSON: a number form is not a map editor.` }), ...towerRows.map((row) => row.block), ...captureRows.map((row) => row.block));
    } catch (error) { if (!disposed) replace(body, el('div', { class: 'faint', text: error instanceof Error && /No content\/defense/.test(error.message) ? 'No content/defense.json in project.' : String(error) })); }
  }
  void refresh(); return () => { disposed = true; };
}
