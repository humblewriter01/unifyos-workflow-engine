type Entry = { count: number; resetAt: number };

const entries = new Map<string, Entry>();

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = entries.get(key);

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count <= limit) return { allowed: true, retryAfterSeconds: 0 };

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
  };
}

export function getRequestIp(req: { headers: { [key: string]: string | string[] | undefined }; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return firstForwarded?.trim() || req.socket?.remoteAddress || 'unknown';
}
