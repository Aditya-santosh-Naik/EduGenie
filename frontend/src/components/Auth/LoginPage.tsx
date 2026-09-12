import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { LoginForm } from './LoginForm';
import { GuestButton } from './GuestButton';

export function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const user = useAuthStore((s) => s.user);

  // Signing in (or continuing as guest) lands the student in the app.
  if (user) return <Navigate to="/learn" replace />;

  return (
    <div className="min-h-screen bg-bg-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent-500 flex items-center
                          justify-center mx-auto mb-4">
            <span className="text-2xl">✦</span>
          </div>
          <h1 className="text-2xl font-semibold text-text-main">
            Welcome to EduGenie
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Your personal AI tutor — learn anything, your way
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-800 border border-white/5 rounded-2xl p-6">

          {/* Tab switcher */}
          <div className="flex bg-bg-panel rounded-xl p-1 mb-6">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                  ${tab === t
                    ? 'bg-accent-500 text-white shadow'
                    : 'text-text-muted hover:text-text-main'
                  }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Email form */}
          <AnimatePresence mode="wait">
            <LoginForm key={tab} mode={tab} />
          </AnimatePresence>

          {/* Guest */}
          <div className="mt-4">
            <GuestButton />
          </div>
        </div>

        <p className="text-center text-text-muted text-xs mt-4">
          Your learning data stays on your device. No ads. No tracking.
        </p>
      </motion.div>
    </div>
  );
}
