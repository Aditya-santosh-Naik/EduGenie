import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';

// Local JWT auth — replaces the old Firebase ID-token verification.
// Tokens are minted by /api/auth and signed with JWT_SECRET.

const PUBLIC_PATHS = ['/api/auth/register', '/api/auth/login', '/api/auth/guest'];

export const requireAuth = createMiddleware(async (c, next) => {
  if (PUBLIC_PATHS.includes(c.req.path)) return next();

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized — missing token' }, 401);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[auth] JWT_SECRET is not set — refusing to verify tokens');
    return c.json({ error: 'Server auth is not configured' }, 500);
  }

  try {
    const payload = await verify(authHeader.slice(7), secret, 'HS256');
    c.set('uid', payload.sub as string);
    c.set('email', (payload.email as string) ?? null);
    c.set('name', (payload.name as string) ?? null);
    c.set('isGuest', Boolean(payload.isGuest));
    await next();
  } catch {
    return c.json({ error: 'Unauthorized — invalid or expired token' }, 401);
  }
});
