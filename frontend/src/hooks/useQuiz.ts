import { useState, useCallback } from 'react';
import { useGamificationStore } from '../store/gamificationStore';
import { useSessionStore } from '../store/sessionStore';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  correctExplanation: string;
}

interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  answers: Array<{ selectedIndex: number; correct: boolean } | null>;
  isComplete: boolean;
  score: number;
  totalXP: number;
}

export function useQuiz() {
  const [quizState, setQuizState] = useState<QuizState>({
    questions: [],
    currentIndex: 0,
    answers: [],
    isComplete: false,
    score: 0,
    totalXP: 0
  });
  const [showExplanation, setShowExplanation] = useState(false);

  const { addXP, recordQuizResult } = useGamificationStore();
  const { incrementRetry, setMood } = useSessionStore();

  const startQuiz = useCallback((questions: QuizQuestion[]) => {
    setQuizState({
      questions,
      currentIndex: 0,
      answers: new Array(questions.length).fill(null),
      isComplete: false,
      score: 0,
      totalXP: 0
    });
    setShowExplanation(false);
  }, []);

  const submitAnswer = useCallback(
    (selectedIndex: number) => {
      setQuizState((prev) => {
        const question = prev.questions[prev.currentIndex];
        const correct = selectedIndex === question.answerIndex;
        const xpEarned = correct ? 25 : 5;

        const newAnswers = [...prev.answers];
        newAnswers[prev.currentIndex] = { selectedIndex, correct };

        // Track mood changes based on wrong answers
        if (!correct) {
          incrementRetry();
        } else {
          setMood('confident');
        }

        // Record quiz result in gamification store
        recordQuizResult(correct);
        addXP(xpEarned);

        return {
          ...prev,
          answers: newAnswers,
          score: prev.score + (correct ? 1 : 0),
          totalXP: prev.totalXP + xpEarned
        };
      });
      setShowExplanation(true);
    },
    [addXP, recordQuizResult, incrementRetry, setMood]
  );

  const nextQuestion = useCallback(() => {
    setShowExplanation(false);
    setQuizState((prev) => {
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.questions.length) {
        return { ...prev, isComplete: true };
      }
      return { ...prev, currentIndex: nextIndex };
    });
  }, []);

  const resetQuiz = useCallback(() => {
    setQuizState({
      questions: [],
      currentIndex: 0,
      answers: [],
      isComplete: false,
      score: 0,
      totalXP: 0
    });
    setShowExplanation(false);
  }, []);

  const currentQuestion = quizState.questions[quizState.currentIndex] || null;
  const currentAnswer = quizState.answers[quizState.currentIndex] || null;

  return {
    quizState,
    currentQuestion,
    currentAnswer,
    showExplanation,
    startQuiz,
    submitAnswer,
    nextQuestion,
    resetQuiz
  };
}
