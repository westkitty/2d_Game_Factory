import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { CodexCatalog, CodexService, GameContext } from '@sw2d/contracts';
import { CODEX_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { codexPack } from '../src/codex/codexPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const EXHIBIT: CodexCatalog = {
  schemaVersion: 1,
  mode: 'exhibit',
  entries: [
    { id: 'plinth', title: 'Plinth', body: 'A stone plinth holds the first exhibit.' },
    { id: 'bust', title: 'Bust', body: 'A carved bust watches the hall.' },
  ],
};

const CASE: CodexCatalog = {
  schemaVersion: 1,
  mode: 'case',
  entries: [
    { id: 'print', title: 'Print', body: 'A boot print by the window.' },
    { id: 'photo', title: 'Photo', body: 'A torn photograph of the hall.' },
  ],
};

function install(catalog?: CodexCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { codex: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = codexPack.install(ctx, undefined);
  const book = capabilities.require<CodexService>(CODEX_CAPABILITY_ID);
  return { events, capabilities, installed, book };
}

describe('sw2d.codex - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(CODEX_CAPABILITY_ID).toBe(CAPABILITY_IDS.codex);
    expect(codexPack.provides).toEqual([CODEX_CAPABILITY_ID]);
  });
});

describe('sw2d.codex - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ codex: EXHIBIT })).not.toThrow();
    expect(() => validateContentBundleData({ codex: CASE })).not.toThrow();
  });
});

describe('sw2d.codex - exhibit', () => {
  it('inspecting every entry catalogues the hall', () => {
    const { book } = install(EXHIBIT);
    expect(book.inspect('plinth')).toBe(true);
    expect(book.inspect('bust')).toBe(true);
    expect(book.outcome()).toBe('complete');
  });
});

describe('sw2d.codex - case', () => {
  it('deduce waits until every entry is unlocked', () => {
    const { book } = install(CASE);
    expect(book.deduce()).toBe(false);
    book.inspect('print');
    book.inspect('photo');
    expect(book.deduce()).toBe(true);
    expect(book.outcome()).toBe('complete');
    expect(book.lastResult()).toBe('solved');
  });
});

describe('sw2d.codex - lifecycle', () => {
  it('an empty catalog is inert', () => {
    const { book } = install();
    expect(book.active()).toBe(false);
    expect(book.inspect('plinth')).toBe(false);
  });
});
