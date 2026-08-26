import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { serveStatic, type StaticServerHandle } from '../src/staticServer.ts';

describe('serveStatic', () => {
  let dir: string;
  let server: StaticServerHandle | undefined;

  afterEach(async () => {
    if (server) await server.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('binds to a free OS-assigned port, never a fixed one', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'sw2d-qa-static-'));
    writeFileSync(path.join(dir, 'index.html'), '<html></html>', 'utf8');
    server = await serveStatic(dir);
    expect(server.port).toBeGreaterThan(0);
    expect(server.port).not.toBe(4173);
    expect(server.baseUrl).toBe(`http://127.0.0.1:${server.port}`);
  });

  it('serves a file with the correct content type', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'sw2d-qa-static-'));
    writeFileSync(path.join(dir, 'index.html'), '<html>hi</html>', 'utf8');
    writeFileSync(path.join(dir, 'app.js'), 'console.log(1)', 'utf8');
    server = await serveStatic(dir);

    const htmlRes = await fetch(`${server.baseUrl}/index.html`);
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers.get('content-type')).toContain('text/html');
    expect(await htmlRes.text()).toBe('<html>hi</html>');

    const jsRes = await fetch(`${server.baseUrl}/app.js`);
    expect(jsRes.headers.get('content-type')).toContain('text/javascript');
  });

  it('returns 404 for a missing file', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'sw2d-qa-static-'));
    writeFileSync(path.join(dir, 'index.html'), '<html></html>', 'utf8');
    server = await serveStatic(dir);
    const res = await fetch(`${server.baseUrl}/nope.js`);
    expect(res.status).toBe(404);
  });

  it('refuses a path-traversal request that escapes the served root', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'sw2d-qa-static-'));
    writeFileSync(path.join(dir, 'index.html'), '<html></html>', 'utf8');
    server = await serveStatic(dir);
    const res = await fetch(`${server.baseUrl}/../../../etc/passwd`);
    expect([403, 404]).toContain(res.status);
  });
});
