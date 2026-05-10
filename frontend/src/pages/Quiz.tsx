import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Loader2 } from 'lucide-react';
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

  // If explanation has quiz data, use it directly
  useEffect(() => {
    const expData = explanation as { quiz?: Array<Record<string, unknown>> } | null;
    if (expData?.quiz && expData.quiz.length > 0 && quizState.questions.length === 0) {
      startQuiz(expData.quiz as any);
    }
  }, [explanation]);

  const handleGenerateQuiz = async () => {
    if (!topicInput.trim()) return;
    setIsGenerating(true);
    let fullText = '';

    try {
      for await (const event of streamQuiz(topicInput, level)) {
        if (event.type === 'token') {
          fullText += event.data;
        }
      }

      const parsed = JSON.parse(fullText);
      if (parsed.questions) {
        startQuiz(parsed.questions);
      }
    } catch (err) {
      console.error('Quiz generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

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
          <button
            onClick={handleGenerateQuiz}
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
