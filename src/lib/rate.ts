type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  const ok = b.count <= limit;
  const retryAfter = ok ? 0 : b.reset - now;
  return { ok, remaining: Math.max(0, limit - b.count), retryAfter };
}

export function clientKeyFromRequest(req: Request, prefix = "rl") {
  const cf = req.headers.get("cf-connecting-ip");
  const xff = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = cf?.trim() || xff?.split(",")[0]?.trim() || realIp?.trim() || "local";
  return `${prefix}:${ip}`;
}
