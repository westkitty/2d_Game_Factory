/**
 * The Asset Lab.
 *
 * Non-destructive by construction: the source raster is loaded once and never
 * written to, and every operation appends a step to a recipe that is replayed
 * from that source (principles P01/P03). Undo and redo are therefore just a
 * cursor into the step list, not a pixel buffer - which is why undo survives
 * an operation that changes the image's dimensions, and why a saved derivative
 * can be rebuilt from its source months later.
 */

import { el, button, replace, toast } from '../dom.ts';
import * as api from '../api.ts';
import { getState, selectedAsset, subscribe, update } from '../state.ts';
import { errorText, refreshCurrent } from '../actions.ts';
import { blobToRaster, drawRasterInto, rasterToPngBlob } from '../image/clientImage.ts';
import { applyRecipe, describeStep, pushStep, truncateRecipe } from '../../shared/image/recipe.ts';
import { findComponents, suggestGrids, alphaBounds } from '../../shared/image/transforms.ts';
import type { Raster } from '../../shared/image/raster.ts';
import { EMPTY_RECIPE, type TransformRecipe, type TransformStep, type WorkbenchAssetRole } from '../../shared/types.ts';
import { openModal } from './modal.ts';

type Tool = 'none' | 'crop' | 'eyedropper' | 'erase' | 'restore';

interface LabState {
  assetId: string | null;
  source: Raster | null;
  recipe: TransformRecipe;
  /** Steps beyond this index are the redo tail. */
  cursor: number;
  tool: Tool;
  brushRadius: number;
  tolerance: number;
  edgeConnected: boolean;
}

const lab: LabState = {
  assetId: null,
  source: null,
  recipe: EMPTY_RECIPE,
  cursor: 0,
  tool: 'none',
  brushRadius: 12,
  tolerance: 30,
  edgeConnected: true,
};

/** The recipe as it stands at the undo cursor - what the canvas shows and what a save would record. */
function activeRecipe(): TransformRecipe {
  return truncateRecipe(lab.recipe, lab.cursor);
}

function currentRaster(): Raster | null {
  if (!lab.source) return null;
  try {
    return applyRecipe(lab.source, activeRecipe());
  } catch (error) {
    toast(errorText(error), 'err');
    return lab.source;
  }
}

export function renderAssetLab(host: HTMLElement): () => void {
  const canvas = el('canvas', { class: 'lab__canvas', attrs: { 'data-testid': 'lab-canvas' } });
  const canvasWrap = el('div', { class: 'lab__canvas-wrap' }, canvas);
  const toolbar = el('div', { class: 'lab__toolbar' });
  const history = el('div', { class: 'lab__history' });
  const root = el('div', { class: 'lab' }, toolbar, canvasWrap, history);

  let loadingFor: string | null = null;

  function addStep(step: TransformStep): void {
    // Appending after an undo discards the redo tail, which is the behaviour
    // every editor has and everyone expects.
    lab.recipe = pushStep(truncateRecipe(lab.recipe, lab.cursor), step);
    lab.cursor = lab.recipe.steps.length;
    paint();
  }

  function paint(): void {
    const asset = selectedAsset();
    paintToolbar(asset);
    paintHistory();
    const raster = currentRaster();
    if (raster) {
      drawRasterInto(canvas, raster);
      // Small art is displayed at an integer zoom so pixel work is legible;
      // large art is shown at its own size and scrolled.
      const zoom = raster.width <= 128 ? 4 : raster.width <= 320 ? 2 : 1;
      canvas.style.width = `${raster.width * zoom}px`;
      canvas.style.height = `${raster.height * zoom}px`;
    }
  }

  async function loadAsset(assetId: string): Promise<void> {
    const { current } = getState();
    if (!current) return;
    const asset = current.assets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    loadingFor = assetId;
    replace(toolbar, el('span', { class: 'muted', text: `Loading ${asset.displayName}…` }));
    try {
      const raster = await blobToRaster(await api.assetBlob(current.project.gameId, asset.id));
      if (loadingFor !== assetId) return; // a newer selection won the race
      lab.assetId = assetId;
      lab.source = raster;
      // A derived asset opens with its own recipe already loaded, so editing
      // it continues its history rather than starting a second one.
      lab.recipe = asset.transformRecipe ?? EMPTY_RECIPE;
      lab.cursor = lab.recipe.steps.length;
      lab.tool = 'none';
      paint();
    } catch (error) {
      toast(errorText(error), 'err');
    }
  }

  // --- canvas interaction ---------------------------------------------------

  function canvasPoint(event: PointerEvent): [number, number] {
    const rect = canvas.getBoundingClientRect();
    const raster = currentRaster();
    if (!raster) return [0, 0];
    return [
      Math.floor(((event.clientX - rect.left) / rect.width) * raster.width),
      Math.floor(((event.clientY - rect.top) / rect.height) * raster.height),
    ];
  }

  let dragStart: [number, number] | null = null;
  let strokePoints: [number, number][] = [];

  canvas.addEventListener('pointerdown', (event) => {
    if (lab.tool === 'none') return;
    canvas.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    if (lab.tool === 'eyedropper') {
      addStep({ op: 'removeBackground', sampleX: point[0], sampleY: point[1], tolerance: lab.tolerance, edgeConnected: lab.edgeConnected });
      lab.tool = 'none';
      paint();
      return;
    }
    if (lab.tool === 'crop') {
      dragStart = point;
      return;
    }
    strokePoints = [point];
  });

  canvas.addEventListener('pointermove', (event) => {
    if (lab.tool === 'erase' || lab.tool === 'restore') {
      if (strokePoints.length === 0) return;
      strokePoints.push(canvasPoint(event));
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    if (lab.tool === 'crop' && dragStart) {
      const end = canvasPoint(event);
      const rect = {
        x: Math.min(dragStart[0], end[0]),
        y: Math.min(dragStart[1], end[1]),
        width: Math.abs(end[0] - dragStart[0]),
        height: Math.abs(end[1] - dragStart[1]),
      };
      dragStart = null;
      lab.tool = 'none';
      if (rect.width < 2 || rect.height < 2) {
        toast('That crop was too small to be a rectangle.', 'warn');
        paint();
        return;
      }
      addStep({ op: 'crop', rect });
      return;
    }
    if ((lab.tool === 'erase' || lab.tool === 'restore') && strokePoints.length > 0) {
      addStep({ op: 'maskStroke', mode: lab.tool === 'erase' ? 'erase' : 'restore', points: strokePoints, radius: lab.brushRadius });
      strokePoints = [];
    }
  });

  // --- toolbar --------------------------------------------------------------

  function toolButton(label: string, tool: Tool, title: string): HTMLElement {
    return button(label, () => { lab.tool = lab.tool === tool ? 'none' : tool; paint(); }, {
      class: `btn btn--sm${lab.tool === tool ? ' btn--primary' : ''}`,
      title,
    });
  }

  function paintToolbar(asset: ReturnType<typeof selectedAsset>): void {
    if (!asset || !lab.source) {
      replace(toolbar, el('span', { class: 'muted', text: 'Select an asset in the library to work on it.' }));
      return;
    }
    const raster = currentRaster();
    const dirty = lab.cursor > 0;

    replace(
      toolbar,
      el(
        'div',
        { class: 'toolgroup' },
        button('↶', () => { if (lab.cursor > 0) { lab.cursor -= 1; paint(); } }, {
          class: 'btn btn--sm btn--icon', title: 'Undo (Cmd/Ctrl+Z)', disabled: lab.cursor === 0,
        }),
        button('↷', () => { if (lab.cursor < lab.recipe.steps.length) { lab.cursor += 1; paint(); } }, {
          class: 'btn btn--sm btn--icon', title: 'Redo (Cmd/Ctrl+Shift+Z)', disabled: lab.cursor >= lab.recipe.steps.length,
        }),
      ),
      el(
        'div',
        { class: 'toolgroup' },
        toolButton('Crop', 'crop', 'Drag a rectangle on the image'),
        button('Trim', () => addStep({ op: 'trimAlpha', threshold: 8 }), { class: 'btn btn--sm', title: 'Trim transparent margins' }),
        button('Fit bounds', () => {
          const bounds = raster ? alphaBounds(raster) : null;
          if (!bounds) { toast('Nothing visible to fit to.', 'warn'); return; }
          addStep({ op: 'crop', rect: bounds });
        }, { class: 'btn btn--sm', title: 'Crop to the visible pixels' }),
      ),
      el(
        'div',
        { class: 'toolgroup' },
        button('⇋', () => addStep({ op: 'flip', axis: 'horizontal' }), { class: 'btn btn--sm btn--icon', title: 'Flip horizontally' }),
        button('⇅', () => addStep({ op: 'flip', axis: 'vertical' }), { class: 'btn btn--sm btn--icon', title: 'Flip vertically' }),
        button('⟳', () => addStep({ op: 'rotate', quarterTurns: 1 }), { class: 'btn btn--sm btn--icon', title: 'Rotate 90°' }),
        button('Scale…', () => openScaleDialog(raster, addStep), { class: 'btn btn--sm' }),
      ),
      el(
        'div',
        { class: 'toolgroup' },
        toolButton('Pick background', 'eyedropper', 'Click the background colour to remove it'),
        el('label', { class: 'row', style: { gap: '4px', 'font-size': '11px' } },
          el('span', { class: 'faint', text: 'tol' }),
          el('input', {
            attrs: { type: 'range', min: '0', max: '120', value: String(lab.tolerance) },
            style: { width: '70px' },
            on: { input: (event) => { lab.tolerance = Number((event.target as HTMLInputElement).value); } },
          }),
        ),
        el('label', { class: 'row', style: { gap: '4px', 'font-size': '11px' }, title: 'Only clear background reachable from the image edge' },
          el('input', {
            attrs: { type: 'checkbox', checked: lab.edgeConnected },
            on: { change: (event) => { lab.edgeConnected = (event.target as HTMLInputElement).checked; } },
          }),
          el('span', { class: 'faint', text: 'edge only' }),
        ),
      ),
      el(
        'div',
        { class: 'toolgroup' },
        toolButton('Erase', 'erase', 'Paint transparency'),
        toolButton('Restore', 'restore', 'Bring back erased pixels from the source'),
        el('input', {
          attrs: { type: 'range', min: '2', max: '60', value: String(lab.brushRadius), 'aria-label': 'Brush size' },
          style: { width: '70px' },
          on: { input: (event) => { lab.brushRadius = Number((event.target as HTMLInputElement).value); } },
        }),
        button('Invert', () => addStep({ op: 'invertMask' }), { class: 'btn btn--sm', title: 'Invert the mask' }),
        button('+1px', () => addStep({ op: 'growAlpha', pixels: 1 }), { class: 'btn btn--sm', title: 'Expand the mask' }),
        button('−1px', () => addStep({ op: 'shrinkAlpha', pixels: 1 }), { class: 'btn btn--sm', title: 'Contract the mask' }),
        button('Feather', () => addStep({ op: 'featherAlpha', radius: 1 }), { class: 'btn btn--sm' }),
      ),
      el(
        'div',
        { class: 'toolgroup' },
        button('Split pieces…', () => openComponentsDialog(raster, addStep), { class: 'btn btn--sm', title: 'Find and extract disconnected shapes' }),
        button('Slice sheet…', () => openGridDialog(raster, addStep), { class: 'btn btn--sm', title: 'Treat this as a sprite sheet' }),
        button('Variants…', () => openVariantsDialog(addStep), { class: 'btn btn--sm', title: 'Outline, shadow, silhouette, tint, damage flash' }),
      ),
      el('div', { class: 'grow' }),
      el('span', { class: 'faint', text: raster ? `${raster.width}x${raster.height}` : '' }),
      button('Save as new asset', () => void saveDerived(), { class: 'btn btn--primary btn--sm', disabled: !dirty, title: dirty ? 'Store this as a new derived asset' : 'Make a change first' }),
    );
  }

  function paintHistory(): void {
    if (!lab.source) {
      replace(history, el('span', { class: 'faint', text: 'No asset open.' }));
      return;
    }
    if (lab.recipe.steps.length === 0) {
      replace(history, el('span', { class: 'faint', text: 'Untouched source. Every edit is recorded here and can be undone or replayed.' }));
      return;
    }
    replace(
      history,
      el(
        'div',
        {},
        el(
          'div',
          { class: 'hist-row', style: { cursor: 'pointer' }, on: { click: () => { lab.cursor = 0; paint(); } } },
          el('span', { class: 'hist-row__index', text: '0' }),
          el('span', { class: 'muted', text: 'Source' }),
        ),
        ...lab.recipe.steps.map((step, index) =>
          el(
            'div',
            {
              class: `hist-row${index >= lab.cursor ? ' hist-row--future' : ''}`,
              style: { cursor: 'pointer' },
              on: { click: () => { lab.cursor = index + 1; paint(); } },
            },
            el('span', { class: 'hist-row__index', text: String(index + 1) }),
            el('span', { text: describeStep(step) }),
          ),
        ),
      ),
    );
  }

  async function saveDerived(): Promise<void> {
    const { current } = getState();
    const asset = selectedAsset();
    const raster = currentRaster();
    if (!current || !asset || !raster || !lab.source) return;
    // A derivative always hangs off a *source*. Editing a derivative records
    // the combined recipe against the original source, so lineage never grows
    // a chain the rebuild path would have to walk.
    const sourceAssetId = asset.sourceAssetId ?? asset.id;
    try {
      const blob = await rasterToPngBlob(raster);
      const baseName = asset.displayName.replace(/\.[a-z0-9]+$/i, '');
      const result = await api.postBytes<{ asset: { id: string } }>('/assets/derive', blob, {
        'x-sw2d-game': current.project.gameId,
        'x-sw2d-source': sourceAssetId,
        'x-sw2d-name': `${baseName}-edit.png`,
        'x-sw2d-recipe': JSON.stringify(activeRecipe()),
      });
      await refreshCurrent();
      update({ selectedAssetId: result.asset.id });
      toast('Saved as a new derived asset. Your source is untouched.', 'ok');
    } catch (error) {
      toast(errorText(error), 'err');
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    event.preventDefault();
    if (event.shiftKey) {
      if (lab.cursor < lab.recipe.steps.length) lab.cursor += 1;
    } else if (lab.cursor > 0) {
      lab.cursor -= 1;
    }
    paint();
  }

  document.addEventListener('keydown', onKeyDown);
  replace(host, root);

  const unsubscribe = subscribe((state) => {
    if (state.selectedAssetId && state.selectedAssetId !== lab.assetId) void loadAsset(state.selectedAssetId);
    else if (!state.selectedAssetId) {
      lab.assetId = null;
      lab.source = null;
      paint();
    }
  });

  const initial = getState().selectedAssetId;
  if (initial) void loadAsset(initial);
  else paint();

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    unsubscribe();
  };
}

// --- dialogs ---------------------------------------------------------------

function openScaleDialog(raster: Raster | null, addStep: (step: TransformStep) => void): void {
  if (!raster) return;
  let width = raster.width;
  let height = raster.height;
  let preserve = true;
  let mode: 'nearest' | 'smooth' = raster.width <= 256 ? 'nearest' : 'smooth';
  const aspect = raster.width / raster.height;

  const widthInput = el('input', { attrs: { type: 'number', min: '1', value: String(width) } });
  const heightInput = el('input', { attrs: { type: 'number', min: '1', value: String(height) } });

  widthInput.addEventListener('input', () => {
    width = Math.max(1, Number(widthInput.value) || 1);
    if (preserve) {
      height = Math.max(1, Math.round(width / aspect));
      heightInput.value = String(height);
    }
  });
  heightInput.addEventListener('input', () => {
    height = Math.max(1, Number(heightInput.value) || 1);
    if (preserve) {
      width = Math.max(1, Math.round(height * aspect));
      widthInput.value = String(width);
    }
  });

  const close = openModal({
    title: 'Scale',
    body: el(
      'div',
      {},
      el('div', { class: 'row' },
        el('label', { class: 'field grow' }, el('span', { text: 'Width' }), widthInput),
        el('label', { class: 'field grow' }, el('span', { text: 'Height' }), heightInput),
      ),
      el('label', { class: 'row', style: { gap: '8px' } },
        el('input', { attrs: { type: 'checkbox', checked: true }, on: { change: (event) => { preserve = (event.target as HTMLInputElement).checked; } } }),
        el('span', { text: 'Preserve aspect ratio' }),
      ),
      el('label', { class: 'field', style: { 'margin-top': '10px' } },
        el('span', { text: 'Resampling' }),
        el('select', { on: { change: (event) => { mode = (event.target as HTMLSelectElement).value as 'nearest' | 'smooth'; } } },
          el('option', { text: 'Nearest neighbour (crisp pixel art)', attrs: { value: 'nearest', selected: mode === 'nearest' } }),
          el('option', { text: 'Smooth (photographic art)', attrs: { value: 'smooth', selected: mode === 'smooth' } }),
        ),
      ),
    ),
    footer: [button('Scale', () => { close(); addStep({ op: 'scale', width, height, mode }); }, { class: 'btn btn--primary' })],
  });
}

function openComponentsDialog(raster: Raster | null, addStep: (step: TransformStep) => void): void {
  if (!raster) return;
  const components = findComponents(raster, 8);
  if (components.length <= 1) {
    toast(components.length === 0 ? 'Nothing visible to split.' : 'This image is one connected shape - nothing to split out.', 'warn');
    return;
  }
  const close = openModal({
    title: `${components.length} separate pieces found`,
    body: el(
      'div',
      {},
      el('p', { class: 'muted', style: { 'margin-top': '0' }, text: 'Each piece is a disconnected visible shape. Pick one to extract; the numbering is stable, so a recipe that names piece 2 still means this piece after a reload.' }),
      el(
        'div',
        { class: 'cards' },
        ...components.map((component) =>
          el(
            'button',
            { class: 'card', attrs: { type: 'button' }, on: { click: () => { close(); addStep({ op: 'component', index: component.index, alphaThreshold: 8 }); } } },
            el('div', { class: 'card__name', text: `Piece ${component.index + 1}` }),
            el('div', { class: 'card__meta' },
              el('span', { text: `${component.bounds.width}x${component.bounds.height}` }),
              el('span', { text: `${component.pixelCount} px` }),
            ),
          ),
        ),
      ),
    ),
  });
}

function openGridDialog(rasterOrNull: Raster | null, addStep: (step: TransformStep) => void): void {
  if (!rasterOrNull) return;
  const raster = rasterOrNull;
  const suggestions = suggestGrids(raster.width, raster.height);
  let columns = suggestions[0]?.columns ?? 4;
  let rows = suggestions[0]?.rows ?? 1;
  let cell = 0;

  const info = el('div', { class: 'faint', style: { 'margin-top': '6px' } });
  function paintInfo(): void {
    const frameWidth = Math.floor(raster.width / columns);
    const frameHeight = Math.floor(raster.height / rows);
    info.textContent = `${columns * rows} cells of ${frameWidth}x${frameHeight}. Extracting cell ${cell + 1}.`;
  }

  const columnsInput = el('input', { attrs: { type: 'number', min: '1', max: '64', value: String(columns) }, on: { input: (event) => { columns = Math.max(1, Number((event.target as HTMLInputElement).value) || 1); paintInfo(); } } });
  const rowsInput = el('input', { attrs: { type: 'number', min: '1', max: '64', value: String(rows) }, on: { input: (event) => { rows = Math.max(1, Number((event.target as HTMLInputElement).value) || 1); paintInfo(); } } });
  const cellInput = el('input', { attrs: { type: 'number', min: '1', value: '1' }, on: { input: (event) => { cell = Math.max(0, (Number((event.target as HTMLInputElement).value) || 1) - 1); paintInfo(); } } });

  const close = openModal({
    title: 'Slice as a sprite sheet',
    body: el(
      'div',
      {},
      suggestions.length > 0
        ? el(
            'div',
            { style: { 'margin-bottom': '12px' } },
            el('div', { class: 'faint', style: { 'margin-bottom': '6px' }, text: 'Grids these dimensions divide into evenly:' }),
            el('div', { class: 'row row--wrap' },
              ...suggestions.map((suggestion) =>
                button(`${suggestion.columns}x${suggestion.rows} (${suggestion.frameWidth}px)`, () => {
                  columns = suggestion.columns;
                  rows = suggestion.rows;
                  columnsInput.value = String(columns);
                  rowsInput.value = String(rows);
                  paintInfo();
                }, { class: 'btn btn--sm' }),
              ),
            ),
          )
        : el('div', { class: 'warnbox', text: 'These dimensions do not divide evenly into any plausible grid - a sheet with padding often will not. Set the columns and rows by hand.' }),
      el('div', { class: 'row' },
        el('label', { class: 'field grow' }, el('span', { text: 'Columns' }), columnsInput),
        el('label', { class: 'field grow' }, el('span', { text: 'Rows' }), rowsInput),
        el('label', { class: 'field grow' }, el('span', { text: 'Cell' }), cellInput),
      ),
      info,
    ),
    footer: [button('Extract cell', () => { close(); addStep({ op: 'gridCell', columns, rows, cell }); }, { class: 'btn btn--primary' })],
  });
  paintInfo();
}

function openVariantsDialog(addStep: (step: TransformStep) => void): void {
  const variants: readonly { readonly label: string; readonly hint: string; readonly step: TransformStep }[] = [
    { label: 'Outline', hint: 'A dark 2px edge - makes a sprite read against a busy background.', step: { op: 'outline', color: '#0b0d13', thickness: 2 } },
    { label: 'Drop shadow', hint: 'Offset soft shadow, so the sprite sits in the scene.', step: { op: 'dropShadow', offsetX: 3, offsetY: 4, color: '#000000', blur: 2 } },
    { label: 'Silhouette', hint: 'Flat black shape, keeping the alpha - good for a shadow or a menu icon.', step: { op: 'silhouette', color: '#000000' } },
    { label: 'Damage flash', hint: 'Pushed hard toward white - the hit frame.', step: { op: 'damageFlash', color: '#ffffff', amount: 0.75 } },
    { label: 'Desaturated', hint: 'Fully grey - a disabled or background-layer version.', step: { op: 'desaturate', amount: 1 } },
    { label: 'Tinted', hint: 'A 35% colour wash - a palette-swapped variant.', step: { op: 'tint', color: '#61d3a4', amount: 0.35 } },
  ];
  const close = openModal({
    title: 'Make a variant',
    body: el(
      'div',
      { class: 'cards' },
      ...variants.map((variant) =>
        el(
          'button',
          { class: 'card', attrs: { type: 'button' }, on: { click: () => { close(); addStep(variant.step); } } },
          el('div', { class: 'card__name', text: variant.label }),
          el('div', { class: 'muted', style: { 'font-size': '12px' }, text: variant.hint }),
        ),
      ),
    ),
  });
}

/** Used by the inspector's "replace this source" action - a reimport keeps the asset's identity (P02/P04). */
export async function reimportAsset(assetId: string, file: File, roleHint?: WorkbenchAssetRole): Promise<void> {
  const { current } = getState();
  if (!current) return;
  void roleHint;
  try {
    const result = await api.postBytes<{ changed: boolean; staleDerivedIds: readonly string[]; rebuiltOnHost: readonly string[]; rebuildInClient: readonly string[] }>(
      '/assets/reimport',
      file,
      { 'x-sw2d-game': current.project.gameId, 'x-sw2d-asset': assetId, 'x-sw2d-name': file.name },
    );
    if (!result.changed) {
      toast('Those are the same bytes - nothing changed.', 'warn');
      return;
    }
    // Anything the host could not rebuild (non-PNG source) is rebuilt here,
    // where the browser's decoders are.
    for (const derivedId of result.rebuildInClient) await rebuildDerivedInClient(derivedId);
    await refreshCurrent();
    toast(
      result.staleDerivedIds.length > 0
        ? `Source replaced. ${result.staleDerivedIds.length} derivative(s) rebuilt from their recipes; roles kept.`
        : 'Source replaced. Roles kept.',
      'ok',
    );
  } catch (error) {
    toast(errorText(error), 'err');
  }
}

/** Replays one derivative's recipe in the browser and re-uploads the result. */
async function rebuildDerivedInClient(derivedId: string): Promise<void> {
  const { current } = getState();
  if (!current) return;
  const derived = current.assets.find((asset) => asset.id === derivedId);
  const source = derived?.sourceAssetId ? current.assets.find((asset) => asset.id === derived.sourceAssetId) : null;
  if (!derived || !source || !derived.transformRecipe) return;
  const sourceRaster = await blobToRaster(await api.assetBlob(current.project.gameId, source.id));
  const rebuilt = applyRecipe(sourceRaster, derived.transformRecipe);
  const blob = await rasterToPngBlob(rebuilt);
  await api.postBytes('/assets/derive', blob, {
    'x-sw2d-game': current.project.gameId,
    'x-sw2d-source': source.id,
    'x-sw2d-name': derived.displayName,
    'x-sw2d-recipe': JSON.stringify(derived.transformRecipe),
  });
}

export { blobToRaster };
