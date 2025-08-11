import type { VercelRequest, VercelResponse } from '@vercel/node';

// Allowed origins: localhost/127.0.0.1, *.vercel.app, babysim.fun (and subdomains)
const ORIGIN_REGEX = /^(https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|[a-z0-9-]+\.vercel\.app|([a-z0-9-]+\.)*babysim\.fun))$/i;

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true; // allow non-browser (server-to-server) calls
  try {
    return ORIGIN_REGEX.test(origin);
  } catch {
    return false;
  }
}

export function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers['origin'] as string) || '';
  const allow = isOriginAllowed(origin);
  if (allow && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    applyCors(req, res);
    res.status(200).end();
    return true;
  }
  return false;
}

// Very simple in-memory per-IP token bucket limiter for serverless (best-effort)
type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  key: string,
  maxPerMinute: number
): boolean {
  const now = Date.now();
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.socket as any)?.remoteAddress || 'unknown';
  const mapKey = `${key}:${ip}`;
  const bucket = buckets.get(mapKey) || { tokens: maxPerMinute, updatedAt: now };
  // Refill
  const elapsed = (now - bucket.updatedAt) / 60000; // minutes
  const refill = Math.floor(elapsed * maxPerMinute);
  bucket.tokens = Math.min(maxPerMinute, bucket.tokens + (refill > 0 ? refill : 0));
  if (refill > 0) bucket.updatedAt = now;
  if (bucket.tokens <= 0) {
    applyCors(req, res);
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'rate_limited' });
    buckets.set(mapKey, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(mapKey, bucket);
  return true;
}


