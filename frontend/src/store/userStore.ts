import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  userId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  /** Bind local data (XP, graph, cache) to the signed-in account. */
  setIdentity: (userId: string, displayName: string) => void;
}

// Note: uuid is listed in package.json but not installed in frontend.
// Using crypto.randomUUID() as a browser-native alternative.
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userId: generateId(),
      displayName: 'Student',
      setDisplayName: (displayName) => set({ displayName }),
      setIdentity: (userId, displayName) => set({ userId, displayName })
    }),
    { name: 'edugenie-user' }
  )
);
