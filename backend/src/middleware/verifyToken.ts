import { createMiddleware } from 'hono/factory';
import { admin } from '../services/firebaseAdmin.js';

export const verifyToken = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized — missing token' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // Attach uid to context for downstream route handlers
    c.set('uid', decoded.uid);
    c.set('email', decoded.email ?? null);
    await next();
  } catch (err) {
    return c.json({ error: 'Unauthorized — invalid or expired token' }, 401);
  }
});
