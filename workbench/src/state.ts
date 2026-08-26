/**
 * The workbench's application state.
 *
 * A ~90-line store: one object, one set of listeners, one `update`. It exists
 * because rendering needs a single source of truth, not because the app needs
 * a state library - anything larger would be more machinery than the problem
 * has.
 */

import type {
  AssetRecord,
  BlueprintDocument,
  GameSeed,
  JobView,
  PanelState,
  PreviewState,
  ProjectDocument,
  ProjectSummary,
  WorkbenchAssetRole,
} from '../shared/types.ts';
import { DEFAULT_PANEL_STATE } from '../shared/types.ts';

export interface PresetSummary {
  readonly id: string;
  readonly displayName: string;
  readonly family: string;
  readonly maturity: string;
  readonly controllerFamilies: readonly string[];
  readonly inputModes: readonly string[];
  readonly requiredPackIds: readonly string[];
  readonly requiredContentRoles: readonly string[];
  readonly knownLimitations: readonly string[];
  readonly starterKitDepth: string;
}

export interface ProjectPresetInfo {
  readonly id: string;
  readonly displayName: string;
  readonly family: string;
  readonly maturity: string;
  readonly knownLimitations: readonly string[];
  readonly controllerFamilies: readonly string[];
  readonly inputModes: readonly string[];
  readonly starterKitDepth: string;
}

export interface ProjectState {
  readonly project: ProjectDocument;
  readonly preset: ProjectPresetInfo | null;
  readonly assets: readonly AssetRecord[];
  readonly blueprint: BlueprintDocument;
  readonly summary: ProjectSummary;
  readonly levels: readonly string[];
  readonly synthesizableRoles: readonly WorkbenchAssetRole[];
  readonly kitUsefulRoles: readonly string[];
  readonly preview: PreviewState | null;
}

export type Route = 'home' | 'workspace' | 'presets';

export interface AppState {
  readonly route: Route;
  readonly booted: boolean;
  readonly projects: readonly ProjectSummary[];
  readonly presets: readonly PresetSummary[];
  readonly current: ProjectState | null;
  readonly selectedAssetId: string | null;
  readonly jobs: readonly JobView[];
  readonly activityOpen: boolean;
  readonly seeds: readonly GameSeed[];
  readonly panels: PanelState;
  readonly mobilePane: 'library' | 'center' | 'inspector';
  readonly busy: string | null;
}

const INITIAL: AppState = {
  route: 'home',
  booted: false,
  projects: [],
  presets: [],
  current: null,
  selectedAssetId: null,
  jobs: [],
  activityOpen: false,
  seeds: [],
  panels: DEFAULT_PANEL_STATE,
  mobilePane: 'center',
  busy: null,
};

type Listener = (state: AppState) => void;

let state: AppState = INITIAL;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function update(patch: Partial<AppState>): AppState {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Convenience: the currently selected asset record, or null. */
export function selectedAsset(): AssetRecord | null {
  if (!state.current || !state.selectedAssetId) return null;
  return state.current.assets.find((asset) => asset.id === state.selectedAssetId) ?? null;
}

export function assetById(id: string | null): AssetRecord | null {
  if (!state.current || !id) return null;
  return state.current.assets.find((asset) => asset.id === id) ?? null;
}

/** True while any job is still running - drives the status bar dot and disables destructive actions. */
export function anyJobRunning(): boolean {
  return state.jobs.some((job) => job.status === 'running' || job.status === 'queued');
}

export function latestJob(): JobView | null {
  return state.jobs[0] ?? null;
}
