import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAuth } from '../../hooks/useAuth';

export function UserMenu() {
  const { user } = useAuthStore();
  const { logoutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const initials = user.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-panel hover:bg-bg-800
                   border border-white/5 rounded-xl px-3 py-1.5
                   transition-all"
      >
        {/* Avatar */}
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName ?? 'User'}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-accent flex items-center
                          justify-center text-xs font-semibold text-white">
            {user.isGuest ? <User size={14} /> : initials}
          </div>
        )}

        <span className="text-sm text-text-main max-w-[100px] truncate hidden sm:block">
          {user.isGuest ? 'Guest' : (user.displayName ?? user.email ?? 'Student')}
        </span>
        <ChevronDown size={14} className="text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 bg-bg-800
                       border border-white/8 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* User info */}
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-sm font-medium text-text-main truncate">
                {user.isGuest ? 'Guest Student' : (user.displayName ?? 'Student')}
              </p>
              <p className="text-xs text-muted truncate">
                {user.isGuest ? 'Progress not saved' : user.email}
              </p>
            </div>

            {/* Guest upgrade prompt */}
            {user.isGuest && (
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-xs text-warn mb-2">
                  Create an account to save your progress, XP, and streaks.
                </p>
                <a
                  href="/login"
                  className="text-xs text-accent hover:underline"
                >
                  Create free account →
                </a>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={async () => { setOpen(false); await logoutUser(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm
                         text-muted hover:text-danger hover:bg-danger/5
                         transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
