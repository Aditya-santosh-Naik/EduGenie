import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number with K/M suffix */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Calculate XP needed for next level */
export function xpForLevel(level: number): number {
  return level * 500;
}

/** Get badge display info */
export function getBadgeInfo(id: string): { name: string; icon: string; description: string } {
  const badges: Record<string, { name: string; icon: string; description: string }> = {
    first_steps: { name: 'First Steps', icon: '🌱', description: 'Earned 100 XP' },
    scholar: { name: 'Scholar', icon: '📚', description: 'Earned 500 XP' },
    expert: { name: 'Expert', icon: '🎓', description: 'Earned 1,000 XP' },
    master: { name: 'Master', icon: '🏆', description: 'Earned 2,500 XP' },
    week_streak: { name: 'Week Warrior', icon: '🔥', description: '7-day study streak' },
    month_streak: { name: 'Unstoppable', icon: '⚡', description: '30-day study streak' }
  };
  return badges[id] || { name: id, icon: '🏅', description: 'Achievement unlocked' };
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
