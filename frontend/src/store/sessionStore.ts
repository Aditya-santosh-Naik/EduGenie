import { create } from 'zustand';

export type Mood = 'neutral' | 'confident' | 'confused' | 'frustrated';
export type ExplanationMode = 'text' | 'images' | 'story' | 'story+video';
export type Level = 'beginner' | 'intermediate' | 'advanced';

interface SessionState {
  currentTopic: string;
  mode: ExplanationMode;
  level: Level;
  mood: Mood;
  retryCount: number;
  sessionStart: number;
  explanation: Record<string, unknown> | null;
  isLoading: boolean;
  streamedText: string;

  setTopic: (topic: string) => void;
  setMode: (m: ExplanationMode) => void;
  setLevel: (l: Level) => void;
  setMood: (m: Mood) => void;
  setExplanation: (e: Record<string, unknown>) => void;
  setLoading: (v: boolean) => void;
  setStreamedText: (t: string) => void;
  appendStreamedText: (t: string) => void;
  incrementRetry: () => void;
  resetRetry: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentTopic: '',
  mode: 'text',
  level: 'beginner',
  mood: 'neutral',
  retryCount: 0,
  sessionStart: Date.now(),
  explanation: null,
  isLoading: false,
  streamedText: '',

  setTopic: (currentTopic) => set({ currentTopic }),
  setMode: (mode) => set({ mode }),
  setLevel: (level) => set({ level }),
  setMood: (mood) => set({ mood }),
  setExplanation: (explanation) => set({ explanation }),
  setLoading: (isLoading) => set({ isLoading }),
  setStreamedText: (streamedText) => set({ streamedText }),
  appendStreamedText: (t) => set((s) => ({ streamedText: s.streamedText + t })),
  incrementRetry: () =>
    set((s) => {
      const retryCount = s.retryCount + 1;
      const mood: Mood =
        retryCount >= 3 ? 'frustrated' : retryCount >= 2 ? 'confused' : s.mood;
      return { retryCount, mood };
    }),
  resetRetry: () => set({ retryCount: 0, mood: 'neutral' }),
  resetSession: () =>
    set({
      currentTopic: '',
      explanation: null,
      isLoading: false,
      streamedText: '',
      retryCount: 0,
      mood: 'neutral'
    })
}));
