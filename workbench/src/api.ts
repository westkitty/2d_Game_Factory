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

/** The URL that serves one asset's real bytes. Same-origin, and cache-busted by content hash. */
export function assetUrl(gameId: string, assetId: string, sha256: string): string {
  return `/api/assets/bytes?gameId=${encodeURIComponent(gameId)}&assetId=${encodeURIComponent(assetId)}&v=${sha256.slice(0, 12)}`;
}

export function hasSession(): boolean {
  return SESSION_TOKEN.length > 0;
}
