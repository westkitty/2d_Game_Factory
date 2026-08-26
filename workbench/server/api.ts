/**
 * The workbench's HTTP API.
 *
 * Deliberately a small, closed list of named capabilities. There is no
 * endpoint that takes a command to run, and none that takes a filesystem path
 * - every path is derived from a validated game id, asset id or level id
 * inside this file (failure conditions F12 and F13).
 *
 * Handlers are plain functions of a parsed request. Auth, origin checking and
 * body limits happen once, in `host.ts`, before anything here is reached.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import type { BlueprintDocument, PanelState, Provenance, SingleImageMode, WorkbenchAssetRole } from '../shared/types.ts';
import { WORKBENCH_ASSET_ROLES } from '../shared/types.ts';
import { SecurityError, assertValidAssetId, assertValidGameId, isSupportedImageMime } from './security.ts';
import { GAMES_ROOT, gameRoot, repoRelative, resolveContained } from './paths.ts';
import {
  assignRole,
  deleteAsset,
  loadAssets,
  reimportSource,
  rebuildStale,
  setDisplayName,
  setProvenance,
  storeDerived,
} from './assetStore.ts';
import {
  adoptProject,
  hasWorkbenchMetadata,
  listPresetSummaries,
  listProjects,
  loadProject,
  projectExists,
  refreshBlueprint,
  savePanels,
  saveProject,
  summarizeProject,
} from './projectStore.ts';
import { buildPlan, beginBatch, clearStaging, commitImport, discardBatch, stageFile, type ClientAnalysisHints } from './importService.ts';
import { SYNTHESIZABLE_ROLES, writeTheme } from './themeSynthesis.ts';
import { buildSeeds, seedForPreset } from './seeds.ts';
import { loadScene, listLevels, newObject, objectClassOptions, saveScene, SceneValidationError, type SceneDocument } from './sceneStore.ts';
import { buildProject, createProject, packProject, validateProject } from './factoryService.ts';
import { starterKitDepthFor, starterKitFor } from './starterKits/index.ts';
import { JobManager } from './jobManager.ts';
import { applyRebuildResult, currentPreview, listPreviews, nextGeneration, previewModeOf, startFastPreview, startProductionPreview, stopPreview } from './previewManager.ts';
import { getPreset } from '@sw2d/presets';

export const jobs = new JobManager();

export interface ApiRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** Parsed JSON body for `application/json` requests; `undefined` otherwise. */
  readonly json: unknown;
  /** Raw body for binary uploads. */
  readonly body: Uint8Array;
}

export interface ApiResponse {
  readonly status: number;
  readonly json?: unknown;
  readonly bytes?: Uint8Array;
  readonly contentType?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

function ok(json: unknown): ApiResponse {
  return { status: 200, json };
}

// --- small typed readers over an untrusted body ----------------------------

function bodyObject(request: ApiRequest): Record<string, unknown> {
  if (typeof request.json !== 'object' || request.json === null || Array.isArray(request.json)) {
    throw new SecurityError(400, 'Expected a JSON object body.');
  }
  return request.json as Record<string, unknown>;
}

function requiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) throw new SecurityError(400, `Missing or invalid "${key}".`);
  return value;
}

function optionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new SecurityError(400, `Invalid "${key}".`);
  return value;
}

function gameIdOf(request: ApiRequest, source?: Record<string, unknown>): string {
  const raw = source ? source['gameId'] : request.query.get('gameId');
  return assertValidGameId(raw);
}

function roleOf(value: unknown): WorkbenchAssetRole {
  if (typeof value !== 'string' || !(WORKBENCH_ASSET_ROLES as readonly string[]).includes(value)) {
    throw new SecurityError(400, `Unknown asset role ${JSON.stringify(value)}.`);
  }
  return value as WorkbenchAssetRole;
}

const PROVENANCE_KINDS = ['project-owned', 'generated', 'third-party-known', 'unknown', 'reference-only'] as const;

function provenanceOf(value: unknown): Provenance {
  if (typeof value !== 'object' || value === null) throw new SecurityError(400, 'Missing provenance.');
  const source = value as Record<string, unknown>;
  const kind = source['kind'];
  if (typeof kind !== 'string' || !(PROVENANCE_KINDS as readonly string[]).includes(kind)) {
    throw new SecurityError(400, `Unknown provenance kind ${JSON.stringify(kind)}.`);
  }
  const modificationStatus = source['modificationStatus'];
  return {
    kind: kind as Provenance['kind'],
    modificationStatus:
      modificationStatus === 'modified' || modificationStatus === 'generated' ? modificationStatus : 'unmodified',
    ...(typeof source['originalSource'] === 'string' ? { originalSource: source['originalSource'].slice(0, 500) } : {}),
    ...(typeof source['license'] === 'string' ? { license: source['license'].slice(0, 120) } : {}),
    ...(typeof source['attributionRequired'] === 'boolean' ? { attributionRequired: source['attributionRequired'] } : {}),
  };
}

// --- project state ---------------------------------------------------------

function presetSummaries(): ReturnType<typeof listPresetSummaries> {
  return listPresetSummaries((presetId) => {
    try {
      return starterKitDepthFor(presetId, getPreset(presetId).maturity);
    } catch {
      return 'generated-shell';
    }
  });
}

/** Everything the UI needs to render a project in one round trip - opening a project should not be six requests. */
function projectState(gameId: string): unknown {
  const project = loadProject(gameId);
  const assets = loadAssets(gameId);
  const blueprint = refreshBlueprint(gameId);
  const kit = starterKitFor(project.presetId);
  let preset: unknown = null;
  try {
    const definition = getPreset(project.presetId);
    preset = {
      id: definition.id,
      displayName: definition.displayName,
      family: definition.family,
      maturity: definition.maturity,
      knownLimitations: definition.knownLimitations,
      controllerFamilies: definition.controllerFamilies,
      inputModes: definition.supportedInputModes,
      starterKitDepth: starterKitDepthFor(definition.id, definition.maturity),
    };
  } catch {
    preset = null;
  }
  return {
    project,
    preset,
    assets: assets.assets,
    blueprint,
    summary: summarizeProject(gameId),
    levels: listLevels(gameId),
    synthesizableRoles: SYNTHESIZABLE_ROLES,
    kitUsefulRoles: kit?.usefulRoles ?? [],
    preview: currentPreview(gameId),
  };
}

// --- handlers --------------------------------------------------------------

type Handler = (request: ApiRequest) => Promise<ApiResponse> | ApiResponse;

const ROUTES: ReadonlyMap<string, Handler> = new Map<string, Handler>([
  [
    'GET /health',
    () =>
      ok({
        ok: true,
        product: 'SW2D Asset-Driven Game Factory Workbench',
        // Reported so the UI can state it rather than the user having to take
        // it on faith: this host talks to nothing outside this machine.
        network: 'local-only',
        gamesRoot: repoRelative(GAMES_ROOT),
      }),
  ],

  ['GET /presets', () => ok({ presets: presetSummaries() })],

  ['GET /projects', () => ok({ projects: listProjects() })],

  [
    'POST /projects/create',
    (request) => {
      const body = bodyObject(request);
      const gameId = assertValidGameId(body['gameId']);
      const presetId = requiredString(body, 'presetId');
      const displayName = optionalString(body, 'displayName');
      const useStarterKit = body['useStarterKit'] !== false;

      const jobId = jobs.run('create-game', `Create "${gameId}"`, false, async (handle) => {
        handle.setStep('Generating from the canonical factory');
        const result = createProject({ gameId, presetId, ...(displayName !== undefined ? { displayName } : {}), useStarterKit });
        handle.log(`Wrote ${result.fileCount} files (${result.starterKitDepth}).`);
        handle.setStep('Synthesizing theme');
        const blueprint = refreshBlueprint(gameId);
        writeTheme({ gameId, assets: loadAssets(gameId), blueprint });
        handle.setStep('Linking workspace');
        // The freshly-created game must be in the workspace before any build,
        // typecheck or preview can resolve its @sw2d/* imports.
        const { ensureWorkspaceLinked } = await import('./factoryService.ts');
        await ensureWorkspaceLinked(handle);
        return { gameId, starterKitDepth: result.starterKitDepth };
      });
      return ok({ jobId });
    },
  ],

  [
    'POST /projects/open',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      if (!projectExists(gameId)) throw new SecurityError(404, `No project "${gameId}" under games/.`);
      if (!hasWorkbenchMetadata(gameId)) adoptProject(gameId);
      // Staging from a previous session is never useful and is a second copy
      // of the user's art with no owner.
      clearStaging(gameId);
      return ok(projectState(gameId));
    },
  ],

  [
    'POST /projects/adopt',
    (request) => {
      const gameId = gameIdOf(request, bodyObject(request));
      adoptProject(gameId);
      return ok(projectState(gameId));
    },
  ],

  [
    'POST /projects/panels',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const panels = body['panels'];
      if (typeof panels !== 'object' || panels === null) throw new SecurityError(400, 'Missing panel state.');
      return ok({ project: savePanels(gameId, panels as PanelState) });
    },
  ],

  [
    'POST /projects/rename',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const displayName = requiredString(body, 'displayName').slice(0, 80);
      const project = loadProject(gameId);
      saveProject({ ...project, displayName });
      return ok(projectState(gameId));
    },
  ],

  ['GET /projects/state', (request) => ok(projectState(gameIdOf(request)))],

  // --- import ---------------------------------------------------------------

  [
    'POST /import/begin',
    (request) => {
      const gameId = gameIdOf(request, bodyObject(request));
      return ok({ batchId: beginBatch(gameId) });
    },
  ],

  [
    'POST /import/file',
    (request) => {
      const batchId = request.headers['x-sw2d-batch'];
      if (!batchId) throw new SecurityError(400, 'Missing x-sw2d-batch header.');
      const fileName = decodeURIComponent(request.headers['x-sw2d-name'] ?? 'asset');
      const relativePath = decodeURIComponent(request.headers['x-sw2d-path'] ?? fileName);
      let hints: ClientAnalysisHints | undefined;
      const rawHints = request.headers['x-sw2d-hints'];
      if (rawHints) {
        try {
          hints = JSON.parse(decodeURIComponent(rawHints)) as ClientAnalysisHints;
        } catch {
          // Advisory only. A malformed hint header is not worth failing an
          // upload over - the host re-derives everything that matters anyway.
          hints = undefined;
        }
      }
      const result = stageFile({ batchId, bytes: request.body, fileName, relativePath, ...(hints ? { hints } : {}) });
      return ok(result);
    },
  ],

  [
    'GET /import/plan',
    (request) => {
      const gameId = gameIdOf(request);
      const batchId = request.query.get('batchId');
      if (!batchId) throw new SecurityError(400, 'Missing batchId.');
      return ok(buildPlan(gameId, batchId));
    },
  ],

  [
    'POST /import/commit',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const batchId = requiredString(body, 'batchId');
      const rawSelections = body['selections'];
      if (!Array.isArray(rawSelections)) throw new SecurityError(400, 'Missing selections.');
      const selections = rawSelections.map((entry) => {
        const source = entry as Record<string, unknown>;
        const role = source['role'];
        return {
          stagingId: requiredString(source, 'stagingId'),
          ...(role ? { role: roleOf(role) } : {}),
          ...(typeof source['displayName'] === 'string' ? { displayName: source['displayName'] } : {}),
        };
      });
      const result = commitImport({ gameId, batchId, selections, provenance: provenanceOf(body['provenance']) });
      for (const assignment of result.roleAssignments) assignRole(gameId, assignment.role, assignment.assetId);
      const blueprint = refreshBlueprint(gameId);
      // Importing straight into a role has to reach the game, exactly like
      // changing a role later does. Without this the asset would be recorded,
      // the badge would appear, and the running game would still draw the
      // placeholder - which is failure condition F03 in miniature.
      const synthesis = writeTheme({ gameId, assets: loadAssets(gameId), blueprint });
      return ok({ ...result, synthesis: summariseSynthesis(synthesis), state: projectState(gameId) });
    },
  ],

  [
    'POST /import/discard',
    (request) => {
      const body = bodyObject(request);
      discardBatch(gameIdOf(request, body), requiredString(body, 'batchId'));
      return ok({ discarded: true });
    },
  ],

  // --- assets ---------------------------------------------------------------

  ['GET /assets', (request) => ok({ assets: loadAssets(gameIdOf(request)).assets })],

  [
    'GET /assets/bytes',
    (request) => {
      const gameId = gameIdOf(request);
      const assetId = assertValidAssetId(request.query.get('assetId'));
      const asset = loadAssets(gameId).assets.find((candidate) => candidate.id === assetId);
      if (!asset) throw new SecurityError(404, `No asset "${assetId}".`);
      const absolute = resolveContained(gameRoot(gameId), asset.relativePath);
      if (!existsSync(absolute)) throw new SecurityError(404, `"${asset.displayName}" is missing from disk.`);
      if (!isSupportedImageMime(asset.mime)) throw new SecurityError(400, 'Not a servable image.');
      return {
        status: 200,
        bytes: new Uint8Array(readFileSync(absolute)),
        contentType: asset.mime,
        // The bytes are content-addressed by asset id + hash, so a long cache
        // is safe; the id changes when a derivative is rebuilt.
        headers: { 'Cache-Control': 'no-cache', ETag: `"${asset.sha256}"` },
      };
    },
  ],

  [
    'POST /assets/derive',
    (request) => {
      const gameId = assertValidGameId(request.headers['x-sw2d-game']);
      const sourceAssetId = assertValidAssetId(request.headers['x-sw2d-source']);
      const displayName = decodeURIComponent(request.headers['x-sw2d-name'] ?? 'derived.png');
      let recipe: unknown;
      try {
        recipe = JSON.parse(decodeURIComponent(request.headers['x-sw2d-recipe'] ?? '{"version":1,"steps":[]}'));
      } catch {
        throw new SecurityError(400, 'Malformed transform recipe.');
      }
      if (typeof recipe !== 'object' || recipe === null || (recipe as { version?: unknown }).version !== 1) {
        throw new SecurityError(400, 'Unsupported transform recipe version.');
      }
      const { record } = storeDerived({
        gameId,
        sourceAssetId,
        bytes: request.body,
        displayName,
        recipe: recipe as { version: 1; steps: [] },
      });
      return ok({ asset: record, assets: loadAssets(gameId).assets });
    },
  ],

  [
    'POST /assets/reimport',
    (request) => {
      const gameId = assertValidGameId(request.headers['x-sw2d-game']);
      const assetId = assertValidAssetId(request.headers['x-sw2d-asset']);
      const displayName = request.headers['x-sw2d-name'] ? decodeURIComponent(request.headers['x-sw2d-name']) : undefined;
      const result = reimportSource(gameId, assetId, request.body, displayName);
      // Rebuild what the host can (PNG sources); the rest is handed back to
      // the client, which has the decoders the host deliberately does not.
      const rebuild = result.changed ? rebuildStale(gameId, result.staleDerivedIds) : { rebuilt: [], deferredToClient: [] };
      const blueprint = refreshBlueprint(gameId);
      // The theme has to follow the new bytes: its texture key embeds the
      // content hash, and the file shipped into public/ has to be replaced.
      // Without this a reimport would update the library and leave the running
      // game drawing the previous image (F07).
      const synthesis = result.changed ? writeTheme({ gameId, assets: loadAssets(gameId), blueprint }) : null;
      return ok({
        asset: result.record,
        ...(synthesis ? { synthesis: summariseSynthesis(synthesis) } : {}),
        changed: result.changed,
        staleDerivedIds: result.staleDerivedIds,
        rebuiltOnHost: rebuild.rebuilt,
        rebuildInClient: rebuild.deferredToClient,
        state: projectState(gameId),
      });
    },
  ],

  [
    'POST /assets/rebuild',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const rawIds = body['assetIds'];
      if (!Array.isArray(rawIds)) throw new SecurityError(400, 'Missing assetIds.');
      const report = rebuildStale(gameId, rawIds.map((id) => assertValidAssetId(id)));
      return ok({ ...report, assets: loadAssets(gameId).assets });
    },
  ],

  [
    'POST /assets/role',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const role = roleOf(body['role']);
      const rawAssetId = body['assetId'];
      const assetId = rawAssetId === null ? null : assertValidAssetId(rawAssetId);
      assignRole(gameId, role, assetId);
      const blueprint = refreshBlueprint(gameId);
      // A role change that did not reach the game would be a badge, not a
      // feature (section 23), so the theme is rewritten here and now.
      const synthesis = writeTheme({ gameId, assets: loadAssets(gameId), blueprint });
      return ok({ state: projectState(gameId), synthesis: summariseSynthesis(synthesis) });
    },
  ],

  [
    'POST /assets/provenance',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const assetId = assertValidAssetId(body['assetId']);
      setProvenance(gameId, assetId, provenanceOf(body['provenance']));
      const blueprint = refreshBlueprint(gameId);
      writeTheme({ gameId, assets: loadAssets(gameId), blueprint });
      return ok({ state: projectState(gameId) });
    },
  ],

  [
    'POST /assets/rename',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      setDisplayName(gameId, assertValidAssetId(body['assetId']), requiredString(body, 'displayName'));
      // A rename must not disturb anything: identity is the id (P02), and
      // this endpoint exists partly to prove that.
      return ok({ state: projectState(gameId) });
    },
  ],

  [
    'POST /assets/delete',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      deleteAsset(gameId, assertValidAssetId(body['assetId']));
      const blueprint = refreshBlueprint(gameId);
      writeTheme({ gameId, assets: loadAssets(gameId), blueprint });
      return ok({ state: projectState(gameId) });
    },
  ],

  // --- synthesis ------------------------------------------------------------

  [
    'POST /seeds',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const mode = body['mode'];
      const limit = typeof body['limit'] === 'number' ? Math.max(1, Math.min(6, body['limit'])) : 3;
      return ok({
        seeds: buildSeeds({
          assets: loadAssets(gameId),
          ...(typeof mode === 'string' ? { mode: mode as SingleImageMode } : {}),
          limit,
        }),
      });
    },
  ],

  [
    // Seeds for an image that has not been imported anywhere yet - the
    // "Make Something From an Image" flow runs before a project exists, and
    // creating a throwaway project just to ask for a recommendation would
    // leave debris on disk every time someone changed their mind.
    'POST /seeds/preview',
    (request) => {
      const body = bodyObject(request);
      const rawRoles = body['roles'];
      const roles = Array.isArray(rawRoles) ? rawRoles.map((role) => roleOf(role)) : [];
      const rawPalette = body['palette'];
      const palette = Array.isArray(rawPalette)
        ? rawPalette.filter((entry): entry is string => typeof entry === 'string').slice(0, 8)
        : [];
      const mode = body['mode'];
      // A synthetic single-asset document: enough for the coverage heuristic
      // to be truthful about what this image would and would not cover.
      const assets = {
        version: 1 as const,
        assets: roles.map((role, index) => ({
          id: `src_${'0'.repeat(15)}${index.toString(16)}`,
          kind: 'source' as const,
          displayName: 'candidate',
          relativePath: '.sw2d/source-assets/candidate',
          mime: 'image/png',
          width: 1,
          height: 1,
          byteSize: 1,
          sha256: '0'.repeat(64),
          roleAssignments: [role],
          palette,
          provenance: { kind: 'project-owned' as const, modificationStatus: 'unmodified' as const },
        })),
      };
      return ok({
        seeds: buildSeeds({
          assets,
          ...(typeof mode === 'string' ? { mode: mode as SingleImageMode } : {}),
          limit: typeof body['limit'] === 'number' ? Math.max(1, Math.min(6, body['limit'])) : 3,
        }),
      });
    },
  ],

  [
    'POST /seeds/preset',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      return ok({ seed: seedForPreset(requiredString(body, 'presetId'), loadAssets(gameId)) });
    },
  ],

  [
    'POST /theme/synthesize',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const blueprint: BlueprintDocument = refreshBlueprint(gameId);
      const synthesis = writeTheme({ gameId, assets: loadAssets(gameId), blueprint });
      return ok({ synthesis: summariseSynthesis(synthesis), state: projectState(gameId) });
    },
  ],

  // --- scene ----------------------------------------------------------------

  ['GET /scene/classes', () => ok({ classes: objectClassOptions() })],

  [
    'GET /scene',
    (request) => {
      const gameId = gameIdOf(request);
      const levelId = request.query.get('levelId') ?? 'main';
      return ok({ scene: loadScene(gameId, levelId), levels: listLevels(gameId) });
    },
  ],

  [
    'POST /scene',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const scene = body['scene'];
      if (typeof scene !== 'object' || scene === null) throw new SecurityError(400, 'Missing scene document.');
      try {
        const result = saveScene(gameId, scene as SceneDocument);
        return ok({ scene: result.scene, objectCount: result.objectCount });
      } catch (error) {
        if (error instanceof SceneValidationError) throw new SecurityError(422, error.message);
        throw error;
      }
    },
  ],

  [
    'POST /scene/new-object',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const levelId = optionalString(body, 'levelId') ?? 'main';
      const classId = requiredString(body, 'classId');
      const x = typeof body['x'] === 'number' ? body['x'] : 0;
      const y = typeof body['y'] === 'number' ? body['y'] : 0;
      try {
        return ok({ object: newObject(loadScene(gameId, levelId), classId, x, y) });
      } catch (error) {
        if (error instanceof SceneValidationError) throw new SecurityError(422, error.message);
        throw error;
      }
    },
  ],

  // --- preview --------------------------------------------------------------

  [
    'POST /preview/start',
    async (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const mode = previewModeOf(body['mode'] ?? 'fast');
      const state = mode === 'fast' ? await startFastPreview(gameId) : await startProductionPreview(gameId);
      return ok({ preview: state });
    },
  ],

  [
    'POST /preview/stop',
    async (request) => {
      const gameId = gameIdOf(request, bodyObject(request));
      await stopPreview(gameId);
      return ok({ preview: null });
    },
  ],

  [
    'POST /preview/refresh',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const generation = nextGeneration();
      const jobId = jobs.run('preview-rebuild', `Rebuild preview for "${gameId}"`, true, async (handle) => {
        const outcome = await buildProject(gameId, handle);
        // A build that finishes after a newer one has landed is discarded
        // rather than allowed to replace it.
        applyRebuildResult(gameId, generation, outcome.ok ? 'ready' : 'failed', outcome.ok ? undefined : 'Build failed.');
        return outcome;
      });
      return ok({ jobId, generation });
    },
  ],

  ['GET /preview', (request) => ok({ preview: currentPreview(gameIdOf(request)), all: listPreviews() })],

  // --- pipeline -------------------------------------------------------------

  [
    'POST /pipeline/validate',
    (request) => {
      const gameId = gameIdOf(request, bodyObject(request));
      return ok({ jobId: jobs.run('validate', `Validate "${gameId}"`, true, (handle) => validateProject(gameId, handle)) });
    },
  ],

  [
    'POST /pipeline/build',
    (request) => {
      const gameId = gameIdOf(request, bodyObject(request));
      return ok({ jobId: jobs.run('build', `Build "${gameId}"`, true, (handle) => buildProject(gameId, handle)) });
    },
  ],

  [
    'POST /pipeline/pack',
    (request) => {
      const gameId = gameIdOf(request, bodyObject(request));
      return ok({ jobId: jobs.run('pack', `Pack "${gameId}"`, true, (handle) => packProject(gameId, handle)) });
    },
  ],

  // --- jobs -----------------------------------------------------------------

  ['GET /jobs', () => ok({ jobs: jobs.list() })],

  [
    'GET /jobs/one',
    (request) => {
      const id = request.query.get('id');
      if (!id) throw new SecurityError(400, 'Missing job id.');
      const job = jobs.get(id);
      if (!job) throw new SecurityError(404, `No job "${id}".`);
      return ok({ job });
    },
  ],

  [
    'POST /jobs/cancel',
    (request) => {
      const body = bodyObject(request);
      const id = requiredString(body, 'id');
      return ok({ cancelled: jobs.cancel(id) });
    },
  ],

  // --- reveal ---------------------------------------------------------------

  [
    'POST /reveal',
    (request) => {
      const body = bodyObject(request);
      const gameId = gameIdOf(request, body);
      const what = body['what'];
      // A closed set of three literals, not a path. This is the only endpoint
      // that touches the OS shell surface at all, and it cannot be pointed
      // anywhere the workbench did not itself create.
      const relative = what === 'pack' ? 'pack' : what === 'dist' ? 'dist' : '.';
      const target = resolveContained(gameRoot(gameId), relative);
      if (!existsSync(target)) throw new SecurityError(404, `"${relative}" does not exist for "${gameId}" yet.`);
      const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
      spawn(opener, [target], { shell: false, detached: true, stdio: 'ignore' }).unref();
      return ok({ revealed: repoRelative(target) });
    },
  ],
]);

function summariseSynthesis(synthesis: ReturnType<typeof writeTheme>): unknown {
  return {
    imageRoles: synthesis.imageRoles,
    generatedRoles: synthesis.generatedRoles,
    skippedReferenceOnly: synthesis.skippedReferenceOnly,
    assetKeys: synthesis.theme.assets.map((descriptor) => ({ role: descriptor.role, key: descriptor.key, kind: descriptor.spec.kind })),
  };
}

export async function handleApi(request: ApiRequest): Promise<ApiResponse> {
  const handler = ROUTES.get(`${request.method} ${request.path}`);
  if (!handler) return { status: 404, json: { error: `No workbench endpoint ${request.method} ${request.path}.` } };
  try {
    return await handler(request);
  } catch (error) {
    if (error instanceof SecurityError) return { status: error.status, json: { error: error.message } };
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, json: { error: message } };
  }
}

/** The full endpoint list, for the security QA journey to assert against. */
export function apiRoutes(): readonly string[] {
  return [...ROUTES.keys()].sort();
}
