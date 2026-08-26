import { createServer, type Server } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

export interface StaticServerHandle {
  readonly port: number;
  readonly baseUrl: string;
  close(): Promise<void>;
}

/**
 * Serves a static build directory on a free local port - never a fixed one
 * (MASTER_PROJECT.md's standing rule against colliding with port 4173, and
 * against depending on a specific free port at all). No new dependency:
 * this is a ~40-line file server, not a framework.
 */
export function serveStatic(rootDir: string): Promise<StaticServerHandle> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', 'http://localhost');
      let relativePath = decodeURIComponent(requestUrl.pathname);
      if (relativePath.endsWith('/')) relativePath += 'index.html';
      const resolved = path.join(rootDir, relativePath);

      // Same containment guarantee resolveUnder() gives the CLI's own writes.
      if (!resolved.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(resolved);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
      createReadStream(resolved).pipe(res);
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('static server did not bind to a TCP port'));
        return;
      }
      const port = address.port;
      resolve({
        port,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
