/**
 * The core workbench journeys: boot, the image-first path, seeds, derivation,
 * reimport and persistence.
 *
 * Every one drives normal user-visible controls. Where a journey needs a value
 * only the running game can tell it (a texture key, an object position), it
 * reads the runtime's own debug snapshot from inside the preview frame - never
 * a workbench-side field that could agree with itself.
 */

import { rmSync } from 'node:fs';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { WorkbenchSession } from '../harness.ts';
import { expect, expectEqual, fixture, startGame } from '../harness.ts';
import { gameRoot, resolveContained } from '../../server/paths.ts';

export interface JourneyContext {
  readonly session: WorkbenchSession;
  readonly note: (text: string) => void;
}

function sha256Of(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/** Removes a project so a journey always starts from a known state. Games are gitignored scratch space. */
export function resetProject(gameId: string): void {
  rmSync(gameRoot(gameId), { recursive: true, force: true });
}

// ---------------------------------------------------------------------------

export async function wbBoot001({ session, note }: JourneyContext): Promise<void> {
  await session.open();

  const title = await session.text('.home__title');
  expect(title.includes('Game Factory'), `home title was "${title}"`);

  const actions = await session.page.evaluate(() =>
    Array.from(document.querySelectorAll('.action__title')).map((node) => node.textContent ?? ''),
  );
  for (const required of ['Make Something From an Image', 'Create From Assets', 'Open Existing Project', 'Browse Presets']) {
    expect(actions.includes(required), `primary action "${required}" missing; found ${JSON.stringify(actions)}`);
  }

  // The anti-reference: the root command must not open the Phase 1 slice.
  const body = await session.visibleText();
  expect(!body.includes('SW2D FOUNDATION'), 'the Phase 1 foundation slice is showing at the root route');
  expect(!body.toLowerCase().includes('phase 1 vertical slice'), 'Phase 1 vertical-slice wording is showing at the root route');

  // The hero action is the largest and first, not buried.
  const heroIsFirst = await session.page.evaluate(() => {
    const first = document.querySelector('.actions > *');
    return first?.classList.contains('action--hero') ?? false;
  });
  expect(heroIsFirst, '"Make Something From an Image" is not the first, highest-salience action');

  const track = await session.text('.build-track');
  for (const step of ['Supply image', 'Create + validate sprites', 'Arrange the scene', 'Run the game']) {
    expect(track.includes(step), `home build track is missing "${step}"`);
  }

  note(`four primary actions present; ${actions.length} total`);
}

// ---------------------------------------------------------------------------

export const PRIMARY_GAME = 'qa-image-game';

/**
 * The decisive journey (W16). One user-owned image becomes a playable game
 * whose *rendered texture* is that image.
 */
export async function wbImage001({ session, note }: JourneyContext): Promise<void> {
  resetProject(PRIMARY_GAME);
  await session.open();

  await session.click('.action--hero');
  await session.waitFor('.dropzone');
  await session.setFiles('.modal input[type=file]', [fixture('weasel.png')]);
  await session.waitForText('What is this image?');

  await session.clickText('Suggest games from this');
  await session.waitFor('.seed', 40_000);

  const picked = await session.page.evaluate(() => {
    const seeds = Array.from(document.querySelectorAll('.seed'));
    const target = seeds.find((seed) => (seed.querySelector('.seed__title')?.textContent ?? '').includes('Chase Platformer')) ?? seeds[0];
    (target?.querySelector('button') as HTMLButtonElement | null)?.click();
    return target?.querySelector('.seed__title')?.textContent ?? '';
  });
  expect(picked.length > 0, 'no seed could be chosen');

  await session.waitForText('Name your');
  await session.fill('.modal input[type=text]', PRIMARY_GAME);
  await session.clickText('Build my game');
  await session.waitForIdle(300_000);
  await session.waitFor('.topbar', 90_000);
  await session.page.waitForTimeout(1500);

  // The source remains untouched and a validated derivative holds the player role.
  const roleText = await session.text('.role-row');
  expect(roleText.includes('weasel-player-sprite'), `the player role does not show the generated sprite: "${roleText}"`);

  const importedAssets = readAssets(PRIMARY_GAME);
  const source = importedAssets.find((asset) => asset.kind === 'source');
  const sprite = importedAssets.find((asset) => asset.validation?.purpose === 'sprite');
  expect(source, 'the supplied source image was not preserved');
  expect(sprite, 'no sprite derivative was created from the supplied image');
  expectEqual(sprite!.sourceAssetId, source!.id, 'the sprite is not linked to the supplied source image');
  expectEqual(sprite!.validation?.status, 'valid', 'the sprite did not pass host validation');
  expectEqual(sprite!.validation?.sourceSha256, source!.sha256, 'sprite validation was not recorded against the supplied source hash');
  expectEqual(sha256Of(firstSourceFile(PRIMARY_GAME)), sha256Of(fixture('weasel.png')), 'sprite creation modified the supplied source bytes');

  // Image-first creation ends on the running game, without a separate hidden
  // preview step.
  await session.waitFor('iframe.preview__frame', 90_000);
  expect((await session.text('.play-status')).includes('RUNNING'), 'the created game is not visibly running');

  // Build, then show the production preview: what final validation relies on.
  await session.clickText('Build', '.topbar');
  await session.waitForJob('build');
  await session.clickText('Preview', '.tabs');
  await session.page.waitForTimeout(800);
  await session.clickText('Production preview');
  await session.waitFor('iframe.preview__frame', 90_000);

  const frame = await session.gameFrame(90_000);
  const snapshot = await startGame(frame);
  const shell = (snapshot['extra'] as Record<string, Record<string, unknown>> | undefined)?.['game.platform-shell'];
  expect(shell, `the running game exposed no platform-shell debug state (scene: ${String(snapshot['scene'])})`);

  expectEqual(snapshot['scene'], 'sw2d.play', 'the preview did not reach the play scene');

  // The decisive assertion: the texture the renderer is drawing is the one the
  // imported asset produced. `wb/` keys are only ever minted by theme
  // synthesis for an image-backed role, and the hash in the key is the
  // asset's own content hash.
  const textureKey = String(shell!['playerTextureKey']);
  const textureWidth = Number(shell!['playerTextureWidth']);
  const spriteHash = sprite!.sha256;

  expect(textureKey.startsWith('wb/'), `the game is drawing "${textureKey}", not an imported asset`);
  expect(
    textureKey.includes(spriteHash.slice(0, 12)),
    `the drawn texture key "${textureKey}" does not carry the validated sprite hash ${spriteHash.slice(0, 12)}`,
  );
  expectEqual(textureWidth, sprite!.width, "the drawn texture's width does not match the validated sprite");

  // The generated placeholder is 28px wide; if this were still the placeholder
  // the assertion above would have caught it, but stating it makes the failure
  // message unambiguous.
  expect(textureWidth !== 28, 'the game is still drawing the 28px generated placeholder');

  // And the bytes that shipped into the game are the fixture's, unchanged.
  const shipped = readTheme(PRIMARY_GAME).assets.find((descriptor) => descriptor.role === 'player');
  expect(shipped?.spec.kind === 'image', 'the player role is not image-backed in the written theme');
  expectEqual(
    sha256Of(resolveContained(gameRoot(PRIMARY_GAME), 'public', String(shipped!.spec.url))),
    spriteHash,
    'the file the game loads is not byte-identical to the validated sprite',
  );

  note(`validated sprite ${sprite!.id} rendered as ${textureKey} at ${textureWidth}px; source preserved`);
}

// ---------------------------------------------------------------------------

export async function wbSeed001({ session, note }: JourneyContext): Promise<void> {
  await session.open();
  await session.click('.action--hero');
  await session.waitFor('.dropzone');
  await session.setFiles('.modal input[type=file]', [fixture('palace.png')]);
  await session.waitForText('What is this image?');
  await session.clickText('Suggest games from this');
  await session.waitFor('.seed', 40_000);

  const seeds = await session.page.evaluate(() =>
    Array.from(document.querySelectorAll('.seed')).map((seed) => ({
      title: seed.querySelector('.seed__title')?.textContent ?? '',
      loop: seed.querySelector('.seed__loop')?.textContent ?? '',
      badges: Array.from(seed.querySelectorAll('.badge')).map((badge) => badge.textContent ?? ''),
      limits: seed.querySelector('.seed__limits')?.textContent ?? '',
      coverage: seed.querySelector('.coverage__fill')?.getAttribute('style') ?? '',
    })),
  );

  expect(seeds.length >= 1, 'no game seeds were offered');
  expect(seeds.length <= 3, `${seeds.length} seeds offered; the flow asks for at most three`);

  for (const seed of seeds) {
    expect(seed.title.length > 0, 'a seed had no title');
    expect(seed.loop.length > 20, `seed "${seed.title}" has no real one-sentence loop`);
    // Honest maturity is on the card, never softened.
    const maturity = seed.badges.find((badge) => badge.includes('validated') || badge === 'recipe');
    expect(maturity !== undefined, `seed "${seed.title}" does not state its maturity`);
    expect(
      seed.limits.length > 0,
      `seed "${seed.title}" states neither known limitations nor what its starter-kit depth means`,
    );
    expect(seed.coverage.includes('width'), `seed "${seed.title}" does not show role coverage`);
  }

  // A background image should not be recommended a genre that cannot use one.
  note(`${seeds.length} honest seed(s): ${seeds.map((seed) => seed.title).join(', ')}`);
}

// ---------------------------------------------------------------------------

/** Four different derivations, an untouched source, working undo/redo, and everything surviving a reload. */
export async function wbDerive001({ session, note }: JourneyContext): Promise<void> {
  await session.openProject(PRIMARY_GAME);

  const sourcePathBefore = firstSourceFile(PRIMARY_GAME);
  const hashBefore = sha256Of(sourcePathBefore);

  await session.clickText('Asset Lab', '.tabs');
  await session.waitFor('.lab__canvas');
  await session.click('.lib-item');
  await session.page.waitForTimeout(1200);

  // Four different kinds of operation, each recorded as a recipe step.
  await session.clickText('Trim');
  await session.page.waitForTimeout(400);
  await session.clickText('⇋');
  await session.page.waitForTimeout(400);
  await session.clickText('Variants…');
  await session.waitForText('Make a variant');
  await session.clickContaining('Outline', '.modal');
  await session.page.waitForTimeout(600);
  await session.clickText('−1px');
  await session.page.waitForTimeout(400);

  const stepCount = await session.count('.hist-row');
  expect(stepCount >= 5, `expected at least 4 recorded steps plus the source row, saw ${stepCount}`);

  // Undo/redo is a cursor into the recipe. The last operation does not
  // necessarily change dimensions, so the history's redo tail is the honest
  // browser-visible oracle for whether the cursor actually moved.
  expectEqual(await session.count('.hist-row--future'), 0, 'the recipe unexpectedly had a redo tail before undo');
  await session.clickText('↶');
  await session.page.waitForTimeout(400);
  expectEqual(await session.count('.hist-row--future'), 1, 'undo did not move one recipe step into the redo tail');
  await session.clickText('↷');
  await session.page.waitForTimeout(400);
  expectEqual(await session.count('.hist-row--future'), 0, 'redo did not restore the undone recipe step');

  await session.clickText('Save as new asset');
  await session.page.waitForTimeout(2500);

  const derivedCount = await session.count('.lib-item');
  expect(derivedCount >= 2, `expected a derived asset in the library, saw ${derivedCount} item(s)`);

  // P01: the source bytes are byte-identical after all of that.
  expectEqual(sha256Of(firstSourceFile(PRIMARY_GAME)), hashBefore, 'the source asset changed while deriving from it');

  // P03: every derivative records its source and a replayable recipe.
  const assets = readAssets(PRIMARY_GAME);
  const derived = assets.filter((asset) => asset.kind === 'derived');
  expect(derived.length >= 1, 'no derived asset was recorded');
  for (const asset of derived) {
    expect(asset.sourceAssetId !== undefined, `derived asset ${asset.id} records no source`);
    expect((asset.transformRecipe?.steps.length ?? 0) > 0, `derived asset ${asset.id} records no recipe steps`);
  }

  // Survives a reload.
  await session.openProject(PRIMARY_GAME);
  const afterReload = await session.count('.lib-item');
  expectEqual(afterReload, derivedCount, 'the derived asset did not survive a reload');

  note(`${stepCount - 1} recipe steps, ${derived.length} derivative(s), undo/redo cursor verified, source hash unchanged`);
}

// ---------------------------------------------------------------------------

/** A changed source keeps its id, its role and its derivatives' lineage (W04/W10). */
export async function wbReimport001({ session, note }: JourneyContext): Promise<void> {
  await session.openProject(PRIMARY_GAME);

  const before = readAssets(PRIMARY_GAME);
  const sourceBefore = before.find((asset) => asset.kind === 'source');
  expect(sourceBefore, 'no source asset to reimport');
  const idBefore = sourceBefore!.id;
  const hashBefore = sourceBefore!.sha256;
  const roleAssetBefore = before.find((asset) => asset.sourceAssetId === idBefore && asset.roleAssignments.length > 0);
  expect(roleAssetBefore, 'no derived asset holds a role, so this journey would prove nothing');
  const rolesBefore = [...roleAssetBefore!.roleAssignments];

  // Select the source in the library, then replace its bytes.
  await session.page.evaluate((assetId) => {
    const node = document.querySelector<HTMLElement>(`.lib-item[data-asset-id="${assetId as string}"]`);
    node?.click();
  }, idBefore);
  await session.page.waitForTimeout(900);
  // Pick whichever fixture is *not* what the source currently holds, so the
  // journey proves the same thing on a fresh project and on a re-run.
  const replacement = hashBefore === sha256Of(fixture('weasel-alt.png')) ? fixture('weasel.png') : fixture('weasel-alt.png');
  await session.setFiles('.pane--inspector input[type=file]', [replacement]);
  await session.page.waitForTimeout(4000);

  const after = readAssets(PRIMARY_GAME);
  const sourceAfter = after.find((asset) => asset.id === idBefore);
  expect(sourceAfter, `the asset id ${idBefore} did not survive the reimport - identity is not stable (F06)`);
  expect(sourceAfter!.sha256 !== hashBefore, 'the reimport did not actually change the stored bytes');
  const derivatives = after.filter((asset) => asset.sourceAssetId === idBefore);
  for (const derivative of derivatives) {
    expectEqual(derivative.sourceAssetId, idBefore, 'a derivative lost its lineage across the reimport');
    expect((derivative.transformRecipe?.steps.length ?? 0) > 0, 'a derivative lost its recipe across the reimport');
  }
  const roleAssetAfter = derivatives.find((asset) => asset.id === roleAssetBefore!.id);
  expect(roleAssetAfter, 'the role-bearing sprite did not survive source reimport');
  expectEqual(JSON.stringify(roleAssetAfter!.roleAssignments), JSON.stringify(rolesBefore), 'the reimport lost the sprite role assignment (F07)');
  expectEqual(roleAssetAfter!.validation?.sourceSha256, sourceAfter!.sha256, 'the rebuilt sprite was not revalidated against the replacement source');

  // The theme now points at the new bytes.
  const theme = readTheme(PRIMARY_GAME);
  const player = theme.assets.find((descriptor) => descriptor.role === rolesBefore[0]);
  expect(player?.spec.kind === 'image', 'the role fell back to generated art after a reimport');
  expect(
    String(player?.key).includes(roleAssetAfter!.sha256.slice(0, 12)),
    'the theme still names the old sprite content hash after a reimport',
  );

  // And the bytes the game will actually load were replaced too - an
  // existence-only copy check would leave the previous image shipped under
  // the same name.
  const shipped = resolveContained(gameRoot(PRIMARY_GAME), 'public', String(player!.spec.url));
  expectEqual(sha256Of(shipped), roleAssetAfter!.sha256, 'the file the game loads still holds the pre-reimport sprite pixels');

  note(`id ${idBefore} kept, role ${rolesBefore.join(',')} kept, ${derivatives.length} derivative(s) relinked, shipped bytes replaced`);
}

// ---------------------------------------------------------------------------

export async function wbReopen001({ session, note }: JourneyContext): Promise<void> {
  await session.openProject(PRIMARY_GAME);

  // Change something persistent: the library view mode and the active tab.
  await session.clickText('Scene', '.tabs');
  await session.page.waitForTimeout(1500);
  const assetsBefore = await session.count('.lib-item');
  const presetBefore = await session.text('.topbar__meta span');

  await session.openProject(PRIMARY_GAME);

  const activeTab = await session.page.evaluate(() => document.querySelector('.tab[aria-selected="true"]')?.textContent ?? '');
  expectEqual(activeTab, 'Scene', 'the active workspace tab did not persist across a reload');
  expectEqual(await session.count('.lib-item'), assetsBefore, 'the asset library did not come back');
  expectEqual(await session.text('.topbar__meta span'), presetBefore, 'the preset did not come back');

  const roleRows = await session.count('.role-row');
  expect(roleRows > 0, 'role assignments did not come back');

  note(`tab, ${assetsBefore} assets, preset and ${roleRows} role rows all restored`);
}

// ---------------------------------------------------------------------------
// helpers over the project's own metadata (read-only assertions)
// ---------------------------------------------------------------------------

interface StoredAsset {
  readonly id: string;
  readonly kind: string;
  readonly width: number;
  readonly sha256: string;
  readonly relativePath: string;
  readonly roleAssignments: readonly string[];
  readonly sourceAssetId?: string;
  readonly transformRecipe?: { readonly steps: readonly unknown[] };
  readonly stale?: boolean;
  readonly validation?: { readonly purpose: string; readonly status: string; readonly sourceSha256: string };
}

export function readAssets(gameId: string): readonly StoredAsset[] {
  const filePath = resolveContained(gameRoot(gameId), '.sw2d', 'assets.json');
  if (!existsSync(filePath)) return [];
  return (JSON.parse(readFileSync(filePath, 'utf8')) as { assets: StoredAsset[] }).assets;
}

interface StoredTheme {
  readonly assets: readonly { readonly role: string; readonly key: string; readonly spec: { readonly kind: string; readonly url?: string } }[];
}

export function readTheme(gameId: string): StoredTheme {
  return JSON.parse(readFileSync(resolveContained(gameRoot(gameId), 'content', 'themes', 'default', 'theme.json'), 'utf8')) as StoredTheme;
}

export function firstSourceFile(gameId: string): string {
  const source = readAssets(gameId).find((asset) => asset.kind === 'source');
  if (!source) throw new Error(`No source asset in "${gameId}".`);
  return resolveContained(gameRoot(gameId), source.relativePath);
}
