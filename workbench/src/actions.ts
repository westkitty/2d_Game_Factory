/**
 * Everything the UI can *do*, in one place.
 *
 * Views render and dispatch; they never talk to the API directly. That keeps
 * the "a role change must actually change the game" rule enforceable in one
 * spot rather than remembered in five.
 */

import * as api from './api.ts';
import { getState, update, type ProjectState, type PresetSummary } from './state.ts';
import { toast } from './dom.ts';
import type { GameSeed, JobView, PanelState, PreviewState, ProjectSummary, WorkbenchAssetRole } from '../shared/types.ts';

let jobPollTimer = 0;

export async function boot(): Promise<void> {
  const [{ projects }, { presets }] = await Promise.all([
    api.get<{ projects: readonly ProjectSummary[] }>('/projects'),
    api.get<{ presets: readonly PresetSummary[] }>('/presets'),
  ]);
  update({ projects, presets, booted: true });
  startJobPolling();
}

/**
 * Polls job state.
 *
 * Adaptive rather than fixed: a second while something is running, six when
 * nothing is. A permanent 1 Hz poll on an idle workbench is wasted work on a
 * machine this product has promised to be considerate of.
 */
function startJobPolling(): void {
  const tick = async (): Promise<void> => {
    try {
      const { jobs } = await api.get<{ jobs: readonly JobView[] }>('/jobs');
      const wasRunning = getState().jobs.some((job) => job.status === 'running' || job.status === 'queued');
      update({ jobs });
      const running = jobs.some((job) => job.status === 'running' || job.status === 'queued');
      if (wasRunning && !running) await refreshCurrent();
      window.clearTimeout(jobPollTimer);
      jobPollTimer = window.setTimeout(() => void tick(), running ? 900 : 6000);
    } catch {
      window.clearTimeout(jobPollTimer);
      jobPollTimer = window.setTimeout(() => void tick(), 6000);
    }
  };
  void tick();
}

export async function refreshProjects(): Promise<void> {
  const { projects } = await api.get<{ projects: readonly ProjectSummary[] }>('/projects');
  update({ projects });
}

export async function refreshCurrent(): Promise<void> {
  const { current } = getState();
  if (!current) return;
  try {
    const state = await api.get<ProjectState>('/projects/state', { gameId: current.project.gameId });
    update({ current: state, panels: state.project.panels });
  } catch {
    // A project deleted from under us should not wedge the UI on a stale view.
    update({ current: null, route: 'home' });
  }
}

export async function openProject(gameId: string): Promise<void> {
  update({ busy: `Opening ${gameId}…` });
  try {
    const state = await api.post<ProjectState>('/projects/open', { gameId });
    update({
      current: state,
      panels: state.project.panels,
      route: 'workspace',
      selectedAssetId: state.assets[0]?.id ?? null,
      seeds: [],
      busy: null,
    });
  } catch (error) {
    update({ busy: null });
    toast(errorText(error), 'err');
  }
}

export function goHome(): void {
  update({ route: 'home', current: null, selectedAssetId: null, seeds: [], busy: null });
  void refreshProjects();
}

export function goPresets(): void {
  update({ route: 'presets' });
}

/** Waits for a job to reach a terminal state, surfacing its step in the status bar as it goes. */
export async function awaitJob(jobId: string, label: string): Promise<JobView> {
  for (;;) {
    const { job } = await api.get<{ job: JobView }>('/jobs/one', { id: jobId });
    update({ jobs: [job, ...getState().jobs.filter((existing) => existing.id !== job.id)], busy: `${label}: ${job.step}` });
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      update({ busy: null });
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
}

export async function createProject(input: {
  gameId: string;
  presetId: string;
  displayName?: string;
  useStarterKit?: boolean;
}): Promise<boolean> {
  try {
    const { jobId } = await api.post<{ jobId: string }>('/projects/create', input);
    update({ activityOpen: true });
    const job = await awaitJob(jobId, 'Creating game');
    if (job.status !== 'completed') {
      toast(job.error ?? 'Game creation did not complete.', 'err');
      return false;
    }
    await refreshProjects();
    await openProject(input.gameId);
    toast(`Created "${input.gameId}".`, 'ok');
    return true;
  } catch (error) {
    toast(errorText(error), 'err');
    return false;
  }
}

export async function assignRole(role: WorkbenchAssetRole, assetId: string | null): Promise<void> {
  const { current } = getState();
  if (!current) return;
  try {
    const result = await api.post<{ state: ProjectState }>('/assets/role', { gameId: current.project.gameId, role, assetId });
    update({ current: result.state });
    // The theme was rewritten host-side as part of that call, so this is a
    // real change to what the game draws, not a label.
    toast(assetId ? `${role} now uses your asset.` : `${role} reverted to generated art.`, 'ok');
  } catch (error) {
    toast(errorText(error), 'err');
  }
}

export async function setProvenance(assetId: string, provenance: unknown): Promise<void> {
  const { current } = getState();
  if (!current) return;
  try {
    const result = await api.post<{ state: ProjectState }>('/assets/provenance', { gameId: current.project.gameId, assetId, provenance });
    update({ current: result.state });
  } catch (error) {
    toast(errorText(error), 'err');
  }
}

export async function renameAsset(assetId: string, displayName: string): Promise<void> {
  const { current } = getState();
  if (!current) return;
  const result = await api.post<{ state: ProjectState }>('/assets/rename', { gameId: current.project.gameId, assetId, displayName });
  update({ current: result.state });
}

export async function deleteAsset(assetId: string): Promise<void> {
  const { current } = getState();
  if (!current) return;
  try {
    const result = await api.post<{ state: ProjectState }>('/assets/delete', { gameId: current.project.gameId, assetId });
    update({ current: result.state, selectedAssetId: result.state.assets[0]?.id ?? null });
  } catch (error) {
    toast(errorText(error), 'err');
  }
}

export async function loadSeeds(mode?: string): Promise<void> {
  const { current } = getState();
  if (!current) return;
  const { seeds } = await api.post<{ seeds: readonly GameSeed[] }>('/seeds', {
    gameId: current.project.gameId,
    ...(mode ? { mode } : {}),
  });
  update({ seeds });
}

export async function synthesizeTheme(): Promise<void> {
  const { current } = getState();
  if (!current) return;
  try {
    const result = await api.post<{ state: ProjectState }>('/theme/synthesize', { gameId: current.project.gameId });
    update({ current: result.state });
  } catch (error) {
    toast(errorText(error), 'err');
  }
}

export async function startPreview(mode: 'fast' | 'production'): Promise<PreviewState | null> {
  const { current } = getState();
  if (!current) return null;
  update({ busy: `Starting ${mode} preview…` });
  try {
    const { preview } = await api.post<{ preview: PreviewState }>('/preview/start', { gameId: current.project.gameId, mode });
    update({ current: { ...current, preview }, busy: null });
    return preview;
  } catch (error) {
    update({ busy: null });
    toast(errorText(error), 'err');
    return null;
  }
}

export async function stopPreview(): Promise<void> {
  const { current } = getState();
  if (!current) return;
  await api.post('/preview/stop', { gameId: current.project.gameId });
  update({ current: { ...current, preview: null } });
}

export async function runPipeline(step: 'validate' | 'build' | 'pack'): Promise<JobView | null> {
  const { current } = getState();
  if (!current) return null;
  try {
    const { jobId } = await api.post<{ jobId: string }>(`/pipeline/${step}`, { gameId: current.project.gameId });
    update({ activityOpen: true });
    const job = await awaitJob(jobId, step[0]!.toUpperCase() + step.slice(1));
    if (job.status === 'completed') {
      const outcome = job.result as { ok?: boolean } | undefined;
      if (outcome?.ok) toast(`${step} succeeded.`, 'ok');
      else toast(`${step} reported failures - see Activity.`, 'warn');
    } else if (job.status === 'cancelled') {
      toast(`${step} cancelled.`, 'warn');
    } else {
      toast(job.error ?? `${step} failed.`, 'err');
    }
    await refreshCurrent();
    return job;
  } catch (error) {
    toast(errorText(error), 'err');
    return null;
  }
}

export async function cancelJob(id: string): Promise<void> {
  const { cancelled } = await api.post<{ cancelled: boolean }>('/jobs/cancel', { id });
  if (!cancelled) toast('That job can no longer be cancelled.', 'warn');
}

export async function reveal(what: 'dist' | 'pack' | 'project'): Promise<void> {
  const { current } = getState();
  if (!current) return;
  try {
    await api.post('/reveal', { gameId: current.project.gameId, what });
  } catch (error) {
    toast(errorText(error), 'err');
  }
}

let panelSaveTimer = 0;

/** Panel geometry is persisted, debounced - dragging a splitter should not be a write per pixel. */
export function savePanels(panels: Partial<PanelState>): void {
  const next = { ...getState().panels, ...panels };
  update({ panels: next });
  const { current } = getState();
  if (!current) return;
  window.clearTimeout(panelSaveTimer);
  panelSaveTimer = window.setTimeout(() => {
    void api.post('/projects/panels', { gameId: current.project.gameId, panels: next }).catch(() => {
      /* panel geometry is a convenience; failing to persist it is not worth interrupting the user */
    });
  }, 400);
}

export function errorText(error: unknown): string {
  if (error instanceof api.ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
