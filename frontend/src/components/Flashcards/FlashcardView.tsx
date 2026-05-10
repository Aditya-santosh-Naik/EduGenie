import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../lib/db';
import { BookOpen, RefreshCw, Trash2, Brain } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSRS } from '../../hooks/useSRS';

export default function FlashcardView() {
  const allCards = useLiveQuery(() => db.flashcards.toArray()) || [];
  // Filter cards due for review
  const cards = allCards.filter(c => !c.nextReview || c.nextReview <= Date.now());
  const { reviewCard } = useSRS();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Ensure index is within bounds when cards array shrinks
  useEffect(() => {
    if (currentIndex >= cards.length && cards.length > 0) {
      setCurrentIndex(Math.max(0, cards.length - 1));
    }
  }, [cards.length, currentIndex]);

  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const clearDeck = async () => {
    if (confirm('Are you sure you want to delete all flashcards?')) {
      await db.flashcards.clear();
      setCurrentIndex(0);
    }
  };

  const handleRate = async (rating: 1 | 2 | 3) => {
    const cardId = cards[currentIndex]?.id;
    if (!cardId) return;
    
    await reviewCard(cardId, rating);
    setIsFlipped(false);
  };

  if (allCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 text-text-muted mt-24">
        <BookOpen size={48} className="opacity-50" />
        <h2 className="text-xl font-semibold">Your Study Deck is Empty</h2>
        <p>Generate an explanation and click "Save Flashcards" to add concepts here.</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 text-text-muted mt-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success">
          <Brain size={32} />
        </div>
        <h2 className="text-2xl font-bold text-text-main">You're all caught up!</h2>
        <p>You've reviewed all your due flashcards. Check back later.</p>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto space-y-8 mt-12">
      <div className="flex items-center justify-between w-full">
        <div>
          <h2 className="text-2xl font-bold">Active Recall</h2>
          <p className="text-text-muted text-sm">Topic: {currentCard.topic}</p>
        </div>
        <button
          onClick={clearDeck}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors text-sm"
        >
          <Trash2 size={16} />
          Clear Deck
        </button>
      </div>

      <div className="relative w-full h-80 perspective-1000">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentCard.id + (isFlipped ? '-back' : '-front')}
            initial={{ rotateX: isFlipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: isFlipped ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => !isFlipped && setIsFlipped(true)}
            className={`absolute inset-0 w-full h-full glass-card p-8 flex flex-col items-center justify-center cursor-pointer shadow-lg hover:shadow-xl transition-shadow ${
              isFlipped ? 'bg-primary/5 border-primary/20 cursor-default' : ''
            }`}
          >
            {!isFlipped && (
              <div className="absolute top-4 right-4 text-text-muted animate-pulse">
                <RefreshCw size={20} className="opacity-50" />
              </div>
            )}
            
            <p className="text-sm font-medium text-text-muted mb-4 tracking-wider uppercase">
              {isFlipped ? 'Answer' : 'Concept'}
            </p>
            
            <div className="text-center w-full max-h-[80%] overflow-y-auto custom-scrollbar px-4">
              {isFlipped ? (
                <p className="text-lg leading-relaxed text-text-main/90 font-mono">
                  {currentCard.back}
                </p>
              ) : (
                <h3 className="text-3xl font-bold text-accent-400">
                  {currentCard.front}
                </h3>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center w-full h-16">
        {isFlipped ? (
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleRate(1)}
              className="px-6 py-2 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors font-medium border border-danger/20 hover:scale-105 transform duration-200"
            >
              Hard
            </button>
            <button
              onClick={() => handleRate(2)}
              className="px-6 py-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors font-medium border border-amber-500/20 hover:scale-105 transform duration-200"
            >
              Good
            </button>
            <button
              onClick={() => handleRate(3)}
              className="px-6 py-2 rounded-xl bg-success/10 text-success hover:bg-success/20 transition-colors font-medium border border-success/20 hover:scale-105 transform duration-200"
            >
              Easy
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <button
              onClick={handlePrev}
              className="px-6 py-2 rounded-xl bg-surface-lighter hover:bg-surface-light transition-colors font-medium"
            >
              Previous
            </button>
            <div className="text-text-muted font-medium">
              {currentIndex + 1} / {cards.length}
            </div>
            <button
              onClick={() => setIsFlipped(true)}
              className="px-6 py-2 rounded-xl bg-primary hover:bg-primary-hover text-background transition-colors font-medium"
            >
              Show Answer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
