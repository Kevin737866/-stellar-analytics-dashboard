import { isIP } from 'node:net';

// Issue #422: only honour X-Forwarded-For when the API sits behind a known
// number of trusted proxies, and only accept syntactically valid IPs.
// TRUST_PROXY_HOPS=0 (default) ignores the header entirely so clients cannot
// spoof their address to dodge rate limits.
export const TRUST_PROXY_HOPS = Math.max(0, Number(process.env.TRUST_PROXY_HOPS ?? 0) || 0);

function normalize(ip: string | undefined): string | null {
  if (!ip) return null;
  let value = ip.trim();
  if (value.startsWith('[') && value.includes(']')) value = value.slice(1, value.indexOf(']'));
  if (value.startsWith('::ffff:') && isIP(value.slice(7)) === 4) value = value.slice(7);
  return isIP(value) ? value : null;
}

export function getClientIp(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
  trustedHops: number = TRUST_PROXY_HOPS
): string {
  const remote = normalize(remoteAddress) ?? 'unknown';
  if (trustedHops <= 0 || !forwardedFor) return remote;

  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  const chain = header.split(',').map((part) => part.trim());
  // The rightmost `trustedHops - 1` entries were appended by our own proxies;
  // the entry just before them is the client as seen by the outermost proxy.
  const index = chain.length - trustedHops;
  if (index < 0) return remote;
  return normalize(chain[index]) ?? remote;
}
