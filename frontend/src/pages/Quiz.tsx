import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Loader2, Plus } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { useQuiz } from '../hooks/useQuiz';
import { streamQuiz } from '../lib/api';
import QuizCard from '../components/QuizEngine/QuizCard';
import QuizResult from '../components/QuizEngine/QuizResult';

export default function Quiz() {
  const { explanation, currentTopic, level } = useSessionStore();
  const {
    quizState,
    currentQuestion,
    currentAnswer,
    showExplanation,
    startQuiz,
    submitAnswer,
    nextQuestion,
    resetQuiz
  } = useQuiz();
  const [isGenerating, setIsGenerating] = useState(false);
  const [topicInput, setTopicInput] = useState(currentTopic);
  const [questionCount, setQuestionCount] = useState(5);
  const [error, setError] = useState('');

  // If explanation has quiz data, use it directly
  useEffect(() => {
    const expData = explanation as { quiz?: Array<Record<string, unknown>> } | null;
    if (expData?.quiz && expData.quiz.length > 0 && quizState.questions.length === 0) {
      startQuiz(expData.quiz as any);
    }
  }, [explanation]);

  /**
   * @param exclude questions already seen — set when asking for MORE questions
   *                on the same topic, so the model doesn't repeat itself.
   */
  const handleGenerateQuiz = async (exclude?: string) => {
    if (!topicInput.trim()) return;
    setIsGenerating(true);
    setError('');
    let fullText = '';

    try {
      for await (const event of streamQuiz(topicInput, level, questionCount, exclude)) {
        if (event.type === 'token') fullText += event.data;
      }

      const parsed = JSON.parse(fullText);
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        resetQuiz();
        startQuiz(parsed.questions);
      } else {
        setError('The quiz came back empty. Please try again.');
      }
    } catch (err) {
      console.error('Quiz generation failed:', err);
      setError('Could not generate the quiz. Is the backend running?');
    } finally {
      setIsGenerating(false);
    }
  };

  /** Keep practising the same topic with a fresh, non-repeating set. */
  const handleMoreQuestions = () =>
    handleGenerateQuiz(quizState.questions.map((q) => q.question).join('\n'));

  // Show result if quiz is complete
  if (quizState.isComplete) {
    return (
      <div className="mx-auto max-w-2xl">
        <QuizResult
          score={quizState.score}
          totalQuestions={quizState.questions.length}
          totalXP={quizState.totalXP}
          onRetry={() => {
            resetQuiz();
            startQuiz(quizState.questions);
          }}
        />

        {/* Keep practising the same topic with fresh questions */}
        <div className="glass-card mt-4 p-5">
          <h3 className="mb-1 text-sm font-semibold text-accent-400">Keep practising</h3>
          <p className="mb-4 text-xs text-text-muted">
            Generate a new set on “{topicInput || currentTopic}” — questions you've already
            answered won't be repeated.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <QuestionCountPicker value={questionCount} onChange={setQuestionCount} />
            <button
              onClick={handleMoreQuestions}
              disabled={isGenerating}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {isGenerating ? (
                <><Loader2 size={15} className="animate-spin" /> Generating...</>
              ) : (
                <><Plus size={15} /> More questions</>
              )}
            </button>
            <button onClick={resetQuiz} className="btn-secondary text-sm">
              New topic
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-danger">{error}</p>}
        </div>
      </div>
    );
  }

  // Show quiz card if we have questions
  if (currentQuestion) {
    return (
      <div className="mx-auto max-w-2xl">
        <QuizCard
          question={currentQuestion}
          questionIndex={quizState.currentIndex}
          totalQuestions={quizState.questions.length}
          answer={currentAnswer}
          showExplanation={showExplanation}
          onSelectAnswer={submitAnswer}
          onNext={nextQuestion}
        />
      </div>
    );
  }

  // No quiz loaded — show generator
  return (
    <div className="mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 text-center"
      >
        <Brain size={40} className="mx-auto mb-4 text-accent-400" />
        <h1 className="mb-2 text-2xl font-bold">Quiz Time!</h1>
        <p className="mb-6 text-text-muted">
          Test your knowledge with AI-generated questions
        </p>

        <div className="mx-auto max-w-md space-y-4">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="Enter a topic to quiz on..."
            className="input-field text-center"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateQuiz()}
          />
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-text-muted">Questions:</span>
            <QuestionCountPicker value={questionCount} onChange={setQuestionCount} />
          </div>

          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
          )}

          <button
            onClick={() => handleGenerateQuiz()}
            disabled={isGenerating || !topicInput.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating Quiz...
              </>
            ) : (
              'Generate Quiz'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/** Question-count control: quick presets plus any number from 1 to 20. */
function QuestionCountPicker({
  value,
  onChange
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-bg-800/60 p-1">
      {[3, 5, 10, 15].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
            value === n ? 'bg-accent-500/20 text-accent-400' : 'text-text-muted hover:text-text-main'
          }`}
        >
          {n}
        </button>
      ))}
      <input
        type="number"
        min={1}
        max={20}
        value={value}
        onChange={(e) => onChange(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
        aria-label="Number of questions"
        className="w-14 rounded-lg bg-bg-900/60 px-2 py-1 text-center text-xs text-text-main
                   outline-none focus:ring-1 focus:ring-accent-500"
      />
    </div>
  );
}
