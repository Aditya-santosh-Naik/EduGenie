import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  createUser,
  verifyCredentials,
  findById,
  toPublicUser,
  EmailTakenError,
  type PublicUser
} from '../services/userStore.js';

const auth = new Hono();

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — local app, long-lived session

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error('JWT_SECRET is missing or too short — set it in backend/.env');
  }
  return value;
}

async function issueToken(user: PublicUser): Promise<string> {
  return sign(
    {
      sub: user.uid,
      email: user.email,
      name: user.displayName,
      isGuest: user.isGuest,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
    },
    secret()
  );
}

const credentials = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(1, 'Please enter your name').optional()
});

auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = credentials.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid details' }, 400);
  }
  if (!parsed.data.name) {
    return c.json({ error: 'Please enter your name' }, 400);
  }

  try {
    const user = toPublicUser(
      await createUser(parsed.data.email, parsed.data.password, parsed.data.name)
    );
    return c.json({ token: await issueToken(user), user }, 201);
  } catch (err) {
    if (err instanceof EmailTakenError) return c.json({ error: err.message }, 409);
    throw err;
  }
});

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = credentials.omit({ name: true }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Incorrect email or password' }, 401);
  }

  const found = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!found) return c.json({ error: 'Incorrect email or password' }, 401);

  const user = toPublicUser(found);
  return c.json({ token: await issueToken(user), user });
});

// Guest sessions are token-only — nothing is written to disk, so progress
// genuinely does not survive sign-out. That matches what the UI promises.
auth.post('/guest', async (c) => {
  const user: PublicUser = {
    uid: `guest_${randomUUID().slice(0, 8)}`,
    email: null,
    displayName: 'Guest',
    isGuest: true,
    createdAt: new Date().toISOString()
  };
  return c.json({ token: await issueToken(user), user });
});

// Called on app start to confirm a persisted token is still valid.
auth.get('/me', async (c) => {
  const uid = c.get('uid');
  const isGuest = c.get('isGuest');

  if (!uid) return c.json({ error: 'Unauthorized' }, 401);

  if (isGuest) {
    return c.json({
      user: {
        uid,
        email: null,
        displayName: c.get('name') || 'Guest',
        isGuest: true,
        createdAt: new Date().toISOString()
      }
    });
  }

  const stored = await findById(uid);
  if (!stored) return c.json({ error: 'Account no longer exists' }, 401);
  return c.json({ user: toPublicUser(stored) });
});

export { auth };
