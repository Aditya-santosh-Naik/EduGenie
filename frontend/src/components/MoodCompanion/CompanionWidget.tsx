import { motion } from 'framer-motion';
import { useSessionStore, type Mood } from '../../store/sessionStore';
import { useExplain } from '../../hooks/useExplain';
import MoodIndicator from './MoodIndicator';

const MOOD_CONFIG: Record<Mood, { message: string; seed: string }> = {
  neutral: {
    message: "Ask me anything — I'll teach it clearly.",
    seed: 'edugenie-neutral'
  },
  confident: {
    message: "You're doing great! Keep going! 🚀",
    seed: 'edugenie-happy'
  },
  confused: {
    message: "Let's slow down. Try a simpler explanation?",
    seed: 'edugenie-confused'
  },
  frustrated: {
    message: 'Take a breath. Let me explain it differently. 💙',
    seed: 'edugenie-sad'
  }
};

export default function CompanionWidget() {
  const { mood, currentTopic, setLevel } = useSessionStore();
  const { explain } = useExplain();
  const config = MOOD_CONFIG[mood];

  const handleSimplify = () => {
    setLevel('beginner');
    if (currentTopic) {
      explain(currentTopic);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {/* DiceBear Avatar */}
        <motion.div
          animate={{
            scale: mood === 'confident' ? [1, 1.05, 1] : 1
          }}
          transition={{ duration: 2, repeat: mood === 'confident' ? Infinity : 0 }}
          className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-accent-500/30"
        >
          <img
            src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${config.seed}`}
            alt="Companion"
            className="h-full w-full"
          />
        </motion.div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Genie</span>
            <MoodIndicator mood={mood} />
          </div>
          <p className="mt-0.5 text-xs text-text-main/80">{config.message}</p>
        </div>
      </div>

      {/* Simplify button — shown when confused or frustrated */}
      {(mood === 'confused' || mood === 'frustrated') && currentTopic && (
        <motion.button
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleSimplify}
          className="w-full rounded-lg bg-accent-500/15 px-3 py-2 text-xs font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
        >
          ✨ Simplify this explanation
        </motion.button>
      )}
    </div>
  );
}
