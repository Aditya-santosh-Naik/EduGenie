import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';

interface PrerequisitePromptProps {
  topics: string[];
  onTopicClick: (topic: string) => void;
  onAccept: () => void;
}

export default function PrerequisitePrompt({ topics, onTopicClick, onAccept }: PrerequisitePromptProps) {
  if (!topics || topics.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="glass-card overflow-hidden border-warn/30 bg-bg-800"
    >
      <div className="bg-warn/10 p-6 flex flex-col items-center text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warn/20 text-warn">
          <AlertTriangle size={24} />
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-text-main">Before we start...</h2>
          <p className="text-sm text-text-muted mt-2 max-w-md">
            This is an advanced topic. EduGenie recommends making sure you understand these fundamental concepts first:
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-4 w-full max-w-lg">
          {topics.map((topic, idx) => (
            <button
              key={idx}
              onClick={() => onTopicClick(topic)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface hover:bg-surface-light border border-white/5 transition-all text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg shadow-black/20"
            >
              {topic} <ChevronRight size={14} className="text-accent-400" />
            </button>
          ))}
        </div>

        <div className="w-full pt-6 mt-4 border-t border-warn/10 flex justify-center">
          <button
            onClick={onAccept}
            className="flex items-center gap-2 text-sm font-medium text-warn hover:text-warn-light transition-colors"
          >
            <CheckCircle2 size={16} />
            I already know these — continue anyway
          </button>
        </div>
      </div>
    </motion.div>
  );
}
