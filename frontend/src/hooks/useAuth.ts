import { useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { useAuthStore, AuthUser } from '../store/authStore';

// Convert Firebase User → our AuthUser shape
async function toAuthUser(firebaseUser: User): Promise<AuthUser> {
  const token = await firebaseUser.getIdToken();
  return {
    uid:         firebaseUser.uid,
    email:       firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL:    firebaseUser.photoURL,
    isGuest:     firebaseUser.isAnonymous,
    idToken:     token,
    createdAt:   new Date().toISOString(),
  };
}

// Create or update Firestore user profile
async function ensureUserProfile(firebaseUser: User) {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:         firebaseUser.uid,
      email:       firebaseUser.email,
      displayName: firebaseUser.displayName ?? 'Student',
      photoURL:    firebaseUser.photoURL,
      isGuest:     firebaseUser.isAnonymous,
      role:        'student',
      createdAt:   serverTimestamp(),
      xp:          0,
      level:       1,
      streak:      0,
    });
  }
}

export function useAuth() {
  const { setUser, setLoading, setHydrated, updateToken, logout } = useAuthStore();

  // Listen to Firebase auth state on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await toAuthUser(firebaseUser);
        await ensureUserProfile(firebaseUser);
        setUser(user);

        // Refresh token every 55 minutes (Firebase tokens expire at 60 min)
        const interval = setInterval(async () => {
          const freshToken = await firebaseUser.getIdToken(true);
          updateToken(freshToken);
        }, 55 * 60 * 1000);

        setHydrated(true);
        return () => clearInterval(interval);
      } else {
        logout();
        setHydrated(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      setUser(await toAuthUser(user));
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (
    email: string,
    password: string,
    name: string
  ) => {
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      await ensureUserProfile(user);
      setUser(await toAuthUser(user));
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(user);
      setUser(await toAuthUser(user));
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = async () => {
    setLoading(true);
    try {
      const { user } = await signInAnonymously(auth);
      setUser(await toAuthUser(user));
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    await signOut(auth);
    logout();
  };

  return {
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    continueAsGuest,
    logoutUser
  };
}
