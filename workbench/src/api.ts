/**
 * The client half of the workbench API.
 *
 * Every request carries the per-process session token that the host injected
 * into this page's HTML. A page on another origin cannot read that token, so
 * it cannot drive the factory even though the host is listening on loopback.
 */

const SESSION_TOKEN = document.querySelector<HTMLMetaElement>('meta[name="sw2d-session"]')?.content ?? '';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(response.status, text.slice(0, 400));
  }
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      'x-sw2d-session': SESSION_TOKEN,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await parse(response);
  if (!response.ok) {
    throw new ApiError(response.status, (payload as { error?: string }).error ?? `Request failed (${response.status}).`);
  }
  return payload;
}

export function get<T>(path: string, query: Readonly<Record<string, string>> = {}): Promise<T> {
  const search = new URLSearchParams(query).toString();
  return request('GET', search ? `${path}?${search}` : path) as Promise<T>;
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request('POST', path, body ?? {}) as Promise<T>;
}

/**
 * Uploads raw bytes with metadata in headers.
 *
 * Headers rather than multipart: the host reads one contiguous body with a
 * hard cap, which keeps the "never buffer a whole batch" property that
 * multipart parsing would quietly undo. Values are URI-encoded because header
 * fields are Latin-1 and a file name is not.
 */
export async function postBytes<T>(path: string, bytes: BlobPart, headers: Readonly<Record<string, string>>): Promise<T> {
  const encoded: Record<string, string> = { 'x-sw2d-session': SESSION_TOKEN, 'Content-Type': 'application/octet-stream' };
  for (const [key, value] of Object.entries(headers)) encoded[key] = encodeURIComponent(value);
  const response = await fetch(`/api${path}`, { method: 'POST', headers: encoded, body: bytes });
  const payload = await parse(response);
  if (!response.ok) {
    throw new ApiError(response.status, (payload as { error?: string }).error ?? `Upload failed (${response.status}).`);
  }
  return payload as T;
}

/**
 * Asset bytes, fetched with the session token.
 *
 * An `<img src>` cannot carry a custom header, and putting the token in the
 * URL would leak it into history, logs and any copied link - so asset bytes
 * are fetched here and handed to the DOM as an object URL instead. The
 * alternative (exempting this one endpoint from the token) would open the
 * whole asset store to any local page.
 *
 * Object URLs are cached by asset id + content hash, so a repaint is free and
 * a rebuilt derivative (new hash) correctly misses the cache.
 */
const OBJECT_URLS = new Map<string, Promise<string>>();
const OBJECT_URL_LIMIT = 400;

export function assetBlobUrl(gameId: string, assetId: string, sha256: string): Promise<string> {
  const key = `${gameId}:${assetId}:${sha256}`;
  const cached = OBJECT_URLS.get(key);
  if (cached) return cached;

  const pending = (async () => {
    const response = await fetch(
      `/api/assets/bytes?gameId=${encodeURIComponent(gameId)}&assetId=${encodeURIComponent(assetId)}`,
      { headers: { 'x-sw2d-session': SESSION_TOKEN } },
    );
    if (!response.ok) throw new ApiError(response.status, `Could not load asset bytes (${response.status}).`);
    return URL.createObjectURL(await response.blob());
  })();

  OBJECT_URLS.set(key, pending);
  pending.catch(() => OBJECT_URLS.delete(key));
  if (OBJECT_URLS.size > OBJECT_URL_LIMIT) {
    const oldest = OBJECT_URLS.keys().next();
    if (!oldest.done) {
      const stale = OBJECT_URLS.get(oldest.value);
      OBJECT_URLS.delete(oldest.value);
      void stale?.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
    }
  }
  return pending;
}

export async function assetBlob(gameId: string, assetId: string): Promise<Blob> {
  const response = await fetch(
    `/api/assets/bytes?gameId=${encodeURIComponent(gameId)}&assetId=${encodeURIComponent(assetId)}`,
    { headers: { 'x-sw2d-session': SESSION_TOKEN } },
  );
  if (!response.ok) throw new ApiError(response.status, `Could not load asset bytes (${response.status}).`);
  return response.blob();
}

export function hasSession(): boolean {
  return SESSION_TOKEN.length > 0;
}
