import { NextFunction, Request, Response } from 'express';
import { logSecurityEvent } from './securityAudit';

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function createRateLimiter(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count <= options.max) {
      next();
      return;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    logSecurityEvent(req, res, 'rate_limited', 'too_many_requests', { actor: `ip:${req.ip}` });
    res.status(429).json({
      code: 'rate_limited',
      message: 'Trop de tentatives, réessayez plus tard',
      retry_after: retryAfterSeconds,
    });
  };
}
