import { Hono } from 'hono';
import { redis, redisAvailable } from '../services/cache.js';

const gamification = new Hono();

interface GamificationProfile {
  xp: number;
  level: number;
  streak: number;
  badges: string[];
  lastStudied: string | null;
}

const DEFAULT_PROFILE: GamificationProfile = {
  xp: 0,
  level: 1,
  streak: 0,
  badges: [],
  lastStudied: null
};

async function getProfile(userId: string): Promise<GamificationProfile> {
  if (!redisAvailable) return { ...DEFAULT_PROFILE };
  try {
    const data = await redis.get(`gamification:${userId}`);
    return data ? JSON.parse(data) : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

async function saveProfile(userId: string, profile: GamificationProfile): Promise<void> {
  if (!redisAvailable) return;
  try {
    await redis.set(`gamification:${userId}`, JSON.stringify(profile), 'EX', 2592000); // 30 days
  } catch { /* Redis down — skip save */ }
}

gamification.get('/profile/:userId', async (c) => {
  const userId = c.req.param('userId');
  const profile = await getProfile(userId);
  return c.json(profile);
});

gamification.post('/xp', async (c) => {
  const { userId, amount, reason } = await c.req.json();
  if (!userId || typeof amount !== 'number') {
    return c.json({ error: 'userId and amount required' }, 400);
  }

  const profile = await getProfile(userId);
  profile.xp += amount;
  profile.level = Math.floor(profile.xp / 500) + 1;
  profile.lastStudied = new Date().toISOString();

  // Award badges based on milestones
  const newBadges: string[] = [];
  const badgeRules: Array<{ id: string; condition: boolean }> = [
    { id: 'first_steps', condition: profile.xp >= 100 },
    { id: 'scholar', condition: profile.xp >= 500 },
    { id: 'expert', condition: profile.xp >= 1000 },
    { id: 'master', condition: profile.xp >= 2500 },
    { id: 'week_streak', condition: profile.streak >= 7 },
    { id: 'month_streak', condition: profile.streak >= 30 }
  ];

  for (const rule of badgeRules) {
    if (rule.condition && !profile.badges.includes(rule.id)) {
      profile.badges.push(rule.id);
      newBadges.push(rule.id);
    }
  }

  await saveProfile(userId, profile);
  return c.json({ profile, newBadges, xpAdded: amount, reason });
});

gamification.post('/streak', async (c) => {
  const { userId } = await c.req.json();
  if (!userId) return c.json({ error: 'userId required' }, 400);

  const profile = await getProfile(userId);
  const lastStudied = profile.lastStudied ? new Date(profile.lastStudied) : null;
  const today = new Date();
  
  let dayDiff: number | null = null;
  if (lastStudied) {
    const lastDate = new Date(lastStudied.getFullYear(), lastStudied.getMonth(), lastStudied.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    dayDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000);
  }

  if (dayDiff === 1) {
    profile.streak += 1;
  } else if (dayDiff === null || dayDiff > 1) {
    profile.streak = 1;
  }
  // dayDiff === 0 means same day — don't change streak

  profile.lastStudied = today.toISOString();
  await saveProfile(userId, profile);
  return c.json({ streak: profile.streak });
});

export { gamification };
