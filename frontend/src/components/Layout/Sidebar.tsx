import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Clock, BookOpen } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import CompanionWidget from '../MoodCompanion/CompanionWidget';
import { cn } from '../../lib/utils';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [elapsed, setElapsed] = useState('0:00');
  const { sessionStart, currentTopic } = useSessionStore();

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - sessionStart) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  // Collapse on mobile by default
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.matches) setIsOpen(false);
  }, []);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="relative flex h-full flex-col overflow-hidden border-r border-white/5 bg-bg-panel"
          >
            {/* Toggle button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-2 top-3 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text-main"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Session Timer */}
            <div className="border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Clock size={14} />
                <span>Session: {elapsed}</span>
              </div>
            </div>

            {/* Current Topic */}
            {currentTopic && (
              <div className="border-b border-white/5 px-5 py-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                  <BookOpen size={12} />
                  Currently Studying
                </div>
                <p className="mt-1 text-sm font-medium text-text-main">{currentTopic}</p>
              </div>
            )}

            {/* Recent Topics */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
                Suggested Topics
              </h3>
              <div className="mt-3 space-y-1">
                {['Photosynthesis', 'Newton\'s Laws', 'Cell Division', 'World War II', 'Algebra Basics', 'The Solar System'].map(
                  (topic) => (
                    <button
                      key={topic}
                      onClick={() => useSessionStore.getState().setTopic(topic)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        currentTopic === topic
                          ? 'bg-accent-500/15 text-accent-400'
                          : 'text-text-muted hover:bg-white/5 hover:text-text-main'
                      )}
                    >
                      {topic}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Companion Widget */}
            <div className="border-t border-white/5 p-4">
              <CompanionWidget />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Collapsed toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 z-50 rounded-full bg-accent-500 p-3 text-white shadow-lg shadow-accent-500/30 transition-transform hover:scale-110 md:static md:m-2 md:rounded-xl md:shadow-none"
        >
          <ChevronLeft size={18} className="rotate-180" />
        </button>
      )}
    </>
  );
}
