import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  uid:         string;
  email:       string | null;
  displayName: string;
  isGuest:     boolean;
  createdAt:   string;
}

interface AuthState {
  user:        AuthUser | null;
  token:       string | null;
  isLoading:   boolean;
  isHydrated:  boolean;
  setSession:  (user: AuthUser, token: string) => void;
  setLoading:  (v: boolean) => void;
  setHydrated: (v: boolean) => void;
  logout:      () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:       null,
      token:      null,
      isLoading:  false,
      isHydrated: false,

      setSession:  (user, token) => set({ user, token, isLoading: false }),
      setLoading:  (v) => set({ isLoading: v }),
      setHydrated: (v) => set({ isHydrated: v }),
      logout:      () => set({ user: null, token: null, isLoading: false }),
    }),
    {
      name:    'edugenie-auth',
      version: 2,
      // The token is persisted deliberately: this is a local-first desktop app
      // and the backend runs on the same machine, so keeping the session across
      // reloads is the point. Nothing here leaves the device.
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);
