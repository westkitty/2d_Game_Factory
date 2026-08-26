/**
 * The workbench entry point.
 *
 * A three-route app - home, preset browser, workspace - mounted into `#app`.
 * Each route owns its own subscriptions and returns a disposer, so switching
 * routes cannot leave a listener behind repainting a pane that no longer
 * exists.
 */

import './styles.css';
import { el, replace, toast } from './dom.ts';
import { hasSession } from './api.ts';
import { boot, errorText } from './actions.ts';
import { getState, subscribe, type Route } from './state.ts';
import { renderHome } from './views/home.ts';
import { renderWorkspace } from './views/workspace.ts';
import { renderPresetBrowser } from './views/presetBrowser.ts';

const app = document.getElementById('app');
if (!app) throw new Error('#app is missing from index.html');
const root: HTMLElement = app;

let currentRoute: Route | null = null;
let disposeRoute: (() => void) | null = null;

function mount(route: Route): void {
  disposeRoute?.();
  disposeRoute = null;
  currentRoute = route;
  if (route === 'workspace') disposeRoute = renderWorkspace(root);
  else if (route === 'presets') disposeRoute = renderPresetBrowser(root);
  else disposeRoute = renderHome(root);
}

subscribe((state) => {
  if (!state.booted) return;
  if (state.route !== currentRoute) mount(state.route);
});

if (!hasSession()) {
  // The token only reaches this page through the host's own HTML injection.
  // Its absence means the page was not served by the workbench host, and no
  // API call would succeed - saying so beats a cascade of 401s.
  replace(
    root,
    el(
      'div',
      { class: 'home' },
      el(
        'div',
        { class: 'empty', style: { 'max-width': '520px', margin: '60px auto' } },
        el('strong', { text: 'This page was not served by the workbench host' }),
        el('div', { text: 'Start it with `npm run dev` and open the URL it prints. The workbench needs its own local host to reach the factory.' }),
      ),
    ),
  );
} else {
  root.setAttribute('aria-busy', 'false');
  boot()
    .then(() => mount(getState().route))
    .catch((error: unknown) => {
      replace(
        root,
        el(
          'div',
          { class: 'home' },
          el('div', { class: 'errbox', style: { 'max-width': '620px', margin: '60px auto' } }, el('strong', { text: 'The workbench could not start' }), el('div', { text: errorText(error) })),
        ),
      );
      toast(errorText(error), 'err');
    });
}
