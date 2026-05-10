import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, Clock } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';

const BREAK_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes
const SNOOZE_MS = 15 * 60 * 1000; // 15 minutes
const AUTO_DISMISS_MS = 30 * 1000; // 30 seconds

export default function BreakReminder() {
  const { sessionStart } = useSessionStore();
  const [showToast, setShowToast] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const effectiveStart = snoozeUntil || sessionStart;
      
      if (now - effectiveStart >= BREAK_THRESHOLD_MS && !showToast) {
        setShowToast(true);
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [sessionStart, snoozeUntil, showToast]);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (showToast) {
      timeout = setTimeout(() => {
        handleSnooze(); // Auto-snooze if ignored
      }, AUTO_DISMISS_MS);
    }
    return () => clearTimeout(timeout);
  }, [showToast]);

  const handleSnooze = () => {
    setShowToast(false);
    setSnoozeUntil(Date.now() - (BREAK_THRESHOLD_MS - SNOOZE_MS));
  };

  const handleDismiss = () => {
    setShowToast(false);
    // Restart the 45-minute timer from now
    setSnoozeUntil(Date.now());
  };

  return (
    <AnimatePresence>
      {showToast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[100] w-[350px] overflow-hidden rounded-2xl border border-accent-500/20 bg-bg-800/95 p-5 shadow-2xl shadow-accent-500/10 backdrop-blur-xl"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-accent-400">
              <Brain size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-text-main">Time for a break!</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                You've been studying for 45 minutes. A 5-minute break boosts retention by 20%.
              </p>
              
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleSnooze}
                  className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-light hover:text-text-main"
                >
                  <Clock size={12} />
                  Snooze 15m
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-lg bg-accent-500/20 px-3 py-1.5 text-xs font-medium text-accent-400 transition-colors hover:bg-accent-500/30"
                >
                  I'll take a break
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="absolute right-4 top-4 text-text-muted hover:text-text-main"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
