import type { Mood } from '../../store/sessionStore';

const moodDisplay: Record<Mood, { emoji: string; label: string; color: string }> = {
  neutral: { emoji: '😊', label: 'Ready', color: 'text-text-muted' },
  confident: { emoji: '🤩', label: 'Confident', color: 'text-success' },
  confused: { emoji: '🤔', label: 'Confused', color: 'text-warning' },
  frustrated: { emoji: '😤', label: 'Struggling', color: 'text-danger' }
};

export default function MoodIndicator({ mood }: { mood: Mood }) {
  const { emoji, label, color } = moodDisplay[mood];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] ${color}`}>
      {emoji} {label}
    </span>
  );
}
