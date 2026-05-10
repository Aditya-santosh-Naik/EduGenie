import { motion } from 'framer-motion';
import { Trophy, Target, Zap, RotateCcw } from 'lucide-react';

interface QuizResultProps {
  score: number;
  totalQuestions: number;
  totalXP: number;
  onRetry: () => void;
}

export default function QuizResult({ score, totalQuestions, totalXP, onRetry }: QuizResultProps) {
  const accuracy = Math.round((score / totalQuestions) * 100);
  const isPerfect = score === totalQuestions;
  const isGreat = accuracy >= 75;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-8 text-center"
    >
      {/* Trophy/Result icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ${
          isPerfect
            ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
            : isGreat
            ? 'bg-gradient-to-br from-accent-400 to-accent-600'
            : 'bg-gradient-to-br from-blue-400 to-blue-600'
        }`}
      >
        <Trophy size={36} className="text-white" />
      </motion.div>

      {/* Title */}
      <h2 className="mb-2 text-2xl font-bold">
        {isPerfect ? '🎉 Perfect Score!' : isGreat ? 'Great Job!' : 'Keep Learning!'}
      </h2>
      <p className="mb-8 text-text-muted">
        {isPerfect
          ? "You've mastered this topic!"
          : isGreat
          ? 'You have a strong understanding of this topic.'
          : "Don't worry — practice makes perfect!"}
      </p>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white/[0.03] p-4">
          <Target size={20} className="mx-auto mb-2 text-accent-400" />
          <div className="text-2xl font-bold">{score}/{totalQuestions}</div>
          <div className="text-xs text-text-muted">Correct</div>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-4">
          <div className="mx-auto mb-2 text-xl">📊</div>
          <div className="text-2xl font-bold">{accuracy}%</div>
          <div className="text-xs text-text-muted">Accuracy</div>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-4">
          <Zap size={20} className="mx-auto mb-2 text-warning" />
          <div className="text-2xl font-bold text-warning">+{totalXP}</div>
          <div className="text-xs text-text-muted">XP Earned</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3">
        <button onClick={onRetry} className="btn-ghost flex items-center gap-2 border border-white/10">
          <RotateCcw size={16} />
          Try Again
        </button>
        <button
          onClick={() => window.location.assign('/learn')}
          className="btn-primary"
        >
          Study More Topics
        </button>
      </div>
    </motion.div>
  );
}
