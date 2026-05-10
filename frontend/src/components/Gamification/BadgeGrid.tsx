import { motion } from 'framer-motion';
import { useGamificationStore } from '../../store/gamificationStore';
import { getBadgeInfo } from '../../lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

export default function BadgeGrid() {
  const { badges } = useGamificationStore();

  const allBadges = [
    'first_steps',
    'scholar',
    'expert',
    'master',
    'week_streak',
    'month_streak'
  ];

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {allBadges.map((badgeId, i) => {
          const earned = badges.some((b) => b.id === badgeId);
          const info = getBadgeInfo(badgeId);

          return (
            <Tooltip.Root key={badgeId}>
              <Tooltip.Trigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex flex-col items-center gap-2 rounded-xl p-3 transition-all ${
                    earned
                      ? 'bg-accent-500/10 border border-accent-500/20'
                      : 'bg-white/[0.02] border border-white/5 opacity-40 grayscale'
                  }`}
                >
                  <span className="text-2xl">{info.icon}</span>
                  <span className="text-[10px] font-medium text-center leading-tight">
                    {info.name}
                  </span>
                </motion.div>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="z-50 rounded-lg bg-bg-800 px-3 py-2 text-xs text-text-main shadow-xl border border-white/10"
                sideOffset={5}
              >
                <p className="font-medium">{info.name}</p>
                <p className="text-text-muted">{info.description}</p>
                {earned && (
                  <p className="mt-1 text-accent-400">
                    ✓ Earned {badges.find((b) => b.id === badgeId)?.earnedAt || ''}
                  </p>
                )}
                <Tooltip.Arrow className="fill-bg-800" />
              </Tooltip.Content>
            </Tooltip.Root>
          );
        })}
      </div>
    </Tooltip.Provider>
  );
}
