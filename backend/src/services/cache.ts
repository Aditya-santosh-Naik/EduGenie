import IORedis from 'ioredis';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.resolve('.cache');

const TTL = parseInt(process.env.CACHE_TTL_SECONDS || '86400');

// Create Redis with limited retries so backend doesn't crash if Redis is down
let redis: InstanceType<typeof IORedis.default>;
let redisAvailable = false;

try {
  redis = new IORedis.default(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    retryStrategy(times: number) {
      if (times > 3) {
        console.warn('[cache] Redis unavailable — running without cache');
        return null; // stop retrying
      }
      return Math.min(times * 500, 3000);
    },
    lazyConnect: true,
    enableOfflineQueue: false
  });

  redis.on('connect', () => {
    redisAvailable = true;
    console.log('[cache] Connected to Redis');
  });

  redis.on('error', () => {
    redisAvailable = false;
    // Silently handle — don't flood console
  });

  redis.on('close', () => {
    redisAvailable = false;
  });

  // Attempt connection but don't block startup
  redis.connect().catch(() => {
    console.warn('[cache] Redis not available — caching disabled');
  });
} catch {
  console.warn('[cache] Failed to initialize Redis — caching disabled');
  redis = null as unknown as InstanceType<typeof IORedis.default>;
}

function cacheKey(topic: string, mode: string, level: string): string {
  const normalizedTopic = topic.trim().toLowerCase();
  return `explain:${crypto.createHash('md5').update(`${normalizedTopic}:${mode}:${level}`).digest('hex')}`;
}

async function getLocalCachePath(key: string): Promise<string> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const safeKey = key.replace(/[^a-z0-9]/gi, '_');
  return path.join(CACHE_DIR, `${safeKey}.json`);
}

export async function getCached(topic: string, mode: string, level: string): Promise<unknown | null> {
  const key = cacheKey(topic, mode, level);
  if (!redisAvailable) {
    try {
      const p = await getLocalCachePath(key);
      const data = await fs.readFile(p, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
      return parsed.value;
    } catch {
      return null;
    }
  }
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function setCached(topic: string, mode: string, level: string, data: unknown): Promise<void> {
  const key = cacheKey(topic, mode, level);
  if (!redisAvailable) {
    try {
      const p = await getLocalCachePath(key);
      await fs.writeFile(p, JSON.stringify({ value: data, expiresAt: Date.now() + TTL * 1000 }), 'utf-8');
    } catch { /* non-critical */ }
    return;
  }
  try {
    await redis.setex(key, TTL, JSON.stringify(data));
  } catch {
    /* non-critical */
  }
}

export async function getKey(key: string): Promise<string | null> {
  if (!redisAvailable) {
    try {
      const p = await getLocalCachePath(key);
      const data = await fs.readFile(p, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
      return parsed.value;
    } catch {
      return null;
    }
  }
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function setKey(key: string, value: string, ttl?: number): Promise<void> {
  if (!redisAvailable) {
    try {
      const p = await getLocalCachePath(key);
      const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
      await fs.writeFile(p, JSON.stringify({ value, expiresAt }), 'utf-8');
    } catch { /* non-critical */ }
    return;
  }
  try {
    if (ttl) {
      await redis.setex(key, ttl, value);
    } else {
      await redis.set(key, value);
    }
  } catch {
    /* non-critical */
  }
}

export { redis, redisAvailable };
