import { NextRequest, NextResponse } from 'next/server';

// Fixed-window in-memory rate limiter. Best-effort on Vercel: each function
// instance keeps its own counters, so real enforcement needs a WAF rule —
// see docs/RATE-LIMITING.md. Zero dependencies by design.

const WINDOW_MS = 60_000;
const SWEEP_EVERY_MS = 5 * 60_000;

// Overridable via env so limits aren't hardcoded (rate per minute).
const LIMITS = {
  write: parseInt(process.env.RATE_LIMIT_WRITE_PER_MIN || '20', 10),
  read: parseInt(process.env.RATE_LIMIT_READ_PER_MIN || '60', 10),
};

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) buckets.delete(key);
  }
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || 'unknown';
}

// Returns null when allowed, or the 429 response to send back.
// `key` scopes the counter beyond IP (widget key, token, route name).
export function checkRateLimit(
  request: NextRequest,
  key: string,
  kind: 'write' | 'read',
  extraHeaders?: Record<string, string>
): NextResponse | null {
  const now = Date.now();
  sweep(now);

  const bucketKey = `${kind}:${clientIp(request)}:${key}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(bucketKey, { count: 1, windowStart: now });
    return null;
  }

  bucket.count++;
  if (bucket.count <= LIMITS[kind]) return null;

  const retryAfter = Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000);
  return NextResponse.json(
    { error: 'Too many requests. Please try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter), ...extraHeaders } }
  );
}

// Reject oversized bodies before parsing. Content-Length can be absent on
// chunked requests — this is a cheap first line, not a guarantee.
export function checkBodySize(
  request: NextRequest,
  maxBytes: number,
  extraHeaders?: Record<string, string>
): NextResponse | null {
  const length = parseInt(request.headers.get('content-length') || '0', 10);
  if (length > maxBytes) {
    return NextResponse.json(
      { error: 'Request body too large' },
      { status: 413, headers: extraHeaders }
    );
  }
  return null;
}
