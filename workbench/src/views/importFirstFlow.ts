/**
 * "Make Something From an Image" - the product's headline path.
 *
 * One image in, a real playable game out, in four steps and without the user
 * ever needing to know what a preset is:
 *
 *   pick an image -> say what it is -> choose a direction -> name it
 *
 * The seeds are computed before any project exists, so changing your mind
 * leaves nothing on disk. The genre choice comes *after* the image, because
 * the image is what the user actually has; asking them to pick a genre first
 * is the engine-setup-first ordering this product exists to remove.
 */

import { el, button, replace, toast } from '../dom.ts';
import * as api from '../api.ts';
import { analyseFile, rasterToDataUrl, rasterToPngBlob, blobToRaster, type AnalysisHints } from '../image/clientImage.ts';
import { fitWithin } from '../../shared/image/transforms.ts';
import { applyRecipe } from '../../shared/image/recipe.ts';
import { openModal } from './modal.ts';
import { createProject, errorText, openProject, refreshCurrent, savePanels, startPreview } from '../actions.ts';
import { slugProblem, suggestSlug } from './createDialog.ts';
import { depthExplanation, depthLabel, maturityBadgeClass } from '../dom.ts';
import { ROLE_LABELS, type AssetRecord, type GameSeed, type ImageAnalysis, type SingleImageMode, type TransformRecipe, type WorkbenchAssetRole } from '../../shared/types.ts';
import { getState, update } from '../state.ts';

interface Picked {
  readonly file: File;
  readonly previewUrl: string;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly hasAlpha: boolean;
  readonly pixelArtLikely: boolean;
  readonly analysis: AnalysisHints;
}

function spriteRecipeFor(source: ReturnType<typeof applyRecipe>, analysis: ImageAnalysis, mode: SingleImageMode, pixelArt: boolean): { recipe: TransformRecipe; raster: ReturnType<typeof applyRecipe> } {
  const steps: TransformRecipe['steps'][number][] = [];
  if (mode === 'spritesheet') {
    const grid = analysis.gridSuggestions[0];
    if (grid) steps.push({ op: 'gridCell', columns: grid.columns, rows: grid.rows, cell: 0 });
  } else if (!analysis.hasAlpha) {
    steps.push({ op: 'removeBackground', sampleX: 0, sampleY: 0, tolerance: 24, edgeConnected: true });
  }
  steps.push({ op: 'trimAlpha', threshold: 8 });

  let recipe: TransformRecipe = { version: 1, steps };
  let raster = applyRecipe(source, recipe);
  const maxSide = Math.max(raster.width, raster.height);
  const minSide = Math.min(raster.width, raster.height);
  let scale = 1;
  if (maxSide > 256) scale = 256 / maxSide;
  else if (minSide < 8) scale = 8 / minSide;
  if (scale !== 1) {
    const width = Math.max(1, Math.round(raster.width * scale));
    const height = Math.max(1, Math.round(raster.height * scale));
    steps.push({ op: 'scale', width, height, mode: pixelArt ? 'nearest' : 'smooth' });
    recipe = { version: 1, steps };
    raster = applyRecipe(source, recipe);
  }
  return { recipe, raster };
}

/**
 * The single-image modes (section 17).
 *
 * Asking is the point: pretending every image is the same kind of source is
 * how a tool ends up putting a background photo on a 28px player sprite.
 */
const MODES: readonly { readonly id: SingleImageMode; readonly label: string; readonly hint: string; readonly roles: readonly WorkbenchAssetRole[] }[] = [
  { id: 'direct', label: 'It is a character or object', hint: 'Use these pixels as the player, and derive the palette and fallback art from them.', roles: ['player'] },
  { id: 'direct', label: 'It is a scene or background', hint: 'Use it as the game world backdrop, and derive the palette and everything else from it.', roles: ['background'] },
  { id: 'extract', label: 'It has several things in it', hint: 'Import it now; the Asset Lab can split the separate pieces out afterwards.', roles: ['background'] },
  { id: 'spritesheet', label: 'It is a sprite sheet', hint: 'Import it now; the Asset Lab can slice the grid and you pick which frame each role uses.', roles: ['player'] },
  { id: 'reference', label: 'It is reference only', hint: 'These pixels will not enter the game. You get the palette and generated art built from it.', roles: [] },
];

export async function openImportFirstFlow(): Promise<void> {
  let picked: Picked | null = null;
  let modeIndex = 0;
  let seeds: readonly GameSeed[] = [];
  let chosen: GameSeed | null = null;
  let gameId = '';

  const stepHost = el('div');
  const footerHost = el('div', { class: 'row' });

  const close = openModal({
    wide: true,
    title: 'Make something from an image',
    body: stepHost,
    footer: [footerHost],
  });

  // --- step 1: pick ---------------------------------------------------------

  function renderPick(): void {
    const filePicker = el('input', { attrs: { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: 'true' } });
    filePicker.addEventListener('change', () => {
      const file = filePicker.files?.[0];
      if (file) void accept(file);
    });

    const dropzone = el(
      'div',
      { class: 'dropzone', attrs: { tabindex: '0', role: 'button' }, style: { padding: '46px' } },
      el('div', { style: { 'font-size': '38px', 'margin-bottom': '10px' }, text: '🖼️' }),
      el('div', { style: { 'font-size': '15px', color: 'var(--text)' }, text: 'Drop one image here, or click to choose' }),
      el('div', { style: { 'margin-top': '6px' }, text: 'PNG, JPEG or WebP. A character cut-out, a background, a sprite sheet - all work.' }),
    );
    dropzone.addEventListener('click', () => filePicker.click());
    dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        filePicker.click();
      }
    });
    dropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropzone.classList.add('dropzone--over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dropzone--over'));
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('dropzone--over');
      const file = event.dataTransfer?.files?.[0];
      if (file) void accept(file);
    });

    replace(stepHost, dropzone, filePicker);
    replace(footerHost, el('span', { class: 'faint', text: 'Nothing is uploaded anywhere. This all happens on your machine.' }));
  }

  async function accept(file: File): Promise<void> {
    replace(stepHost, el('div', { class: 'empty', text: `Reading ${file.name}…` }));
    try {
      const raster = await blobToRaster(file);
      const hints = await analyseFile(file);
      picked = {
        file,
        previewUrl: rasterToDataUrl(fitWithin(raster, 260, 260, raster.width <= 128 ? 'nearest' : 'smooth')),
        width: raster.width,
        height: raster.height,
        palette: hints.palette,
        hasAlpha: hints.hasAlpha,
        pixelArtLikely: hints.pixelArtLikely,
        analysis: hints,
      };
      // A transparent, portrait-ish cut-out is almost always a character; a
      // wide opaque image is almost always scenery. Pre-selecting the likely
      // answer is a suggestion, and the user can still say otherwise.
      modeIndex = picked.hasAlpha && picked.width <= picked.height * 1.15 ? 0 : 1;
      renderMode();
    } catch (error) {
      toast(errorText(error), 'err');
      renderPick();
    }
  }

  // --- step 2: what is it? --------------------------------------------------

  function renderMode(): void {
    if (!picked) return;
    const options = MODES.map((mode, index) =>
      el(
        'label',
        {
          class: 'card',
          style: { cursor: 'pointer', 'flex-direction': 'row', 'align-items': 'flex-start', gap: '10px' },
          on: { click: () => { modeIndex = index; renderMode(); } },
        },
        el('input', { attrs: { type: 'radio', name: 'mode', checked: index === modeIndex } }),
        el('div', {}, el('div', { class: 'card__name', text: mode.label }), el('div', { class: 'muted', style: { 'font-size': '12px' }, text: mode.hint })),
      ),
    );

    replace(
      stepHost,
      el(
        'div',
        { class: 'row', style: { 'align-items': 'flex-start', gap: '20px' } },
        el(
          'div',
          { style: { flex: '0 0 260px' } },
          el('img', { attrs: { src: picked.previewUrl, alt: '' }, style: { 'max-width': '100%', 'border-radius': 'var(--radius)', background: 'var(--bg-input)' } }),
          el('div', { class: 'faint', style: { 'margin-top': '6px', 'font-size': '11px' }, text: `${picked.width}x${picked.height}${picked.hasAlpha ? ' · transparent' : ''}${picked.pixelArtLikely ? ' · pixel art' : ''}` }),
          el('div', { class: 'palette', style: { 'margin-top': '8px' } }, ...picked.palette.map((color) => el('div', { class: 'swatch', title: color, style: { background: color } }))),
        ),
        el('div', { class: 'grow' }, el('h3', { style: { margin: '0 0 4px' }, text: 'What is this image?' }), el('p', { class: 'muted', style: { 'margin-top': '0' }, text: 'This decides what the factory does with the pixels.' }), el('div', { style: { display: 'grid', gap: '8px' } }, ...options)),
      ),
    );

    replace(
      footerHost,
      button('Back', () => renderPick(), { class: 'btn' }),
      button('Suggest games from this', () => void renderSeeds(), { class: 'btn btn--primary' }),
    );
  }

  // --- step 3: seeds --------------------------------------------------------

  async function renderSeeds(): Promise<void> {
    if (!picked) return;
    const mode = MODES[modeIndex]!;
    replace(stepHost, el('div', { class: 'empty', text: 'Working out what this could become…' }));
    replace(footerHost);
    try {
      const result = await api.post<{ seeds: readonly GameSeed[] }>('/seeds/preview', {
        roles: mode.roles,
        palette: picked.palette,
        mode: mode.id,
        limit: 3,
      });
      seeds = result.seeds;
    } catch (error) {
      toast(errorText(error), 'err');
      renderMode();
      return;
    }

    if (seeds.length === 0) {
      replace(stepHost, el('div', { class: 'empty' }, el('strong', { text: 'No proven direction fits this yet' }), el('div', { text: 'Every preset is still available in the full browser - they are just not things this workbench can promise a playable result from in one click.' })));
      replace(footerHost, button('Back', () => renderMode(), { class: 'btn' }), button('Browse all presets', () => { close(); getState(); }, { class: 'btn' }));
      return;
    }

    replace(
      stepHost,
      el('p', { class: 'muted', style: { 'margin-top': '0' }, text: seeds.length === 1 ? 'One direction genuinely fits what you brought. Others are in the full preset browser.' : `${seeds.length} directions fit what you brought. Each one is a real, playable starting point - not a mockup.` }),
      el('div', { class: 'seeds' }, ...seeds.map(seedCard)),
    );
    replace(footerHost, button('Back', () => renderMode(), { class: 'btn' }));
  }

  function seedCard(seed: GameSeed): HTMLElement {
    const covered = seed.rolePlan.filter((entry) => entry.assetId !== null).length;
    return el(
      'div',
      { class: 'seed' },
      el('div', { class: 'row row--wrap' }, el('span', { class: maturityBadgeClass(seed.maturity), text: seed.maturity }), el('span', { class: 'badge', text: depthLabel(seed.starterKitDepth) })),
      el('div', { class: 'seed__title', text: seed.presetDisplayName }),
      el('div', { class: 'seed__loop', text: seed.loop }),
      el('div', { class: 'palette' }, ...seed.palette.slice(0, 6).map((color) => el('div', { class: 'swatch', style: { background: color } }))),
      el(
        'div',
        {},
        el('div', { class: 'faint', style: { 'font-size': '11px', 'margin-bottom': '3px' }, text: `Your image covers ${covered} of ${seed.rolePlan.length} roles; the rest use generated art from its palette.` }),
        el('div', { class: 'coverage' }, el('div', { class: 'coverage__fill', style: { width: `${Math.round(seed.assetCoverageScore * 100)}%` } })),
      ),
      seed.knownLimitations.length > 0
        ? el('div', { class: 'seed__limits' }, el('strong', { text: 'Known limitations: ' }), seed.knownLimitations.join(' '))
        : el('div', { class: 'seed__limits', text: depthExplanation(seed.starterKitDepth) }),
      button('Use this', () => { chosen = seed; renderName(); }, { class: 'btn btn--primary' }),
    );
  }

  // --- step 4: name and build ----------------------------------------------

  function renderName(): void {
    if (!chosen || !picked) return;
    gameId = suggestSlug(picked.file.name.replace(/\.[a-z0-9]+$/i, '')) || suggestSlug(chosen.presetId) || 'my-game';

    const input = el('input', {
      attrs: { type: 'text', value: gameId, spellcheck: 'false', 'aria-label': 'Game id' },
      on: { input: (event) => { gameId = (event.target as HTMLInputElement).value; paint(); } },
    });
    const problem = el('div', { style: { 'font-size': '11px', 'min-height': '15px', 'margin-top': '4px' } });
    const go = button('Build my game', () => void build(), { class: 'btn btn--primary' });

    function paint(): void {
      const issue = slugProblem(gameId);
      problem.textContent = issue ?? `Will be created at games/${gameId}/`;
      problem.className = issue ? 'errbox' : 'faint';
      go.disabled = issue !== null;
    }

    replace(
      stepHost,
      el('h3', { style: { margin: '0 0 4px' }, text: `Name your ${chosen.presetDisplayName.toLowerCase()}` }),
      el('p', { class: 'muted', style: { 'margin-top': '0' }, text: 'This becomes the folder name under games/ and the id the CLI uses.' }),
      el('label', { class: 'field' }, el('span', { text: 'Game id' }), input, problem),
    );
    replace(footerHost, button('Back', () => void renderSeeds(), { class: 'btn' }), go);
    paint();
    input.focus();
    input.select();
  }

  async function build(): Promise<void> {
    if (!chosen || !picked) return;
    const mode = MODES[modeIndex]!;
    close();

    const created = await createProject({ gameId, presetId: chosen.presetId });
    if (!created) return;

    // The project now exists and is open. Bring the image in and map it,
    // through exactly the same staged import path the Import Inbox uses.
    try {
      const { batchId } = await api.post<{ batchId: string }>('/import/begin', { gameId });
      const hints = picked.analysis;
      await api.postBytes('/import/file', picked.file, {
        'x-sw2d-batch': batchId,
        'x-sw2d-name': picked.file.name,
        'x-sw2d-path': picked.file.name,
        'x-sw2d-hints': JSON.stringify(hints),
      });
      const plan = await api.get<{ files: readonly { stagingId: string; analysis: ImageAnalysis }[] }>('/import/plan', { gameId, batchId });
      const staged = plan.files[0];
      const stagingId = staged?.stagingId;
      if (!stagingId) throw new Error('That image could not be read after all.');

      const committed = await api.post<{ state: { assets: readonly AssetRecord[] } }>('/import/commit', {
        gameId,
        batchId,
        selections: [{ stagingId, ...(mode.roles[0] ? { role: mode.roles[0] } : {}) }],
        provenance:
          mode.id === 'reference'
            ? { kind: 'reference-only', modificationStatus: 'unmodified' }
            : { kind: 'project-owned', modificationStatus: 'unmodified' },
      });

      let sprite: AssetRecord | null = null;
      if (mode.roles[0] === 'player' && staged) {
        const source = committed.state.assets.find((asset) => asset.kind === 'source' && asset.sha256 === staged.analysis.sha256);
        if (!source) throw new Error('The supplied image was imported, but its source record could not be found for sprite creation.');
        const sourceRaster = await blobToRaster(picked.file);
        const prepared = spriteRecipeFor(sourceRaster, staged.analysis, mode.id, picked.pixelArtLikely);
        const blob = await rasterToPngBlob(prepared.raster);
        const derived = await api.postBytes<{ asset: AssetRecord }>('/assets/derive', blob, {
          'x-sw2d-game': gameId,
          'x-sw2d-source': source.id,
          'x-sw2d-name': `${picked.file.name.replace(/\.[a-z0-9]+$/i, '')}-player-sprite.png`,
          'x-sw2d-recipe': JSON.stringify(prepared.recipe),
          'x-sw2d-purpose': 'sprite',
        });
        sprite = derived.asset;
        if (sprite.validation?.status !== 'valid') throw new Error('The sprite was created but did not pass validation.');
        await api.post('/assets/role', { gameId, role: 'player', assetId: sprite.id });
      }
      await refreshCurrent();
      await openProject(gameId);
      savePanels({ activeWorkspace: 'preview' });
      await startPreview('fast');
      if (sprite) update({ selectedAssetId: sprite.id });
      toast(
        sprite
          ? `Created and validated ${sprite.displayName} against your supplied image. The game is running now.`
          : mode.roles[0]
          ? `Your image is now the ${ROLE_LABELS[mode.roles[0]]}. The game is running now.`
          : 'Imported as reference. Its palette drives the theme; the pixels stay out of the game.',
        'ok',
      );
    } catch (error) {
      toast(errorText(error), 'err');
    }
  }

  renderPick();
}
