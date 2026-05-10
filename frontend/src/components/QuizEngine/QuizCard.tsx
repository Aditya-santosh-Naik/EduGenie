import { motion } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import OptionButton from './OptionButton';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  correctExplanation: string;
}

interface QuizCardProps {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  answer: { selectedIndex: number; correct: boolean } | null;
  showExplanation: boolean;
  onSelectAnswer: (index: number) => void;
  onNext: () => void;
}

export default function QuizCard({
  question,
  questionIndex,
  totalQuestions,
  answer,
  showExplanation,
  onSelectAnswer,
  onNext
}: QuizCardProps) {
  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="glass-card p-6"
    >
      {/* Progress dots */}
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: totalQuestions }, (_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i < questionIndex
                ? 'bg-accent-500'
                : i === questionIndex
                ? 'bg-accent-400'
                : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Question number */}
      <div className="mb-2 text-xs font-medium text-text-muted">
        Question {questionIndex + 1} of {totalQuestions}
      </div>

      {/* Question text */}
      <h3 className="mb-6 text-lg font-semibold text-text-main">{question.question}</h3>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option, i) => (
          <OptionButton
            key={i}
            label={option}
            index={i}
            isSelected={answer?.selectedIndex === i}
            isCorrect={i === question.answerIndex}
            isRevealed={!!answer}
            onSelect={() => onSelectAnswer(i)}
          />
        ))}
      </div>

      {/* Explanation & Next button */}
      {showExplanation && answer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-4"
        >
          <div
            className={`flex items-start gap-3 rounded-xl p-4 ${
              answer.correct ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'
            }`}
          >
            {answer.correct ? (
              <CheckCircle size={20} className="shrink-0 text-success mt-0.5" />
            ) : (
              <XCircle size={20} className="shrink-0 text-danger mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${answer.correct ? 'text-success' : 'text-danger'}`}>
                {answer.correct ? 'Correct! +25 XP' : 'Not quite right. +5 XP'}
              </p>
              <p className="mt-1 text-sm text-text-muted">{question.correctExplanation}</p>
            </div>
          </div>

          <button onClick={onNext} className="btn-primary flex items-center gap-2">
            Next Question
            <ArrowRight size={16} />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
