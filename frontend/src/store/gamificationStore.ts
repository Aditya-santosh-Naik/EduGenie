import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Badge {
  id: string;
  name: string;
  icon: string;
  earnedAt: string;
}

interface GamificationState {
  xp: number;
  level: number;
  streak: number;
  badges: Badge[];
  topicsStudied: string[];
  quizzesTaken: number;
  correctAnswers: number;

  addXP: (amount: number) => void;
  addBadge: (badge: Badge) => void;
  recordTopic: (topic: string) => void;
  recordQuizResult: (correct: boolean) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
}

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set) => ({
      xp: 0,
      level: 1,
      streak: 0,
      badges: [],
      topicsStudied: [],
      quizzesTaken: 0,
      correctAnswers: 0,

      addXP: (amount) =>
        set((s) => {
          const newXP = s.xp + amount;
          const newLevel = Math.floor(newXP / 500) + 1;
          return { xp: newXP, level: newLevel };
        }),

      addBadge: (badge) =>
        set((s) => ({
          badges: s.badges.some((b) => b.id === badge.id)
            ? s.badges
            : [...s.badges, badge]
        })),

      recordTopic: (topic) =>
        set((s) => ({
          topicsStudied: s.topicsStudied.includes(topic)
            ? s.topicsStudied
            : [...s.topicsStudied, topic]
        })),

      recordQuizResult: (correct) =>
        set((s) => ({
          quizzesTaken: s.quizzesTaken + 1,
          correctAnswers: correct ? s.correctAnswers + 1 : s.correctAnswers
        })),

      incrementStreak: () => set((s) => ({ streak: s.streak + 1 })),
      resetStreak: () => set({ streak: 0 })
    }),
    { name: 'edugenie-gamification' }
  )
);
