import { createMiddleware } from 'hono/factory';

// Simple in-memory rate limiter — prevents abuse without external dependencies
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 60; // per window
const WINDOW_MS = 60_000; // 1 minute

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts) {
    if (now > value.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 300_000);

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const now = Date.now();

  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
    if (entry.count > MAX_REQUESTS) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ error: 'Too many requests. Please slow down.' }, 429);
    }
  }

  await next();
});
