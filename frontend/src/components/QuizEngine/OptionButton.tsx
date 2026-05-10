import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface OptionButtonProps {
  label: string;
  index: number;
  isSelected: boolean;
  isCorrect: boolean;
  isRevealed: boolean;
  onSelect: () => void;
}

const letters = ['A', 'B', 'C', 'D'];

export default function OptionButton({
  label,
  index,
  isSelected,
  isCorrect,
  isRevealed,
  onSelect
}: OptionButtonProps) {
  const getStyle = () => {
    if (!isRevealed) {
      return isSelected
        ? 'border-accent-500 bg-accent-500/10'
        : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]';
    }
    if (isCorrect) return 'border-success bg-success/10';
    if (isSelected && !isCorrect) return 'border-danger bg-danger/10';
    return 'border-white/5 opacity-50';
  };

  return (
    <motion.button
      onClick={onSelect}
      disabled={isRevealed}
      whileHover={!isRevealed ? { scale: 1.01 } : {}}
      whileTap={!isRevealed ? { scale: 0.99 } : {}}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200',
        getStyle()
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
          isRevealed && isCorrect
            ? 'bg-success/20 text-success'
            : isRevealed && isSelected
            ? 'bg-danger/20 text-danger'
            : 'bg-white/10 text-text-muted'
        )}
      >
        {letters[index]}
      </span>
      <span className="text-sm">{label}</span>
    </motion.button>
  );
}
