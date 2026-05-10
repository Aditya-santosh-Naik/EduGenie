import { motion } from 'framer-motion';
import { FileText, Image, BookOpen, Video } from 'lucide-react';
import { useSessionStore, type ExplanationMode } from '../../store/sessionStore';
import { cn } from '../../lib/utils';

const modes: Array<{ value: ExplanationMode; label: string; icon: typeof FileText; description: string }> = [
  { value: 'text', label: 'Text', icon: FileText, description: 'Detailed written explanation' },
  { value: 'images', label: 'Images', icon: Image, description: 'Visual diagrams & images' },
  { value: 'story', label: 'Story', icon: BookOpen, description: 'Learn through a story' },
  { value: 'story+video', label: 'Video', icon: Video, description: 'Story with animated video' }
];

export default function ModeSelector() {
  const { mode, setMode } = useSessionStore();

  return (
    <div className="flex gap-2">
      {modes.map(({ value, label, icon: Icon, description }) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          className={cn(
            'relative flex flex-col items-center gap-1 rounded-xl px-4 py-3 text-xs transition-all duration-200',
            mode === value
              ? 'bg-accent-500/20 text-accent-400'
              : 'text-text-muted hover:bg-white/5 hover:text-text-main'
          )}
          title={description}
        >
          <Icon size={18} />
          <span className="font-medium">{label}</span>
          {mode === value && (
            <motion.div
              layoutId="mode-indicator"
              className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-accent-400"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
