import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { db } from '../../lib/db';
import {
  BookOpen, Trash2, Brain, ChevronLeft, ChevronRight, RotateCw
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSRS } from '../../hooks/useSRS';

type Deck = 'due' | 'all';

export default function FlashcardView() {
  const allCards = useLiveQuery(() => db.flashcards.toArray()) || [];
  const { reviewCard } = useSRS();

  const [deck, setDeck] = useState<Deck>('due');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const dueCards = useMemo(
    () => allCards.filter((c) => !c.nextReview || c.nextReview <= Date.now()),
    [allCards]
  );
  // 'all' lets a student revise a finished deck without waiting for the SRS
  // schedule — the common case the night before a test.
  const cards = deck === 'due' ? dueCards : allCards;

  // Keep the cursor inside the deck when it shrinks (a review removes a card
  // from the due list) or when switching decks.
  useEffect(() => {
    if (currentIndex >= cards.length) setCurrentIndex(cards.length > 0 ? cards.length - 1 : 0);
  }, [cards.length, currentIndex]);

  useEffect(() => { setIsFlipped(false); }, [currentIndex, deck]);

  const go = (delta: number) => {
    if (cards.length === 0) return;
    setCurrentIndex((prev) => (prev + delta + cards.length) % cards.length);
  };

  const clearDeck = async () => {
    if (confirm('Delete every flashcard in your deck?')) {
      await db.flashcards.clear();
      setCurrentIndex(0);
    }
  };

  const handleRate = async (rating: 1 | 2 | 3) => {
    const cardId = cards[currentIndex]?.id;
    if (!cardId) return;
    await reviewCard(cardId, rating);
    setIsFlipped(false);
    // Reviewing drops the card out of the due deck, so the same index already
    // points at the next card; in 'all' mode advance explicitly.
    if (deck === 'all') go(1);
  };

  if (allCards.length === 0) {
    return (
      <div className="mt-24 flex flex-col items-center justify-center space-y-4 text-text-muted">
        <BookOpen size={48} className="opacity-50" />
        <h2 className="text-xl font-semibold text-text-main">Your study deck is empty</h2>
        <p>Generate an explanation and click “Save Flashcards” to add concepts here.</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="mt-24 flex flex-col items-center justify-center space-y-4 text-text-muted">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success">
          <Brain size={32} />
        </div>
        <h2 className="text-2xl font-bold text-text-main">You're all caught up</h2>
        <p>Nothing is due for review right now.</p>
        <button onClick={() => setDeck('all')} className="btn-secondary px-4 py-2 text-sm">
          Revise all {allCards.length} cards anyway
        </button>
      </div>
    );
  }

  const card = cards[currentIndex];

  return (
    <div className="mx-auto mt-8 flex w-full max-w-2xl flex-col items-center space-y-6">
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Active Recall</h2>
          <p className="text-sm text-text-muted">Topic: {card.topic}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-bg-800/60 p-1">
            {(['due', 'all'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDeck(d)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  deck === d
                    ? 'bg-accent-500/20 text-accent-400'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {d === 'due' ? `Due (${dueCards.length})` : `All (${allCards.length})`}
              </button>
            ))}
          </div>
          <button
            onClick={clearDeck}
            className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/20"
          >
            <Trash2 size={16} />
            Clear
          </button>
        </div>
      </div>

      {/* The card — a real two-sided card that rotates in 3D on click */}
      <div className="h-80 w-full [perspective:1600px]">
        <motion.div
          onClick={() => setIsFlipped((f) => !f)}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
          className="relative h-full w-full cursor-pointer [transform-style:preserve-3d]"
        >
          {/* Front — the question or concept */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl
                       border border-white/10 bg-bg-800 p-8 shadow-lg [backface-visibility:hidden]"
          >
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-text-muted">
              Concept
            </p>
            <div className="custom-scrollbar max-h-[70%] w-full overflow-y-auto px-2 text-center">
              <h3 className="text-2xl font-bold text-accent-400">{card.front}</h3>
            </div>
            <p className="absolute bottom-5 flex items-center gap-1.5 text-xs text-text-muted">
              <RotateCw size={12} /> Click to reveal
            </p>
          </div>

          {/* Back — the answer, pre-rotated so it reads correctly when flipped */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl
                       border border-accent-500/30 bg-bg-panel p-8 shadow-lg
                       [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-text-muted">
              Answer
            </p>
            <div className="custom-scrollbar max-h-[75%] w-full overflow-y-auto px-2 text-center">
              <p className="text-base leading-relaxed text-text-main/90">{card.back}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="flex w-full items-center justify-between">
        <button
          onClick={() => go(-1)}
          className="btn-secondary flex items-center gap-1 px-4 py-2 text-sm"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span className="text-sm font-medium text-text-muted">
          {currentIndex + 1} / {cards.length}
        </span>
        <button
          onClick={() => go(1)}
          className="btn-secondary flex items-center gap-1 px-4 py-2 text-sm"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>

      {/* Rating — only meaningful once the answer has been seen */}
      <div className="h-14 w-full">
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-3"
          >
            <span className="mr-1 text-xs text-text-muted">How well did you know it?</span>
            <button
              onClick={() => handleRate(1)}
              className="rounded-xl border border-danger/20 bg-danger/10 px-5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
            >
              Hard
            </button>
            <button
              onClick={() => handleRate(2)}
              className="rounded-xl border border-warning/20 bg-warning/10 px-5 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/20"
            >
              Good
            </button>
            <button
              onClick={() => handleRate(3)}
              className="rounded-xl border border-success/20 bg-success/10 px-5 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20"
            >
              Easy
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
