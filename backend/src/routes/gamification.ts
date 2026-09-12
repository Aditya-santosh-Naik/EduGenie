import { Hono } from 'hono';
import { getProfile, saveProfile } from '../services/progressStore.js';

const gamification = new Hono();

// The :userId segment is kept so existing clients keep working, but the
// profile returned is always the caller's own — reading or crediting someone
// else's progress must not be possible by changing a parameter.
gamification.get('/profile/:userId', async (c) => {
  return c.json(await getProfile(c.get('uid')));
});

gamification.post('/xp', async (c) => {
  const userId = c.get('uid');
  const { amount, reason } = await c.req.json();
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return c.json({ error: 'amount must be a number' }, 400);
  }
  // Clamp so a malformed or hostile client can't mint an arbitrary level.
  const award = Math.min(500, Math.max(0, Math.round(amount)));

  const profile = await getProfile(userId);
  profile.xp += award;
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
  return c.json({ profile, newBadges, xpAdded: award, reason });
});

gamification.post('/streak', async (c) => {
  const userId = c.get('uid');

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
