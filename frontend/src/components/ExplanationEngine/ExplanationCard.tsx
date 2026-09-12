import { motion } from 'framer-motion';
import { BookOpen, Image, ArrowRight, Save, Check, RefreshCw, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSessionStore, ExplanationMode } from '../../store/sessionStore';
import { useExplain } from '../../hooks/useExplain';
import { db } from '../../lib/db';
import DiagramRenderer from './DiagramRenderer';
import ReadAloud from '../Voice/ReadAloud';
import PrerequisitePrompt from '../common/PrerequisitePrompt';

const IMAGE_STYLES = [
  { value: 'illustration', label: 'Illustration' },
  { value: 'cartoon', label: 'Cartoon' },
  { value: 'diagram', label: 'Diagram' }
] as const;

function InlineImage({ imageId, images }: { imageId: string, images: Array<{ id: string; prompt: string }> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<string>('illustration');
  const image = images.find(img => img.id === imageId);

  if (!image) return null;

  // Images are only ever generated on an explicit click — a picture costs the
  // GPU well over a minute, so it is never produced speculatively.
  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { api } = await import('../../lib/api');
      setUrl(await api.image.generate(image.prompt, style));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-white/10 bg-bg-800/50">
      {url ? (
        <div>
          <img src={url} alt={image.prompt} className="w-full h-auto object-cover" loading="lazy" />
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <p className="text-xs text-text-muted line-clamp-1">{image.prompt}</p>
            <button
              onClick={generate}
              disabled={loading}
              className="btn-ghost shrink-0 px-2 py-1 text-xs"
            >
              Regenerate
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 flex flex-col items-center justify-center gap-3">
          {loading ? (
            <>
              <RefreshCw size={24} className="animate-spin text-accent-400" />
              <p className="text-sm text-text-muted">Generating visual summary...</p>
              <p className="text-xs text-text-muted/70">This takes about a minute on a 6GB GPU.</p>
            </>
          ) : (
            <>
              <Image size={24} className="text-text-muted" />
              <p className="text-sm text-center text-text-muted max-w-md">{image.prompt}</p>

              <div className="flex gap-1 rounded-lg bg-bg-900/60 p-1">
                {IMAGE_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                      style === s.value
                        ? 'bg-accent-500/20 text-accent-400'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-danger text-xs bg-danger/10 rounded-lg px-3 py-2 text-center max-w-md">
                  {error}
                </p>
              )}
              <button onClick={generate} className="btn-primary px-4 py-2 mt-1">
                {error ? 'Try Again' : 'Generate Image'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ExplanationData {
  explanationText?: string;
  diagram?: { type: string; code: string };
  images?: Array<{ id: string; prompt: string }>;
  quiz?: Array<Record<string, unknown>>;
  applications?: string[];
  nextSteps?: Array<{ title: string; topic: string; level: string; why: string }>;
  prerequisites?: { required: boolean; topics: string[] };
  error?: string;
  _raw?: boolean;
}

/**
 * The model writes ordinary markdown inside each line — bold terms, the odd
 * italic or code span. The renderer below handles block structure (headings,
 * bullets) but printed these inline markers literally, so definitions arrived
 * as "**Bioluminescence Doubling**". Split the line into nodes instead of
 * injecting HTML, so nothing the model emits can become markup.
 */
function renderInline(text: string): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={j} className="font-semibold text-text-main">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code key={j} className="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={j}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
}

export default function ExplanationCard() {
  const navigate = useNavigate();
  const { currentTopic, explanation, isLoading, streamedText, mood, mode, setMode, setLevel, setTopic } = useSessionStore();
  const { explain } = useExplain();
  const data = explanation as ExplanationData | null;
  const [savedFlashcards, setSavedFlashcards] = useState(false);
  const [flashcardError, setFlashcardError] = useState<string | null>(null);
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

  /** Follow a suggested next step: switch topic + level, then explain it. */
  const startNextStep = (step: { topic: string; level: string }) => {
    const level = step.level as 'beginner' | 'intermediate' | 'advanced';
    if (['beginner', 'intermediate', 'advanced'].includes(level)) setLevel(level);
    setTopic(step.topic);
    explain(step.topic);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveFlashcards = async () => {
    if (!data?.explanationText || savedFlashcards) return;

    const text = data.explanationText;
    const strip = (v: string) => v.replace(/\*\*/g, '').trim();

    const newCard = (front: string, back: string) => ({
      front,
      back,
      topic: currentTopic,
      createdAt: Date.now(),
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      nextReview: Date.now()
    });

    const cards: ReturnType<typeof newCard>[] = [];

    // Preferred shape: bullet points under '## Key Concepts'.
    const keyConcepts = text.match(/## Key Concepts\n([\s\S]*?)(?=\n## |$)/i);
    if (keyConcepts) {
      for (const bullet of keyConcepts[1].split('\n').filter((l) => l.trim().startsWith('-'))) {
        const raw = bullet.replace(/^\s*-/, '').trim();
        const [front, ...rest] = raw.split(':');
        cards.push(newCard(strip(front), rest.length ? strip(rest.join(':')) : strip(raw)));
      }
    }

    // The model usually writes prose under headings rather than bullets, which
    // produced zero cards and a button that silently did nothing. Fall back to
    // one card per section: the heading asks, the paragraph answers.
    if (cards.length === 0) {
      const sections = [...text.matchAll(/^##\s+(.+?)\n([\s\S]*?)(?=\n##\s|$)/gm)];
      for (const [, heading, body] of sections) {
        const answer = strip(body).replace(/\[IMAGE_PLACEHOLDER_\w+\]/g, '').trim();
        // Skip framing sections — the model writes them as "Introduction to X"
        // / "Summary of X", which make poor revision cards.
        if (!answer || /^(introduction|summary|conclusion)\b/i.test(heading.trim())) continue;
        cards.push(newCard(strip(heading), answer.slice(0, 600)));
      }
    }

    if (cards.length === 0) {
      setFlashcardError('Could not find anything to turn into flashcards.');
      return;
    }

    await db.flashcards.bulkAdd(cards);
    setFlashcardError(null);
    setSavedFlashcards(true);
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
    // The schema asks for explanationText as a string, but a small model
    // sometimes streams it as a nested object of sections. Show whatever prose
    // has arrived either way — a live preview that says "Initializing" for the
    // whole generation is worse than no preview at all.
    const extractExplanationText = (raw: string) => {
      const asString = raw.match(/"explanationText"\s*:\s*"((?:\\"|[^"])*)/);
      if (asString) {
        return asString[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }

      const asObject = raw.indexOf('"explanationText"');
      if (asObject !== -1 && raw.slice(asObject).includes('{')) {
        // Pull the quoted section bodies out of the partial object in order.
        const sections = [...raw.slice(asObject).matchAll(/"((?:\\"|[^"]){40,})/g)];
        if (sections.length) {
          return sections
            .map((m) => m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'))
            .join('\n\n');
        }
      }

      return raw.includes('"explanationText"') ? 'Writing the explanation…' : '';
    };
    const displayStream = extractExplanationText(streamedText);

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
          {displayStream || '...'}
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
        <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warn-light flex items-center gap-2">
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
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              {/* Any '## ' section can become a card, so the button is offered
                  whenever the explanation has headings — not only when the
                  model happened to emit a '## Key Concepts' section. */}
              {data.explanationText?.includes('## ') && (
                <button
                  onClick={saveFlashcards}
                  disabled={savedFlashcards}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    savedFlashcards
                      ? 'bg-success/20 text-success'
                      : 'bg-accent-500/20 text-accent-400 hover:bg-accent-500/30'
                  }`}
                >
                  {savedFlashcards ? <Check size={14} /> : <Save size={14} />}
                  {savedFlashcards ? 'Saved to Deck' : 'Save Flashcards'}
                </button>
              )}
              {data.explanationText && <ReadAloud text={data.explanationText} />}
            </div>
            {flashcardError && (
              <p className="text-danger text-xs">{flashcardError}</p>
            )}
          </div>
        </div>

        {/* Render explanation with heading support */}
        <div className="prose prose-invert max-w-none">
          {data.explanationText?.split('\n').map((line, i) => {
            if (line.includes('[IMAGE_PLACEHOLDER_')) {
              const match = line.match(/\[IMAGE_PLACEHOLDER_(.*?)\]/);
              if (match) {
                 return <InlineImage key={i} imageId={match[1]} images={data.images || []} />;
              }
            }
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

            const bullet = line.match(/^\s*[-*]\s+(.*)$/);
            if (bullet) {
              return (
                <div key={i} className="mb-2 flex gap-2 text-sm leading-relaxed text-text-main/85">
                  <span aria-hidden="true" className="select-none text-accent-400">
                    •
                  </span>
                  <span>{renderInline(bullet[1])}</span>
                </div>
              );
            }

            return (
              <p key={i} className="mb-2 text-sm leading-relaxed text-text-main/85">
                {renderInline(line)}
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

      {/* Continue learning — the student always has a next move from here */}
      {data.nextSteps && data.nextSteps.length > 0 && (
        <div className="glass-card p-6">
          <div className="mb-1 flex items-center gap-2">
            <GraduationCap size={18} className="text-accent-400" />
            <h3 className="text-base font-semibold text-accent-400">Continue learning</h3>
          </div>
          <p className="mb-4 text-xs text-text-muted">
            Pick what to study next — it keeps your learning path going.
          </p>
          <div className="grid gap-2">
            {data.nextSteps.map((step, i) => (
              <button
                key={`${step.topic}-${i}`}
                onClick={() => startNextStep(step)}
                disabled={isLoading}
                className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02]
                           p-3 text-left transition-colors hover:border-accent-500/40
                           hover:bg-accent-500/5 disabled:opacity-50"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center
                                 rounded-full bg-accent-500/20 text-xs font-bold text-accent-400">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-main">{step.title}</span>
                  {step.why && (
                    <span className="mt-0.5 block text-xs text-text-muted">{step.why}</span>
                  )}
                </span>
                <span className="mt-0.5 shrink-0 rounded-full bg-bg-900/60 px-2 py-0.5 text-[10px]
                                 uppercase tracking-wide text-text-muted">
                  {step.level}
                </span>
                <ArrowRight
                  size={16}
                  className="mt-1 shrink-0 text-text-muted transition-colors group-hover:text-accent-400"
                />
              </button>
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
