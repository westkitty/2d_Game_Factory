#!/usr/bin/env node
/**
 * Real-browser proof for imported frame-group animation.
 *
 * This does not fabricate a special test runtime. It creates a normal game
 * through the canonical factory, stores the committed workbench PNG fixtures
 * through the real asset store, synthesizes the real theme, production-builds
 * the generated game, then proves in system Chrome that the player's rendered
 * texture advances through the declared local frame sequence.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createGame, ensureWorkspaceInstalled, REPO_ROOT } from '@sw2d/cli/factory';
import { launchHarness, serveStatic } from '@sw2d/qa';
import type { BlueprintDocument, Provenance } from '../../workbench/shared/types.ts';
import { loadAssets, storeSource } from '../../workbench/server/assetStore.ts';
import { gameRoot, resolveContained } from '../../workbench/server/paths.ts';
import { writeTheme } from '../../workbench/server/themeSynthesis.ts';

const GAME_ID = 'qa-frame-group-animation';
const FIXTURES = path.resolve(fileURLToPath(new URL('../../workbench/fixtures/frames/', import.meta.url)));
const FRAME_FILES = ['walk_01.png', 'walk-2.png', 'walk0003.png', 'walk_04.png'] as const;
const OWNED: Provenance = { kind: 'project-owned', modificationStatus: 'unmodified' };

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function fail(message: string): never {
  throw new Error(message);
}

async function main(): Promise<void> {
  const lockPath = path.join(REPO_ROOT, 'package-lock.json');
  const lockBefore = sha256(readFileSync(lockPath));
  rmSync(gameRoot(GAME_ID), { recursive: true, force: true });

  let harness: Awaited<ReturnType<typeof launchHarness>> | null = null;
  let server: Awaited<ReturnType<typeof serveStatic>> | null = null;

  try {
    createGame({ gameId: GAME_ID, presetId: 'traditional-platformer' });

    const importedIds: string[] = [];
    for (let index = 0; index < FRAME_FILES.length; index++) {
      const fileName = FRAME_FILES[index]!;
      const stored = storeSource({
        gameId: GAME_ID,
        bytes: readFileSync(path.join(FIXTURES, fileName)),
        displayName: fileName,
        sourceRelativePath: `frames/${fileName}`,
        provenance: OWNED,
        group: 'walk',
        frameIndex: index + 1,
      });
      importedIds.push(stored.record.id);
    }

    const blueprint: BlueprintDocument = {
      version: 1,
      roleAssignments: [{ role: 'player', assetId: importedIds[0]!, coverage: 'assigned' }],
      palette: ['#65d0a8', '#e05fa0', '#39415a'],
    };
    const synthesis = writeTheme({ gameId: GAME_ID, assets: loadAssets(GAME_ID), blueprint });
    const animation = synthesis.theme.animations?.find((candidate) => candidate.role === 'player');
    if (!animation) fail('theme synthesis did not emit the player frame-group animation');
    if (animation.frames.length !== FRAME_FILES.length) {
      fail(`theme animation has ${animation.frames.length} frames; expected ${FRAME_FILES.length}`);
    }

    const resourceManifest = JSON.parse(
      readFileSync(resolveContained(gameRoot(GAME_ID), 'resources', 'RESOURCE_MANIFEST.json'), 'utf8'),
    ) as { records?: Array<{ id?: string; status?: string }> };
    for (const assetId of importedIds) {
      const record = resourceManifest.records?.find((candidate) => candidate.id === `${GAME_ID}.asset.${assetId}`);
      if (!record || record.status !== 'approved') fail(`animation frame ${assetId} is missing approved release provenance`);
    }

    await ensureWorkspaceInstalled();
    const vite = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
    const built = spawnSync(vite, ['build'], { cwd: gameRoot(GAME_ID), encoding: 'utf8' });
    if (built.status !== 0) fail(`production build failed:\n${built.stderr || built.stdout}`);

    server = await serveStatic(resolveContained(gameRoot(GAME_ID), 'dist'));
    harness = await launchHarness();
    await harness.gotoAndWaitForRuntime(`${server.baseUrl}/`, 20_000);

    for (let attempt = 0; attempt < 8; attempt++) {
      const inPlay = await harness.evaluate(() => {
        const runtime = (window as unknown as { __SW2D__: { snapshot(): { scene?: string } } }).__SW2D__;
        return runtime.snapshot().scene === 'sw2d.play';
      });
      if (inPlay) break;
      await harness.keyTap('Space');
      await harness.stepFrames(12);
    }

    const declared = await harness.evaluate(() => {
      const runtime = (window as unknown as {
        __SW2D__: {
          context: { content: { animations?: Array<{ role: string; key: string; frames: Array<{ key: string }> }> } };
          snapshot(): { scene?: string };
        };
      }).__SW2D__;
      const animation = runtime.context.content.animations?.find((candidate) => candidate.role === 'player');
      return { scene: runtime.snapshot().scene, animation };
    });
    if (declared.scene !== 'sw2d.play') fail(`generated game never reached play; scene=${String(declared.scene)}`);
    if (!declared.animation || declared.animation.frames.length !== 4) fail('runtime did not receive the four-frame player animation');

    const observed: string[] = [];
    let currentAnimationKey = '';
    for (let sample = 0; sample < 6; sample++) {
      const state = await harness.evaluate(() => {
        const runtime = (window as unknown as {
          __SW2D__: {
            context: { content: { animations?: Array<{ role: string; key: string; frames: Array<{ key: string }> }> } };
            phaser: { scene: { getScene(key: string): { children: { list: Array<{ texture?: { key?: string }; anims?: { currentAnim?: { key?: string }; isPlaying?: boolean } }> } } } };
          };
        }).__SW2D__;
        const animation = runtime.context.content.animations?.find((candidate) => candidate.role === 'player');
        const keys = new Set(animation?.frames.map((frame) => frame.key) ?? []);
        const scene = runtime.phaser.scene.getScene('sw2d.play');
        const sprite = scene.children.list.find((candidate) => candidate.texture?.key && keys.has(candidate.texture.key));
        return {
          textureKey: sprite?.texture?.key ?? '',
          animationKey: sprite?.anims?.currentAnim?.key ?? '',
          playing: sprite?.anims?.isPlaying ?? false,
        };
      });
      if (!state.textureKey) fail('no Play-scene Sprite is rendering one of the declared player animation frames');
      observed.push(state.textureKey);
      currentAnimationKey = state.animationKey;
      if (!state.playing) fail('the player Sprite has the frame sequence but its Phaser animation is not playing');
      await harness.stepFrames(8);
    }

    const unique = [...new Set(observed)];
    if (unique.length < 2) fail(`player texture never advanced; observed only ${unique.join(', ')}`);
    if (currentAnimationKey !== declared.animation.key) {
      fail(`player is playing ${currentAnimationKey || '<none>'}, expected ${declared.animation.key}`);
    }
    if (harness.consoleErrors().length > 0) fail(`browser console error: ${harness.consoleErrors()[0]}`);
    if (harness.externalRequests().length > 0) fail(`external request: ${harness.externalRequests()[0]}`);

    const lockAfter = sha256(readFileSync(lockPath));
    if (lockAfter !== lockBefore) fail('package-lock.json changed during frame-group proof');

    console.log(
      `PASS frame-group animation: ${animation.frames.length} local frames synthesized, ${unique.length} rendered frame textures observed, ` +
        `animation=${declared.animation.key}, no console errors/external requests, lockfile unchanged.`,
    );
  } finally {
    await harness?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
    rmSync(gameRoot(GAME_ID), { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
