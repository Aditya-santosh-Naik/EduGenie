// Durable store for XP, levels, streaks and badges.
//
// Redis is the fast path when it is running, but it is optional in this
// deployment and previously its absence meant progress silently evaporated on
// every restart — the one kind of data a learner actually notices losing. So
// disk is the source of truth and Redis, when present, is a cache in front of
// it.

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { redis, redisAvailable } from './cache.js';

export interface GamificationProfile {
  xp: number;
  level: number;
  streak: number;
  badges: string[];
  lastStudied: string | null;
}

export const DEFAULT_PROFILE: GamificationProfile = {
  xp: 0,
  level: 1,
  streak: 0,
  badges: [],
  lastStudied: null
};

const DATA_DIR = path.resolve(process.cwd(), '.data');
const PROFILES_FILE = path.join(DATA_DIR, 'progress.json');

type ProfileMap = Record<string, GamificationProfile>;

let cache: ProfileMap | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<ProfileMap> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(PROFILES_FILE, 'utf8')) as ProfileMap;
  } catch {
    cache = {};
  }
  return cache;
}

/** Serialised so two concurrent XP awards can't lose one another's write. */
function persist(): Promise<void> {
  writeChain = writeChain.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${PROFILES_FILE}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(tmp, JSON.stringify(cache ?? {}, null, 2), 'utf8');
    await rename(tmp, PROFILES_FILE);
  });
  return writeChain;
}

export async function getProfile(userId: string): Promise<GamificationProfile> {
  if (redisAvailable) {
    try {
      const hit = await redis.get(`gamification:${userId}`);
      if (hit) return JSON.parse(hit) as GamificationProfile;
    } catch {
      /* fall through to disk */
    }
  }

  const profiles = await load();
  return profiles[userId] ? { ...profiles[userId] } : { ...DEFAULT_PROFILE };
}

export async function saveProfile(userId: string, profile: GamificationProfile): Promise<void> {
  const profiles = await load();
  profiles[userId] = profile;
  await persist();

  if (redisAvailable) {
    try {
      await redis.set(`gamification:${userId}`, JSON.stringify(profile), 'EX', 2592000);
    } catch {
      /* disk already holds it — Redis is only the fast path */
    }
  }
}
