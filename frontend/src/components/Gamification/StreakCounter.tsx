import { useGamificationStore } from '../../store/gamificationStore';

export default function StreakCounter() {
  const { streak } = useGamificationStore();

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5">
      <span className="text-sm">{streak > 0 ? '🔥' : '❄️'}</span>
      <span className="text-xs font-semibold text-text-main">{streak}</span>
      <span className="hidden text-[10px] text-text-muted sm:inline">
        day{streak !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
