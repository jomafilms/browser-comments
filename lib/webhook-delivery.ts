import { createHmac } from 'crypto';
import { isIP } from 'net';
import { lookup } from 'dns/promises';

// Webhook delivery primitives: HMAC signing, SSRF guarding, and a single-retry
// fetch. No queue infra by design — guaranteed delivery is the consumer's job
// (they poll `?since=` as the safety net). See docs/AGENT-SETUP.md.

const DELIVERY_TIMEOUT_MS = 5000;
const SIGNATURE_HEADER = 'X-BC-Signature';
const EVENT_HEADER = 'X-BC-Event';

// The one sanctioned "private" target: a loopback host. Lets self-hosters run
// an agent receiver on the same box (and powers the local acceptance test).
// Every other private/internal range is rejected as SSRF.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Loopback targets are allowed by default (self-hosters run a receiver on the
// same box; the local acceptance test needs it). A hosted deployment can set
// WEBHOOK_ALLOW_LOOPBACK=false to forbid tenants pointing hooks at the server's
// own loopback.
function loopbackAllowed(): boolean {
  return process.env.WEBHOOK_ALLOW_LOOPBACK !== 'false';
}

// HMAC-SHA256 of the exact bytes we send, hex-encoded. Header value is
// `sha256=<hex>` so the scheme is explicit and future-proof.
export function signBody(secret: string, rawBody: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
}

// Cheap synchronous check for the registration path: https anywhere, http only
// for loopback. Rejects junk before it ever reaches the DB.
export function validateWebhookUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }
  if (url.protocol === 'https:') return { ok: true, url };
  if (url.protocol === 'http:' && loopbackAllowed() && LOOPBACK_HOSTS.has(url.hostname)) return { ok: true, url };
  return { ok: false, reason: 'Webhook URL must be https (http allowed only for localhost)' };
}

function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → treat as unsafe
  const [a, b] = p;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // private
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local + cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast + reserved
  );
}

// Expand any IPv6 literal (incl. `::` compression and a trailing dotted-quad)
// to its 16 bytes, or null if unparseable. We must fully parse rather than
// string-match, because ::ffff:a9fe:a9fe (hex) and ::ffff:169.254.169.254
// (dotted) are the SAME address — a substring check catches only one form.
function ipv6ToBytes(ip: string): number[] | null {
  let s = ip.split('%')[0]; // drop any zone id
  // Fold a trailing IPv4 dotted-quad into two hex groups
  const dotted = s.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) {
    const q = dotted.slice(1).map(Number);
    if (q.some((n) => n > 255)) return null;
    s = s.slice(0, dotted.index) + ((q[0] << 8) | q[1]).toString(16) + ':' + ((q[2] << 8) | q[3]).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const g of groups) {
    const n = parseInt(g || '0', 16);
    if (Number.isNaN(n) || n < 0 || n > 0xffff) return null;
    bytes.push((n >> 8) & 0xff, n & 0xff);
  }
  return bytes;
}

function ipv6IsPrivate(ip: string): boolean {
  const b = ipv6ToBytes(ip);
  if (!b) return true; // unparseable → unsafe
  const embeddedV4 = () => `${b[12]}.${b[13]}.${b[14]}.${b[15]}`;
  const zeros = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);

  if (zeros(0, 15) && b[15] === 1) return true; // ::1 loopback
  if (zeros(0, 16)) return true; // :: unspecified
  // ::ffff:0:0/96 IPv4-mapped → judge the embedded v4
  if (zeros(0, 10) && b[10] === 0xff && b[11] === 0xff) return ipv4IsPrivate(embeddedV4());
  // ::/96 IPv4-compatible (deprecated) with a real v4 → judge the embedded v4
  if (zeros(0, 12) && !zeros(12, 16)) return ipv4IsPrivate(embeddedV4());
  // 64:ff9b::/96 NAT64 → judge the embedded v4
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zeros(4, 12))
    return ipv4IsPrivate(embeddedV4());
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  return false;
}

function ipIsPrivate(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4IsPrivate(ip);
  if (kind === 6) return ipv6IsPrivate(ip);
  return true; // not a recognizable IP → unsafe
}

// Delivery-time SSRF guard: resolve the host and reject if it points at any
// private/internal range. Loopback hosts are the deliberate exception. Called
// right before the request so DNS-rebinding can't slip a public name through
// registration and resolve to metadata at fire time.
// Residual: this resolves the host, but fetch() resolves again on connect, so a
// low-TTL attacker domain could answer public here and private at connect time
// (DNS rebinding). Pinning the vetted IP needs a custom dispatcher (undici),
// which isn't available here. Redirect-following is closed (redirect:'manual'),
// and the `?since=` poll is the delivery safety-net, so the residual is narrow.
export async function assertPublicUrl(url: URL): Promise<void> {
  if (loopbackAllowed() && LOOPBACK_HOSTS.has(url.hostname)) return; // sanctioned local target

  const host = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (isIP(host)) {
    if (ipIsPrivate(host)) throw new Error('Webhook target resolves to a private address');
    return;
  }

  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0) throw new Error('Webhook host does not resolve');
  for (const { address } of addresses) {
    if (ipIsPrivate(address)) throw new Error('Webhook target resolves to a private address');
  }
}

async function postOnce(url: string, rawBody: string, headers: Record<string, string>): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    // redirect:'manual' so a public target can't 302 us into a private/internal
    // address (assertPublicUrl only vetted the original URL). A 3xx is returned
    // as-is and treated as a non-2xx (not-delivered) by the caller.
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: controller.signal,
      redirect: 'manual',
    });
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}

// Deliver one signed payload. Returns the HTTP status of the last attempt, or 0
// on a network error/timeout/SSRF rejection. One retry after a failed first
// attempt (non-2xx or thrown); no dead-letter queue.
export async function deliverWebhook(
  targetUrl: string,
  secret: string,
  event: string,
  rawBody: string
): Promise<number> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [SIGNATURE_HEADER]: signBody(secret, rawBody),
    [EVENT_HEADER]: event,
  };

  const attempt = async (): Promise<number> => {
    await assertPublicUrl(new URL(targetUrl));
    return postOnce(targetUrl, rawBody, headers);
  };

  try {
    const status = await attempt();
    if (status >= 200 && status < 300) return status;
    // Retry once on a non-2xx response.
    try {
      return await attempt();
    } catch {
      return status; // keep the first real HTTP status if the retry threw
    }
  } catch {
    // First attempt threw (network/timeout/SSRF) — one retry, then give up.
    try {
      return await attempt();
    } catch {
      return 0;
    }
  }
}
