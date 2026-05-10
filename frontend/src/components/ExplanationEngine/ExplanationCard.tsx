import { motion } from 'framer-motion';
import { BookOpen, Image, ArrowRight, Save, Check, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSessionStore, ExplanationMode } from '../../store/sessionStore';
import { useExplain } from '../../hooks/useExplain';
import { db } from '../../lib/db';
import DiagramRenderer from './DiagramRenderer';
import ImageGallery from './ImageGallery';
import ReadAloud from '../Voice/ReadAloud';
import PrerequisitePrompt from '../common/PrerequisitePrompt';

interface ExplanationData {
  explanationText?: string;
  diagram?: { type: string; code: string };
  images?: Array<{ id: string; prompt: string }>;
  quiz?: Array<Record<string, unknown>>;
  applications?: string[];
  prerequisites?: { required: boolean; topics: string[] };
  error?: string;
  _raw?: boolean;
}

export default function ExplanationCard() {
  const navigate = useNavigate();
  const { currentTopic, explanation, isLoading, streamedText, mood, mode, setMode, setLevel, setTopic } = useSessionStore();
  const { explain } = useExplain();
  const data = explanation as ExplanationData | null;
  const [savedFlashcards, setSavedFlashcards] = useState(false);
  const [acknowledgedPrereqs, setAcknowledgedPrereqs] = useState(false);

  // Reset prereq state when topic changes
  useEffect(() => {
    setAcknowledgedPrereqs(false);
  }, [currentTopic]);

  // Auto-trigger when frustrated
  useEffect(() => {
    if (mood === 'frustrated' && !isLoading && data) {
      handleExplainDifferently();
    }
  }, [mood]);

  const handleExplainDifferently = () => {
    const modes: ExplanationMode[] = ['text', 'images', 'story', 'story+video'];
    const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length];
    setMode(nextMode);
    setLevel('beginner');
    explain();
  };

  const saveFlashcards = async () => {
    if (!data?.explanationText || savedFlashcards) return;

    // Parse '## Key Concepts' section
    const match = data.explanationText.match(/## Key Concepts\n([\s\S]*?)(?=\n## |\Z)/i);
    if (!match) return;

    const bullets = match[1].split('\n').filter(l => l.trim().startsWith('-'));
    const cards = bullets.map(b => {
      const raw = b.replace(/^-/, '').trim();
      const [front, ...backParts] = raw.split(':');
      const back = backParts.length > 0 ? backParts.join(':').trim() : raw.replace(/\*\*/g, '').trim();
      return {
        front: front.replace(/\*\*/g, '').trim(),
        back: back,
        topic: currentTopic,
        createdAt: Date.now(),
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        nextReview: Date.now()
      };
    });

    if (cards.length > 0) {
      await db.flashcards.bulkAdd(cards);
      setSavedFlashcards(true);
    }
  };

  // Loading skeleton
  if (isLoading && !streamedText) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 space-y-4"
      >
        <div className="skeleton h-8 w-3/4" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-32 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </motion.div>
    );
  }

  // Streaming state — show raw text as it arrives
  if (isLoading && streamedText) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-accent-400 animate-pulse" />
          <span className="text-sm text-text-muted">Generating explanation...</span>
        </div>
        <div className="prose prose-invert max-w-none text-sm leading-relaxed text-text-main/80 font-mono whitespace-pre-wrap">
          {streamedText}
        </div>
      </motion.div>
    );
  }

  if (!data) return null;

  if (data.prerequisites?.required && !acknowledgedPrereqs && data.prerequisites.topics.length > 0) {
    return (
      <PrerequisitePrompt
        topics={data.prerequisites.topics}
        onAccept={() => setAcknowledgedPrereqs(true)}
        onTopicClick={(topic) => {
          setTopic(topic);
          explain(topic);
        }}
      />
    );
  }

  if (data.error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card border-danger/20 p-6"
      >
        <p className="text-danger">{data.error}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Mood Banner */}
      {mood === 'frustrated' && (
        <div className="rounded-xl border border-warn/20 bg-warn/10 px-4 py-3 text-sm text-warn-light flex items-center gap-2">
          <RefreshCw size={16} className="animate-spin-slow" />
          <span>I notice you're struggling. Let me try a completely different approach...</span>
        </div>
      )}

      {/* Main Explanation */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-accent-400" />
            <h2 className="text-lg font-semibold">Explanation</h2>
          </div>
          <div className="flex gap-2">
            {data.explanationText && data.explanationText.includes('## Key Concepts') && (
              <button
                onClick={saveFlashcards}
                disabled={savedFlashcards}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  savedFlashcards ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary hover:bg-primary/30'
                }`}
              >
                {savedFlashcards ? <Check size={14} /> : <Save size={14} />}
                {savedFlashcards ? 'Saved to Deck' : 'Save Flashcards'}
              </button>
            )}
            {data.explanationText && <ReadAloud text={data.explanationText} />}
          </div>
        </div>

        {/* Render explanation with heading support */}
        <div className="prose prose-invert max-w-none">
          {data.explanationText?.split('\n').map((line, i) => {
            if (line.startsWith('## ')) {
              return (
                <h3 key={i} className="mt-6 mb-2 text-lg font-semibold text-accent-400">
                  {line.slice(3)}
                </h3>
              );
            }
            if (line.startsWith('### ')) {
              return (
                <h4 key={i} className="mt-4 mb-1 text-base font-medium text-text-main">
                  {line.slice(4)}
                </h4>
              );
            }
            if (line.trim() === '') return <br key={i} />;
            return (
              <p key={i} className="mb-2 text-sm leading-relaxed text-text-main/85">
                {line}
              </p>
            );
          })}
        </div>
      </div>

      {/* Diagram */}
      {data.diagram?.code && (
        <div className="glass-card p-6">
          <h3 className="mb-4 text-base font-semibold text-accent-400">Concept Diagram</h3>
          <DiagramRenderer type={data.diagram.type} code={data.diagram.code} />
        </div>
      )}

      {/* Images */}
      {data.images && data.images.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="mb-4 text-base font-semibold text-accent-400">Visual Aids</h3>
          <ImageGallery images={data.images} />
        </div>
      )}

      {/* Applications */}
      {data.applications && data.applications.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="mb-4 text-base font-semibold text-accent-400">Real-World Applications</h3>
          <div className="grid gap-2">
            {data.applications.map((app, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg bg-white/[0.02] p-3"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-xs font-bold text-accent-400">
                  {i + 1}
                </span>
                <p className="text-sm text-text-main/80">{app}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-8 border-t border-white/5 pt-6">
        <button
          onClick={handleExplainDifferently}
          disabled={isLoading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Explain Differently
        </button>
        {data.quiz && data.quiz.length > 0 && (
          <button
            onClick={() => navigate('/quiz')}
            className="btn-primary flex items-center gap-2"
          >
            Take Quiz <ArrowRight size={16} />
          </button>
        )}
        <button
          onClick={() => {
            const { currentTopic } = useSessionStore.getState();
            if (currentTopic) {
              // Trigger video generation via the API
              import('../../lib/api').then(({ api: apiClient }) => {
                apiClient.media.generateVideo(currentTopic);
              });
            }
          }}
          className="btn-ghost flex items-center gap-2 border border-white/10"
        >
          <Image size={16} />
          Generate Video
        </button>
      </div>
    </motion.div>
  );
}
