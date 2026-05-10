import { useCallback } from 'react';
import { db, Flashcard } from '../lib/db';

export function useSRS() {
  const calculateNextReview = (
    card: Flashcard,
    rating: 1 | 2 | 3 // 1 = Hard, 2 = Good, 3 = Easy
  ) => {
    // Map simplified ratings to SM-2 qualities (0-5 scale)
    const qMap = { 1: 2, 2: 4, 3: 5 };
    const q = qMap[rating];

    let { interval = 0, repetition = 0, easeFactor = 2.5 } = card;

    if (q < 3) {
      // Incorrect / Hard
      repetition = 0;
      interval = 1;
    } else {
      // Correct
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetition += 1;
    }

    // Update ease factor
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    // Calculate next review timestamp (interval in days converted to ms)
    const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

    return { interval, repetition, easeFactor, nextReview };
  };

  const reviewCard = useCallback(async (cardId: number, rating: 1 | 2 | 3) => {
    const card = await db.flashcards.get(cardId);
    if (!card) return;

    const srsData = calculateNextReview(card, rating);
    await db.flashcards.update(cardId, srsData);
  }, []);

  return { reviewCard };
}
