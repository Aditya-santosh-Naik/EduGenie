import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  uid:         string;
  email:       string | null;
  displayName: string | null;
  photoURL:    string | null;
  isGuest:     boolean;
  idToken:     string | null;   // refreshed Firebase ID token
  createdAt:   string;
}

interface AuthState {
  user:         AuthUser | null;
  isLoading:    boolean;
  isHydrated:   boolean;
  setUser:      (user: AuthUser | null) => void;
  setLoading:   (v: boolean) => void;
  setHydrated:  (v: boolean) => void;
  updateToken:  (token: string) => void;
  logout:       () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:        null,
      isLoading:   true,
      isHydrated:  false,

      setUser:     (user)    => set({ user, isLoading: false }),
      setLoading:  (v)       => set({ isLoading: v }),
      setHydrated: (v)       => set({ isHydrated: v }),
      updateToken: (token)   => set((s) => ({
        user: s.user ? { ...s.user, idToken: token } : null
      })),
      logout: () => set({ user: null, isLoading: false }),
    }),
    {
      name:    'edugenie-auth',
      version: 1,
      // Only persist non-sensitive fields — token is always refreshed on load
      partialize: (s) => ({
        user: s.user
          ? { ...s.user, idToken: null }  // never persist token to localStorage
          : null
      })
    }
  )
);
