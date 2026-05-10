import { motion } from 'framer-motion';
import { useGamificationStore } from '../../store/gamificationStore';

interface XPBarProps {
  compact?: boolean;
}

export default function XPBar({ compact = false }: XPBarProps) {
  const { xp, level } = useGamificationStore();
  const xpInLevel = xp % 500;
  const xpNeeded = 500;
  const progress = (xpInLevel / xpNeeded) * 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-500/20 text-xs font-bold text-accent-400">
          {level}
        </span>
        <div className="h-2 w-20 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <span className="text-xs text-text-muted">{xp} XP</span>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-lg font-bold text-white">
            {level}
          </div>
          <div>
            <p className="text-sm font-semibold">Level {level}</p>
            <p className="text-xs text-text-muted">{xp} total XP</p>
          </div>
        </div>
        <span className="text-xs text-text-muted">{xpInLevel}/{xpNeeded} XP</span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent-600 via-accent-500 to-accent-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <p className="mt-2 text-xs text-text-muted">
        {xpNeeded - xpInLevel} XP to level {level + 1}
      </p>
    </div>
  );
}
