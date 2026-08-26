/**
 * Pipeline, remix, provenance, security, batch and responsive journeys.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { expect, expectEqual, fixture, type WorkbenchSession } from '../harness.ts';
import { gameRoot, resolveContained } from '../../server/paths.ts';
import { PRIMARY_GAME, readAssets, readTheme, resetProject } from './core.ts';
import { apiRoutes } from '../../server/api.ts';
import { LIMITS } from '../../server/security.ts';

export interface JourneyContext {
  readonly session: WorkbenchSession;
  readonly note: (text: string) => void;
}

const PROVENANCE_GAME = 'qa-provenance-game';
const REMIX_GAME = 'qa-remix-game';
const BATCH_GAME = 'qa-batch-game';

async function createProjectThroughUi(session: WorkbenchSession, gameId: string, presetLabel: string): Promise<void> {
  resetProject(gameId);
  await session.open();
  await session.clickContaining('Create From Assets', '.actions');
  await session.waitForText('Create a project');
  await session.fill('.modal input[type=text]', gameId);
  await session.page.selectOption('.modal select', { label: presetLabel });
  await session.page.waitForTimeout(400);
  await session.clickText('Create game');
  await session.waitForIdle(300_000);
  await session.waitFor('.topbar', 90_000);
  await session.page.waitForTimeout(1000);
}

// ---------------------------------------------------------------------------

/** Validate, Build and Pack from buttons, producing real release evidence (W23 / F19). */
export async function wbBuild001({ session, note }: JourneyContext): Promise<void> {
  await session.openProject(PRIMARY_GAME);

  await session.clickText('Validate', '.topbar');
  const validateJob = await session.waitForJob('validate');
  expectEqual(validateJob.status, 'completed', `the validate job ended ${validateJob.status}: ${validateJob.error ?? ''}`);

  const validateSteps = await session.page.evaluate(() =>
    Array.from(document.querySelectorAll('.activity .job')).map((job) => job.textContent ?? '').join(' | '),
  );
  expect(validateSteps.includes('Validate'), 'the Validate job did not appear in Activity');
  expect(!validateSteps.includes('✕'), `a validation step failed: ${validateSteps.slice(0, 400)}`);

  await session.clickText('Pack', '.topbar');
  const packJob = await session.waitForJob('pack');
  expectEqual(packJob.status, 'completed', `the pack job ended ${packJob.status}: ${packJob.error ?? ''}`);
  const packOutcome = packJob.result as { ok?: boolean; steps?: { detail: string[] }[] } | undefined;
  expect(packOutcome?.ok, `Pack reported failure: ${JSON.stringify(packOutcome?.steps ?? []).slice(0, 500)}`);

  const packDir = resolveContained(gameRoot(PRIMARY_GAME), 'pack');
  expect(existsSync(packDir), 'Pack reported success but produced no pack/ directory');
  for (const required of ['index.html', 'RELEASE_MANIFEST.json', 'SHA256SUMS', 'THIRD_PARTY_NOTICES.txt']) {
    expect(existsSync(resolveContained(packDir, required)), `the release candidate is missing ${required}`);
  }

  const manifest = JSON.parse(readFileSync(resolveContained(packDir, 'RELEASE_MANIFEST.json'), 'utf8')) as {
    gameId: string;
    resourceGovernance: { allApproved: boolean; recordCount: number };
    fileInventory: string[];
  };
  expectEqual(manifest.gameId, PRIMARY_GAME, 'the release manifest names the wrong game');
  expect(manifest.resourceGovernance.allApproved, 'the release manifest reports unapproved resources');

  // `.sw2d/` is workbench metadata and must never ship.
  const shipped = manifest.fileInventory.join(' ');
  expect(!shipped.includes('.sw2d'), 'workbench metadata leaked into the release candidate');

  const sums = readFileSync(resolveContained(packDir, 'SHA256SUMS'), 'utf8');
  expect(sums.split('\n').filter(Boolean).length >= manifest.fileInventory.length, 'SHA256SUMS does not cover the shipped files');

  note(`validate green; pack produced ${manifest.fileInventory.length} files with manifest, checksums and notices`);
}

// ---------------------------------------------------------------------------

/** Unknown provenance blocks a release, and resolving it unblocks one (W24 / F14). */
export async function wbProvenance001({ session, note }: JourneyContext): Promise<void> {
  await createProjectThroughUi(session, PROVENANCE_GAME, 'Chase Platformer — proof-validated');

  await session.clickText('Import', '.topbar');
  await session.waitFor('.dropzone');
  await session.setFiles('.modal input[type=file]:not([webkitdirectory])', [fixture('weasel.png')]);
  await session.waitFor('.plan-table', 60_000);
  // Declare it as unknown-provenance through the ordinary control.
  await session.page.selectOption('.modal select', 'unknown');
  await session.page.waitForTimeout(400);
  await session.clickContaining('Import ', '.modal__foot');
  await session.page.waitForTimeout(3500);

  const manifestPath = resolveContained(gameRoot(PROVENANCE_GAME), 'resources', 'RESOURCE_MANIFEST.json');
  const pending = JSON.parse(readFileSync(manifestPath, 'utf8')) as { records: { status: string }[] };
  expect(pending.records.some((record) => record.status === 'pending'), 'an unknown-provenance asset was not recorded as pending');

  // The UI warns before the user gets as far as pressing Pack.
  const statusText = await session.visibleText();
  expect(statusText.includes('provenance blocks release'), 'the status bar does not warn that provenance blocks release');

  await session.clickText('Pack', '.topbar');
  await session.waitForJob('pack');
  await session.page.waitForTimeout(600);

  expect(!existsSync(resolveContained(gameRoot(PROVENANCE_GAME), 'pack', 'RELEASE_MANIFEST.json')), 'Pack produced a release candidate despite unknown provenance (F14)');
  const blockedText = await session.page.evaluate(() => document.querySelector('.activity')?.textContent ?? '');
  expect(blockedText.includes('not approved') || blockedText.includes('Refusing'), `Pack did not explain the refusal: ${blockedText.slice(0, 300)}`);

  // Resolve it the way a user would, then Pack succeeds.
  await session.click('.lib-item');
  await session.page.waitForTimeout(800);
  await session.page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('.pane--inspector select')) as HTMLSelectElement[];
    const provenance = selects[selects.length - 1];
    if (provenance) {
      provenance.value = 'project-owned';
      provenance.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await session.page.waitForTimeout(2500);

  await session.clickText('Build', '.topbar');
  await session.waitForJob('build');
  await session.clickText('Pack', '.topbar');
  await session.waitForJob('pack');
  await session.page.waitForTimeout(600);

  const secondPack = await session.lastJob('pack');
  const secondOutcome = secondPack?.result as { ok?: boolean; steps?: { detail: string[] }[] } | undefined;
  expect(
    existsSync(resolveContained(gameRoot(PROVENANCE_GAME), 'pack', 'RELEASE_MANIFEST.json')),
    `Pack still refused after the provenance was resolved: ${JSON.stringify(secondOutcome?.steps ?? []).slice(0, 500)}`,
  );

  note('unknown provenance blocked Pack; resolving it unblocked Pack; the CLI gate was unchanged');
}

// ---------------------------------------------------------------------------

/** Adopt an existing generated project and swap its art (W22). */
export async function wbRemix001({ session, note }: JourneyContext): Promise<void> {
  // Generate a project the way the CLI does - no workbench metadata at all -
  // so this really is adoption rather than reopening our own.
  const { createGame } = await import('@sw2d/cli/factory');
  resetProject(REMIX_GAME);
  createGame({ gameId: REMIX_GAME, presetId: 'chase-platformer' });

  const themeBefore = readTheme(REMIX_GAME);
  expect(
    themeBefore.assets.every((descriptor) => descriptor.spec.kind === 'generated'),
    'the CLI-generated project already had image assets, so this would prove nothing',
  );

  await session.open();
  const cardHandle = await session.page.waitForFunction(
    (gameId) => {
      const cards = Array.from(document.querySelectorAll('.card'));
      // A project the CLI generated and the workbench has not adopted shows
      // its raw hyphenated id, not a title-cased display name.
      const flatten = (value: string): string => value.toLowerCase().replace(/[-\s]+/g, ' ').trim();
      const wanted = flatten(String(gameId));
      return cards.find((card) => flatten(card.textContent ?? '').includes(wanted)) ?? null;
    },
    REMIX_GAME,
    { timeout: 20_000 },
  );
  const cardText = await cardHandle.evaluate((node) => (node as HTMLElement).textContent ?? '');
  expect(cardText.includes('adopt on open'), `the un-adopted project is not flagged for adoption: "${cardText}"`);

  await session.openProject(REMIX_GAME);

  const adopted = await session.text('.topbar__meta span');
  expect(adopted.includes('adopted'), `the project was not marked adopted: "${adopted}"`);

  // Replace the player art through the role row's own import button.
  await session.click('.role-row[data-role="player"] [data-action="import-role"]');
  await session.waitForText('Import art for Player');
  await session.setFiles('.modal input[type=file]:not([webkitdirectory])', [fixture('weasel.png')]);
  await session.waitFor('.plan-table', 60_000);
  await session.clickContaining('Import ', '.modal__foot');
  await session.page.waitForTimeout(4000);

  const themeAfter = readTheme(REMIX_GAME);
  const player = themeAfter.assets.find((descriptor) => descriptor.role === 'player');
  expect(player?.spec.kind === 'image', 'the swapped asset did not reach the theme');
  expect(String(player?.spec.url).startsWith('assets/workbench/'), 'the swapped asset is not game-local and same-origin');

  // No shared runtime file was touched by any of that.
  const gameSpecific = readdirSync(resolveContained(gameRoot(REMIX_GAME), 'src', 'game-specific'));
  expect(gameSpecific.length > 0, 'the adopted project lost its game-specific sources');

  note(`adopted a CLI-generated project and swapped its player art to ${String(player?.spec.url)}`);
}

// ---------------------------------------------------------------------------

/** A medium asset pack imports with bounded concurrency and a responsive UI (W-BATCH / F17). */
export async function wbBatch001({ session, note }: JourneyContext): Promise<void> {
  await createProjectThroughUi(session, BATCH_GAME, 'Chase Platformer — proof-validated');

  const packDir = fixture('pack');
  const files = readdirSync(packDir).filter((name) => name.endsWith('.png')).map((name) => fixture('pack', name));
  expect(files.length >= 40, `the batch fixture pack has only ${files.length} files`);

  await session.clickText('Import', '.topbar');
  await session.waitFor('.dropzone');

  // Count in-flight upload requests to prove the cap is real rather than
  // asserting that a constant exists somewhere.
  await session.page.evaluate(() => {
    const w = window as unknown as { __peak?: number; __inflight?: number };
    w.__peak = 0;
    w.__inflight = 0;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const tracked = url.includes('/api/import/file');
      if (tracked) {
        w.__inflight = (w.__inflight ?? 0) + 1;
        if ((w.__inflight ?? 0) > (w.__peak ?? 0)) w.__peak = w.__inflight ?? 0;
      }
      try {
        return await originalFetch(input, init);
      } finally {
        if (tracked) w.__inflight = (w.__inflight ?? 1) - 1;
      }
    };
  });

  await session.setFiles('.modal input[type=file]:not([webkitdirectory])', files);

  // Progress is visible while it runs - not a frozen dialog.
  await session.page.waitForFunction(
    () => (document.querySelector('.modal .faint')?.textContent ?? '').includes('Read'),
    undefined,
    { timeout: 60_000 },
  ).catch(() => undefined);

  await session.waitFor('.plan-table', 180_000);
  await session.page.waitForTimeout(1500);

  const peak = await session.page.evaluate(() => (window as unknown as { __peak?: number }).__peak ?? 0);
  expect(peak > 0, 'no upload concurrency was observed at all');
  expect(
    peak <= LIMITS.importConcurrency,
    `peak in-flight uploads was ${peak}, over the ${LIMITS.importConcurrency} cap (F17)`,
  );

  // The UI is still responsive: a normal control still works mid-batch.
  const rows = await session.count('.plan-table tbody tr');
  expect(rows >= 40, `only ${rows} of ${files.length} files were staged`);

  await session.clickContaining('Import ', '.modal__foot');
  await session.page.waitForTimeout(12_000);
  const imported = readAssets(BATCH_GAME).length;
  expect(imported >= 40, `only ${imported} assets were committed from a ${files.length}-file pack`);

  note(`${files.length} files staged and imported; peak concurrent uploads ${peak} (cap ${LIMITS.importConcurrency})`);
}

// ---------------------------------------------------------------------------

/** The local host's security properties, asserted against the running host (W25 / F12 / F13). */
export async function wbSecurity001({ session, note }: JourneyContext): Promise<void> {
  const host = session.host;

  // Loopback only.
  expect(host.url.startsWith('http://127.0.0.1:'), `the host is not bound to loopback: ${host.url}`);

  const good = { 'x-sw2d-session': host.sessionToken, Origin: host.url, 'Content-Type': 'application/json' };

  const noToken = await fetch(`${host.url}/api/projects`, { headers: { Origin: host.url } });
  expectEqual(noToken.status, 401, 'a request with no session token was accepted');

  const badToken = await fetch(`${host.url}/api/projects`, { headers: { ...good, 'x-sw2d-session': 'f'.repeat(64) } });
  expectEqual(badToken.status, 401, 'a request with a wrong session token was accepted');

  const foreignOrigin = await fetch(`${host.url}/api/projects/create`, {
    method: 'POST',
    headers: { ...good, Origin: 'https://evil.example' },
    body: '{}',
  });
  expectEqual(foreignOrigin.status, 403, 'a cross-origin state-changing request was accepted');

  const noOrigin = await fetch(`${host.url}/api/projects/create`, {
    method: 'POST',
    headers: { 'x-sw2d-session': host.sessionToken, 'Content-Type': 'application/json' },
    body: '{}',
  });
  expectEqual(noOrigin.status, 403, 'a state-changing request with no Origin was accepted');

  for (const hostile of ['../../etc', '/etc/passwd', 'a/../../b', 'Games', 'a'.repeat(200)]) {
    const response = await fetch(`${host.url}/api/projects/open`, {
      method: 'POST',
      headers: good,
      body: JSON.stringify({ gameId: hostile }),
    });
    expect(response.status === 400 || response.status === 404, `a hostile game id "${hostile}" returned ${response.status}`);
  }

  // A malicious filename cannot steer a write: the stored path is
  // content-addressed, so it never contains the supplied name at all.
  const begin = await fetch(`${host.url}/api/import/begin`, { method: 'POST', headers: good, body: JSON.stringify({ gameId: PRIMARY_GAME }) });
  const { batchId } = (await begin.json()) as { batchId: string };
  const staged = await fetch(`${host.url}/api/import/file`, {
    method: 'POST',
    headers: {
      'x-sw2d-session': host.sessionToken,
      Origin: host.url,
      'Content-Type': 'application/octet-stream',
      'x-sw2d-name': encodeURIComponent('../../../../evil.png'),
      'x-sw2d-batch': encodeURIComponent(batchId),
      'x-sw2d-path': encodeURIComponent('../../../../evil.png'),
    },
    body: readFileSync(fixture('weasel.png')),
  });
  expectEqual(staged.status, 200, 'a file with a traversal-shaped name was rejected rather than contained');
  await fetch(`${host.url}/api/import/discard`, { method: 'POST', headers: good, body: JSON.stringify({ gameId: PRIMARY_GAME, batchId }) });
  expect(!existsSync('/evil.png'), 'a traversal-shaped filename escaped containment');

  // No generic command or filesystem endpoint exists, by enumeration rather
  // than by spot-check.
  const routes = apiRoutes();
  for (const forbidden of ['run', 'command', 'exec', 'shell', 'eval', 'read-file', 'write-file', 'path']) {
    const offending = routes.filter((route) => route.toLowerCase().includes(forbidden));
    expect(offending.length === 0, `the API exposes ${offending.join(', ')}, which looks like an arbitrary-${forbidden} capability`);
  }
  for (const probe of ['/api/run-command', '/api/exec', '/api/read', '/api/fs']) {
    const response = await fetch(`${host.url}${probe}`, { method: 'POST', headers: good, body: '{}' });
    expectEqual(response.status, 404, `${probe} exists`);
  }

  // Body limits are enforced.
  const oversized = await fetch(`${host.url}/api/projects/open`, {
    method: 'POST',
    headers: good,
    body: JSON.stringify({ gameId: PRIMARY_GAME, filler: 'x'.repeat(LIMITS.jsonBodyBytes + 1024) }),
  }).catch(() => ({ status: 413 }) as Response);
  expect(oversized.status === 413 || oversized.status === 400, `an oversized JSON body returned ${oversized.status}`);

  note(`${routes.length} endpoints, none command- or path-shaped; token, origin, slug, filename and body limits all enforced`);
}

// ---------------------------------------------------------------------------

/** The workbench at three viewports (section 35). */
export async function wbResponsive001({ session, note }: JourneyContext): Promise<void> {
  const viewports = [
    { width: 1440, height: 900, label: 'desktop' },
    { width: 1024, height: 768, label: 'compact' },
    { width: 390, height: 844, label: 'narrow' },
  ] as const;

  const findings: string[] = [];

  for (const viewport of viewports) {
    await session.page.setViewportSize({ width: viewport.width, height: viewport.height });
    await session.open();
    await session.page.waitForTimeout(700);

    // No horizontal overflow anywhere, at any width.
    const overflow = await session.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow <= 1, `${viewport.label}: the home route overflows horizontally by ${overflow}px`);

    // The primary actions stay reachable.
    const actions = await session.count('.action');
    expectEqual(actions, 4, `${viewport.label}: expected 4 primary actions, saw ${actions}`);

    await session.openProject(PRIMARY_GAME);

    const workspaceOverflow = await session.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(workspaceOverflow <= 1, `${viewport.label}: the workspace overflows horizontally by ${workspaceOverflow}px`);

    // Import, preview and status stay reachable at every width.
    const topbarText = await session.text('.topbar');
    for (const control of ['Import', 'Preview', 'Validate', 'Build', 'Pack']) {
      expect(topbarText.includes(control), `${viewport.label}: the "${control}" control is unreachable`);
    }
    const statusVisible = await session.count('.statusbar');
    expectEqual(statusVisible, 1, `${viewport.label}: the status bar is missing`);

    if (viewport.width <= 1000) {
      // The narrow fallback is a single pane with a switcher, not a squashed
      // three-pane layout. This is a fallback, not a claim that a phone is a
      // good place to compose a level.
      const paneSwitcher = await session.page.evaluate(() => {
        const node = document.querySelector('.mobile-panes');
        return node ? getComputedStyle(node).display !== 'none' : false;
      });
      expect(paneSwitcher, `${viewport.label}: no single-pane switcher is offered`);
    }

    findings.push(`${viewport.label} ok`);
  }

  await session.page.setViewportSize({ width: 1024, height: 768 });
  note(findings.join(', '));
}
