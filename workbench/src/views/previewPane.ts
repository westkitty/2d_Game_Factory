/**
 * The preview pane.
 *
 * An iframe pointed at a real server running the real generated Phaser game -
 * Fast Preview at the game's own dev server, Production Preview at a static
 * server over a real `vite build`. There is no editor-side approximation of
 * the game anywhere in this product (F09/W20), and the pane says which mode it
 * is showing so "it looked fine in preview" always means something specific.
 */

import { el, button, replace } from '../dom.ts';
import { getState, subscribe, type AppState } from '../state.ts';
import { runPipeline, startPreview, stopPreview } from '../actions.ts';

export function renderPreview(host: HTMLElement): () => void {
  const toolbar = el('div', { class: 'lab__toolbar' });
  const stage = el('div', { class: 'preview', style: { flex: '1 1 auto', 'min-height': '0' } });
  const root = el('div', { style: { flex: '1 1 auto', display: 'flex', 'flex-direction': 'column', 'min-height': '0' } }, toolbar, stage);

  let frame: HTMLIFrameElement | null = null;
  let shownUrl: string | null = null;

  function paint(state: AppState): void {
    const current = state.current;
    if (!current) {
      replace(toolbar, el('span', { class: 'muted', text: 'No project open.' }));
      replace(stage);
      return;
    }
    const preview = current.preview;

    replace(
      toolbar,
      el('span', { class: 'pane__title', text: 'Preview' }),
      el(
        'div',
        { class: 'toolgroup' },
        button('Fast preview', () => void startPreview('fast'), {
          class: `btn btn--sm${preview?.mode === 'fast' ? ' btn--primary' : ''}`,
          title: "The game's own dev server, with hot reload",
        }),
        button('Production preview', () => void startPreview('production'), {
          class: `btn btn--sm${preview?.mode === 'production' ? ' btn--primary' : ''}`,
          title: 'A real production build, served statically - what validation relies on',
        }),
      ),
      el(
        'div',
        { class: 'toolgroup' },
        button('Rebuild', () => void runPipeline('build'), { class: 'btn btn--sm', title: 'Run a production build now' }),
        button('Reload', () => { if (frame && shownUrl) frame.src = `${shownUrl}?r=${Date.now()}`; }, { class: 'btn btn--sm', disabled: !preview }),
        button('Stop', () => void stopPreview(), { class: 'btn btn--sm', disabled: !preview }),
      ),
      el('div', { class: 'grow' }),
      preview ? el('span', { class: 'faint mono', style: { 'font-size': '11px' }, text: preview.url }) : null,
    );

    if (!preview) {
      replace(
        stage,
        el(
          'div',
          { class: 'preview__placeholder' },
          el(
            'div',
            { class: 'empty', style: { 'max-width': '440px' } },
            el('strong', { text: 'Nothing running yet' }),
            el('div', { style: { 'margin-bottom': '12px' }, text: 'Fast preview starts this game’s own dev server, so asset and level changes show up in seconds. Production preview serves a real build - that is what Validate and Pack rely on.' }),
            button('Start fast preview', () => void startPreview('fast'), { class: 'btn btn--primary' }),
          ),
        ),
      );
      shownUrl = null;
      frame = null;
      return;
    }

    if (shownUrl !== preview.url) {
      shownUrl = preview.url;
      frame = el('iframe', {
        class: 'preview__frame',
        attrs: {
          src: preview.url,
          title: `${current.project.displayName} preview`,
          // The preview is the user's own game on loopback; it gets scripts
          // and same-origin storage, and nothing else.
          sandbox: 'allow-scripts allow-same-origin allow-pointer-lock',
          'data-testid': 'preview-frame',
        },
      }) as HTMLIFrameElement;
      replace(stage, frame);
    }
  }

  replace(host, root);
  paint(getState());
  return subscribe(paint);
}
