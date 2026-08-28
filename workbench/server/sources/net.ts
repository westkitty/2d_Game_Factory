/**
 * The only outbound network path in the workbench, and it is deliberately not
 * general (architectural laws 8-10).
 *
 *  - There is no `fetch(url)` a caller can steer. `providerGet` takes a
 *    `providerId` and a URL that must already belong to that provider's
 *    compile-time host allowlist; a URL from a request body can never reach
 *    here because nothing passes one through.
 *  - HTTPS only. Redirects are followed manually and each hop is re-checked
 *    against the same allowlist, so a provider redirect cannot walk off to
 *    another host.
 *  - Every hostname is resolved and refused if it points at a loopback,
 *    private, link-local or carrier-NAT address - the SSRF shapes that matter
 *    on a machine that also runs local services.
 *  - Responses are streamed with a hard byte cap and a wall-clock timeout, and
 *    the declared content-type is checked but never trusted over the bytes.
 *
 * Generated games contain none of this: it is authoring-time only.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class SourceNetworkError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'SourceNetworkError';
    this.status = status;
  }
}

/** Exact hostnames each provider is allowed to reach. No wildcards. */
export const PROVIDER_HOST_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
  kenney: ['kenney.nl', 'www.kenney.nl'],
};

export function providerHosts(providerId: string): readonly string[] {
  return PROVIDER_HOST_ALLOWLIST[providerId] ?? [];
}

/** IPv4/IPv6 ranges that must never be the target of an authoring fetch. */
export function isDisallowedAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) {
    const [a, b] = address.split('.').map((part) => Number.parseInt(part, 10));
    if (a === undefined || b === undefined) return true;
    if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = address.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    // fe80::/10 link-local (fe80-febf), fc00::/7 ULA (fc/fd)
    if (/^fe[89ab]/.test(lower) || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    const mappedDecimal = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedDecimal?.[1]) return isDisallowedAddress(mappedDecimal[1]);
    // IPv4-mapped in hex form, e.g. ::ffff:7f00:1
    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = Number.parseInt(mappedHex[1]!, 16);
      const lo = Number.parseInt(mappedHex[2]!, 16);
      return isDisallowedAddress(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
    }
    return false;
  }
  return true; // not a parseable IP - refuse
}

export interface ProviderGetOptions {
  readonly maxBytes: number;
  readonly timeoutMs: number;
  readonly accept?: string;
  /** Injectable for tests. Defaults to the platform fetch / DNS. */
  readonly fetchImpl?: typeof fetch;
  readonly lookupImpl?: (host: string) => Promise<readonly { address: string }[]>;
  readonly maxRedirects?: number;
}

export interface ProviderGetResult {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly finalUrl: string;
}

async function assertReachableHost(
  host: string,
  lookupImpl: NonNullable<ProviderGetOptions['lookupImpl']>,
): Promise<void> {
  if (isIP(host)) throw new SourceNetworkError(`Refused: "${host}" is a numeric host, not an allowlisted provider name.`, 403);
  let records: readonly { address: string }[];
  try {
    records = await lookupImpl(host);
  } catch {
    throw new SourceNetworkError(`Refused: "${host}" did not resolve.`, 502);
  }
  if (records.length === 0) throw new SourceNetworkError(`Refused: "${host}" resolved to no addresses.`, 502);
  for (const { address } of records) {
    if (isDisallowedAddress(address)) {
      throw new SourceNetworkError(`Refused: "${host}" resolves to non-public address ${address}.`, 403);
    }
  }
}

/**
 * Performs one bounded GET against a provider-owned URL.
 *
 * Throws `SourceNetworkError` for every refusal so the API layer can map it to
 * a clean status without a 500.
 */
export async function providerGet(providerId: string, rawUrl: string, options: ProviderGetOptions): Promise<ProviderGetResult> {
  const allow = PROVIDER_HOST_ALLOWLIST[providerId];
  if (!allow || allow.length === 0) throw new SourceNetworkError(`Unknown source provider "${providerId}".`, 400);

  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupImpl =
    options.lookupImpl ??
    (async (host: string) => (await lookup(host, { all: true })).map((entry) => ({ address: entry.address })));
  const maxRedirects = options.maxRedirects ?? 3;

  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new SourceNetworkError(`Refused: "${rawUrl}" is not a valid URL.`, 400);
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (current.protocol !== 'https:') throw new SourceNetworkError(`Refused: "${current.href}" is not HTTPS.`, 403);
    if (!allow.includes(current.hostname)) {
      throw new SourceNetworkError(`Refused: host "${current.hostname}" is not in the ${providerId} allowlist.`, 403);
    }
    await assertReachableHost(current.hostname, lookupImpl);

    // One abort timer covers the whole hop - the fetch AND the body read - so a
    // server that sends headers fast then trickles the body cannot hang this.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      let response: Response;
      try {
        response = await fetchImpl(current.href, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': 'SW2D-Workbench (local authoring)',
            ...(options.accept ? { accept: options.accept } : {}),
          },
        });
      } catch (error) {
        throw new SourceNetworkError(
          controller.signal.aborted
            ? `Provider request timed out after ${options.timeoutMs}ms.`
            : `Provider request failed: ${error instanceof Error ? error.message : String(error)}.`,
          504,
        );
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new SourceNetworkError(`Provider redirect (${response.status}) had no Location.`, 502);
        try {
          current = new URL(location, current);
        } catch {
          throw new SourceNetworkError(`Provider redirect Location "${location}" is not a valid URL.`, 502);
        }
        continue;
      }

      if (!response.ok) throw new SourceNetworkError(`Provider returned HTTP ${response.status}.`, 502);

      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
      const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
      if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
        throw new SourceNetworkError(`Provider response is ${declaredLength} bytes, over the ${options.maxBytes}-byte cap.`, 413);
      }

      const body = response.body;
      if (!body) throw new SourceNetworkError('Provider response had no body.', 502);

      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          total += value.byteLength;
          if (total > options.maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new SourceNetworkError(`Provider response exceeded the ${options.maxBytes}-byte cap.`, 413);
          }
          chunks.push(value);
        }
      } catch (error) {
        if (error instanceof SourceNetworkError) throw error;
        throw new SourceNetworkError(
          controller.signal.aborted
            ? `Provider response stalled and timed out after ${options.timeoutMs}ms.`
            : `Provider response read failed: ${error instanceof Error ? error.message : String(error)}.`,
          504,
        );
      }

      const bytes = new Uint8Array(total);
      let cursor = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, cursor);
        cursor += chunk.byteLength;
      }
      return { bytes, contentType, finalUrl: current.href };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new SourceNetworkError(`Provider exceeded ${maxRedirects} redirects.`, 502);
}

/** Cheap reachability probe for a provider's primary host - used for the "online" flag, never for control flow. */
export async function providerOnline(providerId: string, options?: { fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<boolean> {
  const hosts = PROVIDER_HOST_ALLOWLIST[providerId];
  if (!hosts || hosts.length === 0) return false;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 4000);
  try {
    const response = await fetchImpl(`https://${hosts[0]}/`, { method: 'HEAD', redirect: 'manual', signal: controller.signal });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
