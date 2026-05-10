import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { useExplain } from '../hooks/useExplain';
import ExplanationCard from '../components/ExplanationEngine/ExplanationCard';
import ModeSelector from '../components/ExplanationEngine/ModeSelector';
import VoiceInput from '../components/Voice/VoiceInput';
import { cn } from '../lib/utils';

const levels = [
  { value: 'beginner' as const, label: '🌱 Beginner' },
  { value: 'intermediate' as const, label: '📘 Intermediate' },
  { value: 'advanced' as const, label: '🎓 Advanced' }
];

export default function Learn() {
  const { currentTopic, level, setTopic, setLevel, explanation } = useSessionStore();
  const { explain, isLoading } = useExplain();
  const [inputValue, setInputValue] = useState(currentTopic);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setTopic(inputValue.trim());
    explain(inputValue.trim());
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero section — only shown before first explanation */}
      {!explanation && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="mb-3 text-4xl font-bold">
            What do you want to{' '}
            <span className="gradient-text">learn</span> today?
          </h1>
          <p className="text-text-muted">
            Ask any topic — I'll explain it with clarity, diagrams, and quizzes
          </p>
        </motion.div>
      )}

      {/* Search form */}
      <form onSubmit={handleSubmit} className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              id="learn-search-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g., Photosynthesis, Newton's Laws, DNA replication..."
              className="input-field pl-10"
              autoFocus
            />
          </div>
          <VoiceInput onTranscript={(t) => { setInputValue(t); setTopic(t); }} />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="btn-primary flex items-center gap-2"
          >
            <Sparkles size={16} />
            {isLoading ? 'Generating...' : 'Explain'}
          </button>
        </div>

        {/* Mode + Level selectors */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <ModeSelector />
          <div className="flex gap-1 rounded-xl bg-bg-800/60 p-1">
            {levels.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setLevel(value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  level === value
                    ? 'bg-accent-500/20 text-accent-400'
                    : 'text-text-muted hover:text-text-main'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Explanation output */}
      <ExplanationCard />
    </div>
  );
}
