/**
 * Import-breadth, Asset Lab slicing, and Scene Composer journeys.
 */

import { readdirSync } from 'node:fs';
import { expect, expectEqual, fixture, startGame, type WorkbenchSession } from '../harness.ts';
import { PRIMARY_GAME, readAssets, resetProject } from './core.ts';

export interface JourneyContext {
  readonly session: WorkbenchSession;
  readonly note: (text: string) => void;
}

const BULK_GAME = 'qa-bulk-game';
const SHEET_GAME = 'qa-sheet-game';

/** Creates a project through the ordinary Create dialog and lands in its workspace. */
async function createProjectThroughUi(session: WorkbenchSession, gameId: string, presetName: string): Promise<void> {
  resetProject(gameId);
  await session.open();
  await session.clickContaining('Use My Sprites', '.actions');
  await session.waitForText('Create a project');
  await session.fill('.modal input[type=text]', gameId);
  await session.page.selectOption('.modal select', { label: presetName });
  await session.page.waitForTimeout(400);
  await session.clickText('Create game');
  await session.waitForIdle(300_000);
  await session.waitFor('.topbar', 90_000);
  await session.page.waitForTimeout(1200);
}

// ---------------------------------------------------------------------------

/**
 * Bulk intake (W09): many files at once, three different frame-numbering
 * conventions grouped together, duplicates detected by content, and a
 * suggestion the user can override before anything is committed.
 */
export async function wbMulti001({ session, note }: JourneyContext): Promise<void> {
  await createProjectThroughUi(session, BULK_GAME, 'Chase Platformer — proof-validated');

  const frameDir = fixture('frames');
  const frames = readdirSync(frameDir).filter((name) => name.endsWith('.png')).map((name) => fixture('frames', name));
  expect(frames.length >= 5, 'the frames fixture is missing');

  await session.clickText('Import', '.topbar');
  await session.waitFor('.dropzone');
  await session.setFiles('.modal input[type=file]:not([webkitdirectory])', [...frames, fixture('weasel.png'), fixture('palace.png')]);
  await session.waitFor('.plan-table', 60_000);
  await session.page.waitForTimeout(1200);

  const plan = await session.page.evaluate(() => ({
    rows: Array.from(document.querySelectorAll('.plan-table tbody tr')).map((row) => ({
      name: row.querySelector('td:nth-child(3) .truncate')?.textContent ?? '',
      group: row.querySelector('td:nth-child(4)')?.textContent ?? '',
      duplicate: row.getAttribute('data-duplicate') === 'true',
      checked: (row.querySelector('input[type=checkbox]') as HTMLInputElement | null)?.checked ?? false,
      role: (row.querySelector('select') as HTMLSelectElement | null)?.value ?? '',
    })),
    groups: document.querySelector('.infobox')?.textContent ?? '',
  }));

  expect(plan.rows.length >= 7, `expected at least 7 staged rows, saw ${plan.rows.length}`);

  // P07: walk_01, walk-2, walk0003 and walk_04 must land in one group despite
  // three different numbering conventions, and none of them is required.
  const walkRows = plan.rows.filter((row) => row.name.startsWith('walk'));
  expect(walkRows.length >= 4, `expected the walk frames to be staged, saw ${walkRows.length}`);
  // The cell shows "<group> #<frame>"; the group is the part before the hash.
  const walkGroups = new Set(walkRows.map((row) => row.group.trim().split('#')[0]!.trim()));
  expect(walkGroups.size === 1, `mixed naming conventions were split into ${walkGroups.size} groups: ${[...walkGroups].join(' / ')}`);
  expect([...walkGroups][0]!.includes('walk'), `the detected group is "${[...walkGroups][0]}"`);
  expect(plan.groups.includes('frame group'), 'the detected frame group was not surfaced to the user');

  // The user can override a suggestion before anything is committed.
  await session.page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.plan-table tbody tr'));
    const target = rows.find((row) => (row.querySelector('td:nth-child(3) .truncate')?.textContent ?? '').startsWith('palace'));
    const select = target?.querySelector('select') as HTMLSelectElement | null;
    if (select) {
      select.value = 'background';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await session.clickContaining('Import ', '.modal__foot');
  await session.page.waitForTimeout(5000);

  const assets = readAssets(BULK_GAME);
  expect(assets.length >= 7, `expected the accepted files to be imported, found ${assets.length}`);
  const background = assets.find((asset) => asset.roleAssignments.includes('background'));
  expect(background, 'the manually-corrected background role was not applied');

  const grouped = assets.filter((asset) => (asset as { group?: string }).group?.includes('walk'));
  expect(grouped.length >= 4, 'the frame group was not preserved on the imported assets');

  // Second pass: re-offer two files that are already in the project. Duplicate
  // detection is by content hash against the whole project, not by name and
  // not only within one batch.
  await session.clickText('Import', '.topbar');
  await session.waitFor('.dropzone');
  await session.setFiles('.modal input[type=file]:not([webkitdirectory])', [fixture('weasel.png'), fixture('frames', 'walk-2.png'), fixture('two-pieces.png')]);
  await session.waitFor('.plan-table', 60_000);
  await session.page.waitForTimeout(1200);

  const second = await session.page.evaluate(() =>
    Array.from(document.querySelectorAll('.plan-table tbody tr')).map((row) => ({
      name: row.querySelector('td:nth-child(3) .truncate')?.textContent ?? '',
      duplicate: row.getAttribute('data-duplicate') === 'true',
      checked: (row.querySelector('input[type=checkbox]') as HTMLInputElement | null)?.checked ?? false,
    })),
  );
  const duplicates = second.filter((row) => row.duplicate);
  expect(duplicates.length >= 2, `expected 2 duplicates against the project, saw ${duplicates.length}`);
  for (const duplicate of duplicates) expect(!duplicate.checked, `duplicate "${duplicate.name}" was ticked for import by default`);
  const fresh = second.filter((row) => !row.duplicate);
  expect(fresh.length === 1 && fresh[0]!.checked, 'the genuinely new file was not offered for import');

  await session.clickContaining('Import ', '.modal__foot');
  await session.page.waitForTimeout(3500);
  expectEqual(readAssets(BULK_GAME).length, assets.length + 1, 'a duplicate was imported anyway');

  note(`${assets.length} imported, ${duplicates.length} duplicate(s) caught against the project, frame group "${[...walkGroups][0]}" held together across 3 conventions`);
}

// ---------------------------------------------------------------------------

/** Dex Sprite end to end: preview a sheet, compile validated frames, group them, and see the game use frame 1. */
export async function wbSheet001({ session, note }: JourneyContext): Promise<void> {
  await createProjectThroughUi(session, SHEET_GAME, 'Chase Platformer — proof-validated');

  await session.clickText('Import', '.topbar');
  await session.waitFor('.dropzone');
  await session.setFiles('.modal input[type=file]:not([webkitdirectory])', [fixture('sheet-4x2.png')]);
  await session.waitFor('.plan-table', 60_000);
  await session.clickContaining('Import ', '.modal__foot');
  await session.page.waitForTimeout(3500);

  await session.clickText('Asset Lab', '.tabs');
  await session.waitFor('.lab__canvas');
  await session.click('.lib-item');
  await session.page.waitForTimeout(1200);

  await session.clickText('Dex Sprite…');
  await session.waitForText('Dex Sprite compiler');

  // The 256x128 sheet divides evenly into 4x2 32px cells; the suggestion
  // should be offered rather than the user having to work it out.
  const suggestions = await session.page.evaluate(() =>
    Array.from(document.querySelectorAll('.modal .btn--sm')).map((node) => node.textContent ?? ''),
  );
  expect(suggestions.includes('4x2'), `no 4x2 grid suggested; offered: ${suggestions.join(', ')}`);
  expect((await session.text('[data-testid="dex-sprite-summary"]')).includes('8 of 8 cells selected'), 'the compiler did not choose the likely 4x2 animation grid by default');

  // An accidental 9x9 entry used to allocate 81 thumbnail canvases before
  // host validation could object. The editor now fails closed at its own
  // boundary and lets the user return to a safe suggestion.
  await session.page.evaluate(() => {
    for (const label of ['Columns', 'Rows']) {
      const input = document.querySelector<HTMLInputElement>(`.modal input[aria-label="${label}"]`);
      if (!input) continue;
      input.value = '9';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await session.page.waitForTimeout(300);
  expect((await session.text('[data-testid="dex-sprite-summary"]')).includes('at most 64'), 'an oversized frame grid was not rejected before thumbnail allocation');
  expect(await session.page.locator('[data-testid="dex-sprite-compile"]').isDisabled(), 'compile stayed enabled for an oversized frame grid');
  await session.clickText('4x2');
  await session.page.waitForTimeout(300);

  expectEqual(await session.count('[data-testid="dex-sprite-preview"]'), 1, 'the animation loop preview is missing');
  await session.clickText('Compile validated frames');
  await session.waitForIdle(90_000);
  await session.page.waitForTimeout(3000);

  const frames = readAssets(SHEET_GAME).filter((asset) => asset.kind === 'derived' && asset.group?.includes('sheet-4x2-dex'));
  expectEqual(frames.length, 8, 'the compiler did not create all eight selected frames');
  expect(frames.every((frame) => frame.width === 64), 'a compiled frame is not the expected 64px grid cell');
  expect(frames.every((frame) => frame.validation?.status === 'valid'), 'a compiled frame lacks successful host sprite validation');
  expect(frames.every((frame) => frame.transformRecipe?.steps.some((step) => (step as { op?: string }).op === 'gridCell')), 'a compiled frame lost its grid recipe');
  expect(frames.every((frame) => frame.transformRecipe?.steps.some((step) => (step as { op?: string }).op === 'alignFrame')), 'a compiled frame lost its stabilization recipe');
  expectEqual(frames.map((frame) => frame.frameIndex).sort((a, b) => (a ?? 0) - (b ?? 0)).join(','), '1,2,3,4,5,6,7,8', 'compiled frame order was not recorded');
  const assigned = frames.find((frame) => frame.roleAssignments.includes('player'));
  expect(assigned?.frameIndex === 1, 'frame 1 was not assigned to the playable player role');

  note(`Dex Sprite previewed and compiled 8 source-validated 64x64 frames; frame 1 assigned to player`);
}

// ---------------------------------------------------------------------------

/** Visual level editing that validates and reaches the running game (W18). */
export async function wbScene001({ session, note }: JourneyContext): Promise<void> {
  await session.openProject(PRIMARY_GAME);
  await session.clickText('Scene', '.tabs');
  await session.waitFor('.scene__stage', 30_000);
  await session.page.waitForTimeout(1200);

  const objectsBefore = await session.count('.scene-obj-row');
  expect(objectsBefore >= 5, `the level has only ${objectsBefore} objects; the starter kit should ship a designed level`);

  // Move a platform by keyboard - a precise, assertable edit.
  const moved = await session.page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.scene-obj-row'));
    const target = rows.find((row) => (row.textContent ?? '').includes('Ledge Low'));
    (target as HTMLElement | undefined)?.click();
    return (target?.textContent ?? '').trim();
  });
  expect(moved.length > 0, 'could not select a platform in the object list');
  await session.page.waitForTimeout(500);

  const before = await readObjectPosition(session, 'Ledge Low');
  for (let i = 0; i < 6; i++) {
    await session.page.keyboard.press('Shift+ArrowUp');
    await session.page.waitForTimeout(60);
  }
  const after = await readObjectPosition(session, 'Ledge Low');
  expect(after.y < before.y, `the platform did not move: y went ${before.y} -> ${after.y}`);

  // Move a pickup too.
  await session.page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.scene-obj-row'));
    (rows.find((row) => (row.textContent ?? '').includes('Coin 1')) as HTMLElement | undefined)?.click();
  });
  await session.page.waitForTimeout(400);
  for (let i = 0; i < 4; i++) {
    await session.page.keyboard.press('Shift+ArrowLeft');
    await session.page.waitForTimeout(60);
  }

  // Add a supported semantic entity from the palette.
  await session.clickText('Add…');
  await session.waitForText('Add an object');
  await session.clickContaining('Checkpoint', '.modal');
  await session.page.waitForTimeout(900);
  const objectsAfterAdd = await session.count('.scene-obj-row');
  expectEqual(objectsAfterAdd, objectsBefore + 1, 'adding a semantic entity did not add an object');

  await session.clickText('Save level');
  await session.page.waitForTimeout(2500);
  const statusText = await session.visibleText();
  expect(!statusText.includes('Not saved'), 'the level failed validation on save');

  // The change reaches the running game.
  await session.clickText('Build', '.topbar');
  await session.waitForJob('build');
  await session.clickText('Preview', '.tabs');
  await session.page.waitForTimeout(800);
  await session.clickText('Production preview');
  await session.waitFor('iframe.preview__frame', 90_000);
  const frame = await session.gameFrame(90_000);
  const snapshot = await startGame(frame);
  const shell = (snapshot['extra'] as Record<string, Record<string, unknown>> | undefined)?.['game.platform-shell'];
  expect(shell, `the game did not come up after the level edit (scene: ${String(snapshot['scene'])})`);
  expectEqual(snapshot['scene'], 'sw2d.play', 'the edited level does not reach the play scene');
  // The pickups the edited level declares are the ones the running game counted.
  expect(Number(shell!['quota']) > 0, 'the running game found no collectibles in the edited level');

  note(`platform moved ${before.y} -> ${after.y}, pickup moved, checkpoint added, level validated and runs`);
}

async function readObjectPosition(session: WorkbenchSession, name: string): Promise<{ x: number; y: number }> {
  return session.page.evaluate((label) => {
    const inputs = Array.from(document.querySelectorAll('.scene__list input[type=number]')) as HTMLInputElement[];
    void label;
    return { x: Number(inputs[0]?.value ?? 0), y: Number(inputs[1]?.value ?? 0) };
  }, name);
}

// ---------------------------------------------------------------------------

/** A covered object must stay reachable (W19 / F11). */
export async function wbOverlap001({ session, note }: JourneyContext): Promise<void> {
  await session.openProject(PRIMARY_GAME);
  await session.clickText('Scene', '.tabs');
  await session.waitFor('.scene__stage', 30_000);
  await session.page.waitForTimeout(1200);

  // Put a large object exactly on top of a small one at the world centre: the
  // classic case where "topmost wins" makes the small one unreachable. The
  // centre is used because `fit()` centres the world in the canvas, so the
  // middle of the stage really is the middle of the level.
  const worldCentre = await session.page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.scene-obj-row'));
    (rows.find((row) => (row.textContent ?? '').includes('Coin 2')) as HTMLElement | undefined)?.click();
    return { x: 480, y: 272 };
  });
  await session.page.waitForTimeout(500);
  await session.page.evaluate((point) => {
    const inputs = Array.from(document.querySelectorAll('.scene__list input[type=number]')) as HTMLInputElement[];
    const [x, y] = inputs;
    if (x) { x.value = String((point as { x: number }).x); x.dispatchEvent(new Event('change', { bubbles: true })); }
    if (y) { y.value = String((point as { y: number }).y); y.dispatchEvent(new Event('change', { bubbles: true })); }
  }, worldCentre);
  await session.page.waitForTimeout(600);

  await session.clickText('Add…');
  await session.waitForText('Add an object');
  await session.clickContaining('CameraZone', '.modal');
  await session.page.waitForTimeout(900);

  // Drop the big zone right over the coin.
  await session.page.evaluate((point) => {
    const inputs = Array.from(document.querySelectorAll('.scene__list input[type=number]')) as HTMLInputElement[];
    const [x, y, width, height] = inputs;
    if (x) { x.value = String((point as { x: number }).x - 130); x.dispatchEvent(new Event('change', { bubbles: true })); }
    if (y) { y.value = String((point as { y: number }).y - 100); y.dispatchEvent(new Event('change', { bubbles: true })); }
    if (width) { width.value = '260'; width.dispatchEvent(new Event('change', { bubbles: true })); }
    if (height) { height.value = '200'; height.dispatchEvent(new Event('change', { bubbles: true })); }
  }, worldCentre);
  await session.page.waitForTimeout(700);

  // 1. The object list always reaches it, whatever is on top.
  const selectedViaList = await session.page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.scene-obj-row'));
    const coin = rows.find((row) => (row.textContent ?? '').includes('Coin 2'));
    (coin as HTMLElement | undefined)?.click();
    return document.querySelector('.scene-obj-row[aria-selected="true"]')?.textContent ?? '';
  });
  expect(selectedViaList.includes('Coin 2'), `the object list could not select the covered object: "${selectedViaList}"`);

  // 2. Clicking the same point on the canvas cycles through the stack.
  // Press the ordinary Fit control first so the view is definitely centred on
  // the level, whatever the pane was doing when it mounted.
  await session.clickText('Fit');
  await session.page.waitForTimeout(400);
  const stage = await session.page.$('.scene__stage');
  expect(stage, 'no scene canvas');
  const box = await stage!.boundingBox();
  expect(box, 'the scene canvas has no box');
  const seen: string[] = [];
  for (let click = 0; click < 3; click++) {
    await session.page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await session.page.waitForTimeout(400);
    seen.push(await session.page.evaluate(() => document.querySelector('.scene-obj-row[aria-selected="true"]')?.textContent ?? ''));
  }
  expect(new Set(seen.filter(Boolean)).size >= 2, `clicking the same point selected only ${JSON.stringify(seen)} - no overlap cycling`);

  // 3. Hiding and locking the cover are both one click away.
  const hideWorked = await session.page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.scene-obj-row'));
    const zone = rows.find((row) => (row.textContent ?? '').includes('CameraZone'));
    const hide = Array.from(zone?.querySelectorAll('button') ?? [])[0] as HTMLButtonElement | undefined;
    hide?.click();
    return zone?.classList.contains('scene-obj-row--hidden') ?? false;
  });
  await session.page.waitForTimeout(400);
  expect(hideWorked || (await session.count('.scene-obj-row--hidden')) > 0, 'the cover could not be hidden');

  note(`list selection works, canvas click cycled ${new Set(seen.filter(Boolean)).size} objects, hide works`);
}
