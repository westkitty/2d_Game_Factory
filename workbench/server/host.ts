/**
 * The workbench host.
 *
 * One Node HTTP server on 127.0.0.1 serving both the UI and the API, so there
 * is a single origin, no CORS surface, and no second port to secure. In dev
 * the UI comes from Vite in middleware mode (HMR included); in production it
 * comes from `workbench/dist`.
 *
 * The security gate runs here, once, before any handler: loopback bind,
 * Origin/Host validation, session token, body size limits. `api.ts` therefore
 * never has to remember to check them.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { handleApi, type ApiRequest } from './api.ts';
import { LIMITS, SecurityError, assertAcceptableOrigin, mintSessionToken, tokensMatch } from './security.ts';
import { WORKBENCH_ROOT, resolveContained } from './paths.ts';
import { stopAllPreviews } from './previewManager.ts';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

/** The slice of Vite's dev server this host actually uses. Narrow on purpose: it is the whole coupling to Vite's internals. */
interface ViteDevMiddleware {
  middlewares(request: IncomingMessage, response: ServerResponse, next: () => void): void;
  transformIndexHtml(url: string, html: string): Promise<string>;
  close(): Promise<void>;
}

export interface HostOptions {
  readonly production?: boolean;
  /** 0 asks the OS for a free port, which is the default: the workbench must not squat a fixed port. */
  readonly port?: number;
  readonly open?: boolean;
}

export interface HostHandle {
  readonly url: string;
  readonly port: number;
  readonly sessionToken: string;
  close(): Promise<void>;
}

/**
 * Reads a request body with a hard cap.
 *
 * The cap is enforced while reading, not after: a client that ignores it has
 * its socket destroyed rather than being allowed to fill the host's memory
 * first and be told off afterwards.
 */
function readBody(request: IncomingMessage, limit: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    request.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > limit) {
        request.destroy();
        reject(new SecurityError(413, `Request body exceeds the ${limit}-byte limit.`));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    request.on('error', reject);
  });
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const text = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    // The UI is entirely first-party and inline-free apart from the token
    // bootstrap, so a tight policy costs nothing and removes a whole class of
    // injection risk from a page that holds local authority.
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(text);
}

/**
 * Injects the per-process session token into the served HTML.
 *
 * The token has to reach the page somehow, and this is the only route that
 * does not put it somewhere a third party could read: not a URL (logged,
 * shared), not a cookie (sent automatically, so CSRF-shaped), not a separate
 * endpoint (fetchable by any local page). A cross-origin page cannot read
 * another origin's HTML, so it cannot learn the token.
 */
function injectToken(html: string, token: string, csp: string): string {
  const bootstrap = `<meta name="sw2d-session" content="${token}" />\n<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
  return html.includes('</head>') ? html.replace('</head>', `${bootstrap}\n</head>`) : bootstrap + html;
}

const DEV_CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  // Vite's dev client needs inline style and eval-free module injection.
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' ws://127.0.0.1:* ws://localhost:*",
  "frame-src 'self' http://127.0.0.1:* http://localhost:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const PROD_CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-src 'self' http://127.0.0.1:* http://localhost:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

export async function startHost(options: HostOptions = {}): Promise<HostHandle> {
  const production = options.production === true;
  const sessionToken = mintSessionToken();
  const csp = production ? PROD_CSP : DEV_CSP;

  // Vite is imported dynamically and only in dev, so a production host never
  // loads a dev-only dependency at all.
  let vite: ViteDevMiddleware | null = null;
  if (!production) {
    const { createServer: createViteServer } = await import('vite');
    const devServer = await createViteServer({
      root: WORKBENCH_ROOT,
      appType: 'custom',
      server: { middlewareMode: true, host: '127.0.0.1' },
    });
    vite = devServer as unknown as ViteDevMiddleware;
  }

  const distRoot = resolveContained(WORKBENCH_ROOT, 'dist');
  if (production && !existsSync(resolveContained(distRoot, 'index.html'))) {
    throw new Error('No workbench production build found. Run: npm run workbench:build');
  }

  const server: Server = createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      if (error instanceof SecurityError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    });
  });

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? 'GET';
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    assertAcceptableOrigin(method, request.headers.origin, request.headers.host);

    if (url.pathname.startsWith('/api/')) {
      if (!tokensMatch(sessionToken, request.headers['x-sw2d-session'] as string | undefined)) {
        sendJson(response, 401, { error: 'Missing or invalid workbench session token. Reload the workbench page.' });
        return;
      }

      const contentType = request.headers['content-type'] ?? '';
      const isJson = contentType.includes('application/json');
      const limit = isJson ? LIMITS.jsonBodyBytes : LIMITS.singleUploadBytes;
      const body = method === 'GET' || method === 'HEAD' ? new Uint8Array(0) : await readBody(request, limit);

      let json: unknown;
      if (isJson && body.byteLength > 0) {
        try {
          json = JSON.parse(new TextDecoder().decode(body));
        } catch {
          sendJson(response, 400, { error: 'Malformed JSON body.' });
          return;
        }
      }

      const apiRequest: ApiRequest = {
        method,
        path: url.pathname.slice('/api'.length),
        query: url.searchParams,
        headers: request.headers as Readonly<Record<string, string | undefined>>,
        json,
        body,
      };
      const result = await handleApi(apiRequest);
      if (result.bytes) {
        response.writeHead(result.status, {
          'Content-Type': result.contentType ?? 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
          ...(result.headers ?? {}),
        });
        response.end(Buffer.from(result.bytes));
        return;
      }
      sendJson(response, result.status, result.json ?? {});
      return;
    }

    if (production) {
      await serveStaticFile(url.pathname, response);
      return;
    }

    // Dev: let Vite handle module/asset requests, and serve index.html
    // ourselves so the token and CSP can be injected into it.
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const raw = readFileSync(resolveContained(WORKBENCH_ROOT, 'index.html'), 'utf8');
      const transformed = await vite!.transformIndexHtml(url.pathname, raw);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(injectToken(transformed, sessionToken, csp));
      return;
    }
    vite!.middlewares(request, response, () => {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    });
  }

  async function serveStaticFile(pathname: string, response: ServerResponse): Promise<void> {
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    let absolute: string;
    try {
      absolute = resolveContained(distRoot, relative);
    } catch {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      // Single-page fallback: unknown paths get the app shell, not a 404.
      absolute = resolveContained(distRoot, 'index.html');
    }
    if (absolute.endsWith('index.html')) {
      const html = readFileSync(absolute, 'utf8');
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(injectToken(html, sessionToken, csp));
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(absolute)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    createReadStream(absolute).pipe(response);
  }

  const port = await new Promise<number>((resolve, reject) => {
    server.on('error', reject);
    // Bound to 127.0.0.1 explicitly. Not a default worth leaving implicit:
    // the difference between this and `0.0.0.0` is whether the user's
    // in-progress game and this host's local authority are on their network.
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo | null;
      if (!address || typeof address === 'string') {
        reject(new Error('The workbench host did not bind to a TCP port.'));
        return;
      }
      resolve(address.port);
    });
  });

  const handle: HostHandle = {
    url: `http://127.0.0.1:${port}`,
    port,
    sessionToken,
    close: async () => {
      await stopAllPreviews();
      if (vite) await vite.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };

  return handle;
}
