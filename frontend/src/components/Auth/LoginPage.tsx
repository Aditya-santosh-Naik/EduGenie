import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginForm } from './LoginForm';
import { GoogleButton } from './GoogleButton';
import { GuestButton } from './GuestButton';

export function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');

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
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center
                          justify-content center mx-auto mb-4">
            <span className="text-2xl">✦</span>
          </div>
          <h1 className="text-2xl font-semibold text-text-main">
            Welcome to EduGenie
          </h1>
          <p className="text-muted text-sm mt-1">
            Your personal AI tutor — learn anything, your way
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-800 border border-white/5 rounded-2xl p-6">

          {/* Tab switcher */}
          <div className="flex bg-panel rounded-xl p-1 mb-6">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                  ${tab === t
                    ? 'bg-accent text-white shadow'
                    : 'text-muted hover:text-text-main'
                  }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Google */}
          <GoogleButton />

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-muted text-xs">or</span>
            <div className="flex-1 h-px bg-white/5" />
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

        <p className="text-center text-muted text-xs mt-4">
          Your learning data stays on your device. No ads. No tracking.
        </p>
      </motion.div>
    </div>
  );
}
