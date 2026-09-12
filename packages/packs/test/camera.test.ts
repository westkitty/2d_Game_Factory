import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { CameraCatalog, CameraService, GameContext } from '@sw2d/contracts';
import { CAMERA_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { cameraPack } from '../src/camera/cameraPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const RAIL: CameraCatalog = {
  schemaVersion: 1,
  mode: 'rail',
  points: [
    { x: 120, y: 270 },
    { x: 480, y: 270 },
    { x: 840, y: 270 },
  ],
  speed: 0.35,
  frame: { width: 200, height: 140 },
  subjects: [],
  shotsToWin: 0,
};

const FRAME: CameraCatalog = {
  schemaVersion: 1,
  mode: 'frame',
  points: [{ x: 120, y: 270 }],
  speed: 0,
  frame: { width: 160, height: 120 },
  subjects: [
    { id: 'bird', x: 280, y: 270, radius: 64 },
    { id: 'tree', x: 700, y: 270, radius: 64 },
  ],
  shotsToWin: 2,
};

function install(catalog?: CameraCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { camera: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = cameraPack.install(ctx, undefined);
  const cam = capabilities.require<CameraService>(CAMERA_CAPABILITY_ID);
  return { events, capabilities, installed, cam };
}

describe('sw2d.camera - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(CAMERA_CAPABILITY_ID).toBe(CAPABILITY_IDS.camera);
    expect(cameraPack.provides).toEqual([CAMERA_CAPABILITY_ID]);
  });
});

describe('sw2d.camera - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ camera: RAIL })).not.toThrow();
    expect(() => validateContentBundleData({ camera: FRAME })).not.toThrow();
  });
});

describe('sw2d.camera - rail', () => {
  it('advances origin along authored points without auto-winning', () => {
    const { cam } = install(RAIL);
    expect(cam.originX()).toBe(120);
    cam.tick(1000);
    expect(cam.progress()).toBeGreaterThan(0);
    expect(cam.originX()).toBeGreaterThan(120);
    cam.tick(10_000);
    expect(cam.progress()).toBe(1);
    expect(cam.outcome()).toBe('playing');
  });
});

describe('sw2d.camera - frame', () => {
  it('two contained shots complete the album', () => {
    const { cam } = install(FRAME);
    cam.setFrame(280, 270);
    expect(cam.capture()).toBe(true);
    cam.setFrame(700, 270);
    expect(cam.capture()).toBe(true);
    expect(cam.outcome()).toBe('complete');
    expect(cam.shots()).toBe(2);
  });

  it('a miss does not score', () => {
    const { cam } = install(FRAME);
    cam.setFrame(10, 10);
    expect(cam.capture()).toBe(false);
    expect(cam.lastResult()).toBe('miss');
  });
});

describe('sw2d.camera - lifecycle', () => {
  it('an empty catalog is inert', () => {
    const { cam } = install();
    expect(cam.active()).toBe(false);
  });
});
