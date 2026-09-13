import { useEffect } from 'react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';

// Local auth against the EduGenie backend — no cloud provider. The session
// token lives in the persisted auth store.

/** Restores the saved session. Mounted once, by AuthProvider in App.tsx. */
export function useAuthBootstrap() {
  const { setSession, setHydrated, logout } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { token } = useAuthStore.getState();

      if (!token) {
        if (!cancelled) setHydrated(true);
        return;
      }

      try {
        const user = await authApi.me(token);
        if (cancelled) return;
        setSession(user, token);
        useUserStore.getState().setIdentity(user.uid, user.displayName);
      } catch {
        // Token expired, secret rotated, or account deleted — start signed out.
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);
}

export function useAuth() {
  const { setSession, setLoading, logout } = useAuthStore();

  const applySession = (session: { user: AuthResult['user']; token: string }) => {
    setSession(session.user, session.token);
    useUserStore.getState().setIdentity(session.user.uid, session.user.displayName);
  };

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      applySession(await authApi.login(email, password));
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      applySession(await authApi.register(email, password, name));
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = async () => {
    setLoading(true);
    try {
      applySession(await authApi.guest());
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    logout();
  };

  return { loginWithEmail, signupWithEmail, continueAsGuest, logoutUser };
}

type AuthResult = Awaited<ReturnType<typeof authApi.login>>;
