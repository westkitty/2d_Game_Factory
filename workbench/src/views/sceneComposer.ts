/**
 * The Scene Composer.
 *
 * It edits the game's real `content/levels/<id>.json` - the same Tiled-shaped
 * document the running game loads - and validates through the real pipeline
 * before every write (acceptance W18, failure conditions F09/F10).
 *
 * The one behaviour worth calling out is overlap selection (W19/F11). A
 * full-screen background object must never make the platform behind it
 * unreachable, so: clicking a point cycles through every object under the
 * cursor smallest-first, the object list is a first-class selection surface,
 * and per-object hide and lock are one click away.
 */

import { el, button, replace, toast } from '../dom.ts';
import * as api from '../api.ts';
import { getState, subscribe } from '../state.ts';
import { errorText } from '../actions.ts';
import { openModal } from './modal.ts';

interface SceneObject {
  id: number;
  class: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, string | number | boolean>;
  layer: string;
}

interface SceneDocument {
  levelId: string;
  mapWidth: number;
  mapHeight: number;
  tileWidth: number;
  tileHeight: number;
  layers: string[];
  objects: SceneObject[];
}

interface ObjectClassOption {
  readonly id: string;
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  readonly requiredProperties: readonly { readonly name: string; readonly type: string }[];
}

const CLASS_COLORS: Readonly<Record<string, string>> = {
  Solid: '#5a678f',
  PlayerSpawn: '#61d3a4',
  Checkpoint: '#4f9ee0',
  Collectible: '#f0c274',
  Hazard: '#e0574f',
  Exit: '#b98af0',
  Enemy: '#e05fa0',
};

function colorFor(classId: string): string {
  return CLASS_COLORS[classId] ?? '#7d8798';
}

export function renderSceneComposer(host: HTMLElement): () => void {
  let scene: SceneDocument | null = null;
  let classes: readonly ObjectClassOption[] = [];
  let levelId = 'main';
  let selectedIds: number[] = [];
  const hidden = new Set<number>();
  const locked = new Set<number>();
  let dirty = false;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let objectFilter = '';
  /** Remembers the last click point so a repeat click at the same spot advances through the stack. */
  let lastHitPoint: { x: number; y: number; index: number } | null = null;

  const canvas = el('canvas', { class: 'scene__stage', attrs: { 'data-testid': 'scene-canvas' } });
  const stageWrap = el('div', { class: 'scene__stage-wrap' }, canvas);
  const listBody = el('div', { class: 'pane__body', style: { padding: '6px' } });
  const listHead = el('div', { class: 'pane__head' });
  const toolbar = el('div', { class: 'lab__toolbar' });
  const root = el('div', { style: { flex: '1 1 auto', display: 'flex', 'flex-direction': 'column', 'min-height': '0' } },
    toolbar,
    el('div', { class: 'scene' }, el('div', { class: 'scene__list' }, listHead, listBody), stageWrap),
  );

  // --- data -----------------------------------------------------------------

  async function load(): Promise<void> {
    const { current } = getState();
    if (!current) return;
    try {
      if (classes.length === 0) {
        const result = await api.get<{ classes: readonly ObjectClassOption[] }>('/scene/classes');
        classes = result.classes;
      }
      const result = await api.get<{ scene: SceneDocument }>('/scene', { gameId: current.project.gameId, levelId });
      scene = result.scene;
      selectedIds = [];
      dirty = false;
      fit();
      paint();
    } catch (error) {
      replace(toolbar, el('span', { class: 'muted', text: errorText(error) }));
    }
  }

  async function save(): Promise<void> {
    const { current } = getState();
    if (!current || !scene) return;
    try {
      const result = await api.post<{ scene: SceneDocument; objectCount: number }>('/scene', { gameId: current.project.gameId, scene });
      scene = result.scene;
      dirty = false;
      paint();
      toast(`Level saved and validated (${result.objectCount} objects).`, 'ok');
    } catch (error) {
      // A 422 is the pipeline refusing an edit that would not load. Saying so
      // plainly is the point: the file on disk is still the last good one.
      toast(`Not saved: ${errorText(error)}`, 'err');
    }
  }

  // --- geometry -------------------------------------------------------------

  function worldWidth(): number {
    return scene ? scene.mapWidth * scene.tileWidth : 960;
  }
  function worldHeight(): number {
    return scene ? scene.mapHeight * scene.tileHeight : 544;
  }

  function fit(): void {
    const rect = stageWrap.getBoundingClientRect();
    if (rect.width === 0) return;
    zoom = Math.min(rect.width / worldWidth(), rect.height / worldHeight()) * 0.94;
    panX = (rect.width - worldWidth() * zoom) / 2;
    panY = (rect.height - worldHeight() * zoom) / 2;
  }

  function toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left - panX) / zoom, y: (clientY - rect.top - panY) / zoom };
  }

  function hitsAt(x: number, y: number): SceneObject[] {
    if (!scene) return [];
    return scene.objects
      .filter((object) => !hidden.has(object.id) && !locked.has(object.id))
      .filter((object) => {
        const width = Math.max(object.width, 12);
        const height = Math.max(object.height, 12);
        return x >= object.x && x <= object.x + width && y >= object.y && y <= object.y + height;
      })
      // Smallest first: a small object on top of a large one is the case where
      // "topmost wins" is wrong, because the small one is what was aimed at.
      .sort((a, b) => Math.max(a.width, 1) * Math.max(a.height, 1) - Math.max(b.width, 1) * Math.max(b.height, 1));
  }

  // --- drawing --------------------------------------------------------------

  function paintCanvas(): void {
    const rect = stageWrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const context = canvas.getContext('2d');
    if (!context || !scene) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);

    context.save();
    context.translate(panX, panY);
    context.scale(zoom, zoom);

    context.fillStyle = '#11161f';
    context.fillRect(0, 0, worldWidth(), worldHeight());

    context.strokeStyle = 'rgba(255,255,255,0.045)';
    context.lineWidth = 1 / zoom;
    for (let x = 0; x <= worldWidth(); x += scene.tileWidth) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, worldHeight());
      context.stroke();
    }
    for (let y = 0; y <= worldHeight(); y += scene.tileHeight) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(worldWidth(), y);
      context.stroke();
    }

    // Largest first, so small objects are drawn on top and are visible even
    // when they sit inside a big one.
    const ordered = [...scene.objects].sort(
      (a, b) => Math.max(b.width, 12) * Math.max(b.height, 12) - Math.max(a.width, 12) * Math.max(a.height, 12),
    );
    for (const object of ordered) {
      if (hidden.has(object.id)) continue;
      const width = Math.max(object.width, 12);
      const height = Math.max(object.height, 12);
      const color = colorFor(object.class);
      context.globalAlpha = locked.has(object.id) ? 0.3 : 0.72;
      context.fillStyle = color;
      context.fillRect(object.x, object.y, width, height);
      context.globalAlpha = 1;
      context.strokeStyle = selectedIds.includes(object.id) ? '#ffffff' : color;
      context.lineWidth = (selectedIds.includes(object.id) ? 2.5 : 1) / zoom;
      context.strokeRect(object.x, object.y, width, height);

      if (zoom > 0.55) {
        context.fillStyle = 'rgba(255,255,255,0.86)';
        context.font = `${11 / zoom}px ui-monospace, monospace`;
        context.fillText(object.class, object.x + 3 / zoom, object.y - 3 / zoom);
      }
    }
    context.restore();
  }

  // --- interaction ----------------------------------------------------------

  let dragging: { id: number; offsetX: number; offsetY: number } | null = null;
  let panning: { x: number; y: number } | null = null;

  canvas.addEventListener('pointerdown', (event) => {
    if (!scene) return;
    if (event.button === 1 || event.shiftKey) {
      panning = { x: event.clientX - panX, y: event.clientY - panY };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    const point = toWorld(event.clientX, event.clientY);
    const hits = hitsAt(point.x, point.y);
    if (hits.length === 0) {
      selectedIds = [];
      lastHitPoint = null;
      paint();
      return;
    }

    // Overlap cycling: clicking the same spot again selects the next object
    // down the stack instead of re-selecting the one already chosen.
    let index = 0;
    if (lastHitPoint && Math.abs(lastHitPoint.x - point.x) < 6 && Math.abs(lastHitPoint.y - point.y) < 6) {
      index = (lastHitPoint.index + 1) % hits.length;
    }
    lastHitPoint = { x: point.x, y: point.y, index };
    const target = hits[index]!;

    if (event.metaKey || event.ctrlKey) {
      selectedIds = selectedIds.includes(target.id) ? selectedIds.filter((id) => id !== target.id) : [...selectedIds, target.id];
    } else {
      selectedIds = [target.id];
      dragging = { id: target.id, offsetX: point.x - target.x, offsetY: point.y - target.y };
      canvas.setPointerCapture(event.pointerId);
    }
    paint();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (panning) {
      panX = event.clientX - panning.x;
      panY = event.clientY - panning.y;
      paintCanvas();
      return;
    }
    if (!dragging || !scene) return;
    const point = toWorld(event.clientX, event.clientY);
    const object = scene.objects.find((candidate) => candidate.id === dragging!.id);
    if (!object) return;
    const snap = (event.altKey ? 1 : scene.tileWidth / 2);
    object.x = Math.round((point.x - dragging.offsetX) / snap) * snap;
    object.y = Math.round((point.y - dragging.offsetY) / snap) * snap;
    dirty = true;
    paintCanvas();
  });

  canvas.addEventListener('pointerup', () => {
    if (dragging) paint();
    dragging = null;
    panning = null;
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const before = toWorld(event.clientX, event.clientY);
    zoom = Math.max(0.15, Math.min(4, zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
    const after = toWorld(event.clientX, event.clientY);
    panX += (after.x - before.x) * zoom;
    panY += (after.y - before.y) * zoom;
    paintCanvas();
  }, { passive: false });

  function onKeyDown(event: KeyboardEvent): void {
    if (!scene || selectedIds.length === 0) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    const step = event.shiftKey ? scene.tileWidth : 1;
    let handled = true;
    if (event.key === 'ArrowLeft') nudge(-step, 0);
    else if (event.key === 'ArrowRight') nudge(step, 0);
    else if (event.key === 'ArrowUp') nudge(0, -step);
    else if (event.key === 'ArrowDown') nudge(0, step);
    else if (event.key === 'Delete' || event.key === 'Backspace') removeSelected();
    else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') duplicateSelected();
    else handled = false;
    if (handled) {
      event.preventDefault();
      paint();
    }
  }

  function nudge(dx: number, dy: number): void {
    if (!scene) return;
    for (const id of selectedIds) {
      const object = scene.objects.find((candidate) => candidate.id === id);
      if (!object || locked.has(id)) continue;
      object.x += dx;
      object.y += dy;
    }
    dirty = true;
  }

  function removeSelected(): void {
    if (!scene) return;
    scene.objects = scene.objects.filter((object) => !selectedIds.includes(object.id) || locked.has(object.id));
    selectedIds = [];
    dirty = true;
  }

  function duplicateSelected(): void {
    if (!scene) return;
    let nextId = scene.objects.reduce((max, object) => Math.max(max, object.id), 0);
    const copies = selectedIds
      .map((id) => scene!.objects.find((object) => object.id === id))
      .filter((object): object is SceneObject => object !== undefined)
      .map((object) => ({ ...object, id: ++nextId, x: object.x + 24, y: object.y + 24, properties: { ...object.properties } }));
    scene.objects.push(...copies);
    selectedIds = copies.map((copy) => copy.id);
    dirty = true;
  }

  async function addObject(classId: string): Promise<void> {
    const { current } = getState();
    if (!current || !scene) return;
    const centreX = worldWidth() / 2;
    const centreY = worldHeight() / 2;
    try {
      const result = await api.post<{ object: SceneObject }>('/scene/new-object', {
        gameId: current.project.gameId,
        levelId,
        classId,
        x: centreX,
        y: centreY,
      });
      scene.objects.push(result.object);
      selectedIds = [result.object.id];
      dirty = true;
      paint();
    } catch (error) {
      toast(errorText(error), 'err');
    }
  }

  // --- panels ---------------------------------------------------------------

  function paintToolbar(): void {
    const { current } = getState();
    replace(
      toolbar,
      el('span', { class: 'pane__title', text: 'Scene' }),
      current && current.levels.length > 1
        ? el('select', { on: { change: (event) => { levelId = (event.target as HTMLSelectElement).value; void load(); } } },
            ...current.levels.map((id) => el('option', { text: id, attrs: { value: id, selected: id === levelId } })))
        : el('span', { class: 'faint mono', text: levelId }),
      el('div', { class: 'toolgroup' },
        button('Add…', () => openAddDialog(), { class: 'btn btn--sm' }),
        button('Duplicate', () => { duplicateSelected(); paint(); }, { class: 'btn btn--sm', disabled: selectedIds.length === 0 }),
        button('Delete', () => { removeSelected(); paint(); }, { class: 'btn btn--sm btn--danger', disabled: selectedIds.length === 0 }),
      ),
      el('div', { class: 'toolgroup' },
        button('Fit', () => { fit(); paintCanvas(); }, { class: 'btn btn--sm' }),
        el('span', { class: 'faint', style: { 'font-size': '11px' }, text: `${Math.round(zoom * 100)}%` }),
      ),
      el('div', { class: 'grow' }),
      el('span', { class: 'faint', style: { 'font-size': '11px' }, text: dirty ? 'unsaved changes' : 'saved' }),
      button('Save level', () => void save(), { class: 'btn btn--primary btn--sm', disabled: !dirty }),
    );
  }

  function paintList(): void {
    replace(
      listHead,
      el('input', {
        attrs: { type: 'search', placeholder: 'Find object…', 'aria-label': 'Find object' },
        on: { input: (event) => { objectFilter = (event.target as HTMLInputElement).value.toLowerCase(); paintList(); } },
      }),
    );

    if (!scene) {
      replace(listBody, el('div', { class: 'faint', text: 'No level open.' }));
      return;
    }

    const byLayer = new Map<string, SceneObject[]>();
    for (const object of scene.objects) {
      if (objectFilter && !`${object.name} ${object.class}`.toLowerCase().includes(objectFilter)) continue;
      const bucket = byLayer.get(object.layer);
      if (bucket) bucket.push(object);
      else byLayer.set(object.layer, [object]);
    }

    replace(
      listBody,
      ...[...byLayer.entries()].map(([layer, objects]) =>
        el(
          'div',
          { class: 'folder' },
          el('div', { class: 'folder__head' }, el('span', { text: layer }), el('span', { class: 'faint', text: String(objects.length) })),
          ...objects.map((object) =>
            el(
              'div',
              {
                class: `scene-obj-row${hidden.has(object.id) ? ' scene-obj-row--hidden' : ''}`,
                attrs: { 'aria-selected': selectedIds.includes(object.id), 'data-object-id': object.id },
                on: { click: () => { selectedIds = [object.id]; paint(); } },
              },
              el('span', { style: { width: '8px', height: '8px', 'border-radius': '2px', background: colorFor(object.class), flex: '0 0 auto' } }),
              el('span', { class: 'grow truncate', text: object.name || object.class }),
              el('span', { class: 'scene-obj-row__class', text: object.class }),
              button(hidden.has(object.id) ? '🚫' : '👁', () => {
                if (hidden.has(object.id)) hidden.delete(object.id);
                else hidden.add(object.id);
                paint();
              }, { class: 'icon-btn', attrs: { 'aria-pressed': hidden.has(object.id), 'aria-label': `Toggle visibility of ${object.name || object.class}` } }),
              button(locked.has(object.id) ? '🔒' : '🔓', () => {
                if (locked.has(object.id)) locked.delete(object.id);
                else locked.add(object.id);
                paint();
              }, { class: 'icon-btn', attrs: { 'aria-pressed': locked.has(object.id), 'aria-label': `Toggle lock of ${object.name || object.class}` } }),
            ),
          ),
        ),
      ),
      scene.objects.length === 0 ? el('div', { class: 'empty', style: { padding: '14px' }, text: 'This level has no objects yet.' }) : null,
      selectedIds.length === 1 ? propertyEditor(scene.objects.find((object) => object.id === selectedIds[0])) : null,
    );
  }

  function propertyEditor(object: SceneObject | undefined): HTMLElement | null {
    if (!object || !scene) return null;
    const numberField = (label: string, value: number, apply: (next: number) => void): HTMLElement =>
      el('label', { class: 'field' }, el('span', { text: label }), el('input', {
        attrs: { type: 'number', value: String(Math.round(value)) },
        on: { change: (event) => { apply(Number((event.target as HTMLInputElement).value) || 0); dirty = true; paint(); } },
      }));

    return el(
      'div',
      { style: { 'border-top': '1px solid var(--border)', 'margin-top': '10px', 'padding-top': '10px' } },
      el('h3', { class: 'section-title', text: `${object.class} #${object.id}` }),
      el('label', { class: 'field' }, el('span', { text: 'Name' }), el('input', {
        attrs: { type: 'text', value: object.name },
        on: { change: (event) => { object.name = (event.target as HTMLInputElement).value; dirty = true; paint(); } },
      })),
      el('div', { class: 'row' }, numberField('X', object.x, (v) => { object.x = v; }), numberField('Y', object.y, (v) => { object.y = v; })),
      el('div', { class: 'row' }, numberField('Width', object.width, (v) => { object.width = Math.max(0, v); }), numberField('Height', object.height, (v) => { object.height = Math.max(0, v); })),
      ...Object.entries(object.properties).map(([key, value]) =>
        el('label', { class: 'field' }, el('span', { text: key }), el('input', {
          attrs: { type: typeof value === 'number' ? 'number' : 'text', value: String(value) },
          on: {
            change: (event) => {
              const raw = (event.target as HTMLInputElement).value;
              object.properties[key] = typeof value === 'number' ? Number(raw) || 0 : typeof value === 'boolean' ? raw === 'true' : raw;
              dirty = true;
            },
          },
        })),
      ),
    );
  }

  function openAddDialog(): void {
    const close = openModal({
      title: 'Add an object',
      body: el(
        'div',
        {},
        el('p', { class: 'muted', style: { 'margin-top': '0' }, text: 'These are the semantic object classes the content pipeline understands. Required properties are filled with valid defaults, so the level still validates the moment you add one.' }),
        el(
          'div',
          { class: 'cards' },
          ...classes.map((option) =>
            el(
              'button',
              { class: 'card', attrs: { type: 'button' }, on: { click: () => { close(); void addObject(option.id); } } },
              el('div', { class: 'row' }, el('span', { style: { width: '10px', height: '10px', 'border-radius': '2px', background: colorFor(option.id) } }), el('span', { class: 'card__name', text: option.id })),
              option.requiredProperties.length > 0
                ? el('div', { class: 'faint', style: { 'font-size': '11px' }, text: `needs ${option.requiredProperties.map((property) => property.name).join(', ')}` })
                : el('div', { class: 'faint', style: { 'font-size': '11px' }, text: 'no required properties' }),
            ),
          ),
        ),
      ),
    });
  }

  function paint(): void {
    paintToolbar();
    paintList();
    paintCanvas();
  }

  const observer = new ResizeObserver(() => paintCanvas());
  observer.observe(stageWrap);
  document.addEventListener('keydown', onKeyDown);
  replace(host, root);
  void load();

  const unsubscribe = subscribe(() => paintToolbar());

  return () => {
    observer.disconnect();
    document.removeEventListener('keydown', onKeyDown);
    unsubscribe();
  };
}
