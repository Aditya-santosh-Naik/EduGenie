import { createMiddleware } from 'hono/factory';
import { v4 as uuidv4 } from 'uuid';

// Simple auth middleware — extracts userId from Authorization header or generates anonymous ID
// For a local-first app, this provides user isolation without requiring a full auth system

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    // Extract userId from token (simple base64-encoded JSON for local use)
    try {
      const token = authHeader.slice(7);
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      c.set('userId', decoded.userId as string);
    } catch {
      c.set('userId', `anon_${uuidv4().slice(0, 8)}`);
    }
  } else {
    // Anonymous user — generate a session-scoped ID
    const existingId = c.req.header('X-User-Id');
    c.set('userId', existingId || `anon_${uuidv4().slice(0, 8)}`);
  }

  await next();
});
