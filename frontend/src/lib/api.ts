import { useAuthStore, AuthUser } from '../store/authStore';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Call this before every fetch to get the auth header
function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

export interface AuthSession {
  user:  AuthUser;
  token: string;
}

/** Turn a non-2xx auth response into an Error carrying the server's message. */
async function authError(res: Response): Promise<Error> {
  let message = 'Something went wrong. Please try again.';
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) message = body.error;
  } catch {
    /* non-JSON body — keep the generic message */
  }
  return new Error(message);
}

async function postAuth(path: string, body?: unknown): Promise<AuthSession> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {})
    });
  } catch {
    throw new Error('Cannot reach the EduGenie server. Is the backend running on port 3001?');
  }
  if (!res.ok) throw await authError(res);
  return (await res.json()) as AuthSession;
}

export const authApi = {
  register: (email: string, password: string, name: string) =>
    postAuth('register', { email, password, name }),

  login: (email: string, password: string) =>
    postAuth('login', { email, password }),

  guest: () => postAuth('guest'),

  /** Validate a persisted token on app start. */
  me: async (token: string): Promise<AuthUser> => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw await authError(res);
    return ((await res.json()) as { user: AuthUser }).user;
  }
};

/** Stream explanation from SSE endpoint */
export async function* streamExplanation(
  topic: string,
  mode: string,
  level: string,
  userId?: string,
  signal?: AbortSignal
): AsyncGenerator<{ type: string; data: string }> {
  // The signal has to reach fetch, not just exist: the backend watches the
  // request for abort and stops the Ollama call with it, which is what frees
  // the GPU when a student changes their mind mid-explanation.
  const res = await fetch(`${BASE}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ topic, mode, level, userId }),
    signal
  });

  if (!res.ok) {
    const errText = await res.text();
    try {
      const parsed = JSON.parse(errText);
      throw new Error(parsed.error || errText);
    } catch (e) {
      if (e instanceof Error && e.message !== errText) throw e;
      throw new Error(errText);
    }
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      
      const lines = chunk.split('\n');
      let currentEvent = 'message';
      const dataChunks: string[] = [];
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataChunks.push(line.slice(5).replace(/^ /, ''));
        }
      }
      
      if (dataChunks.length > 0) {
        yield { type: currentEvent, data: dataChunks.join('\n') };
      }
      
      boundary = buffer.indexOf('\n\n');
    }
  }
}

/** Stream quiz from SSE endpoint */
export async function* streamQuiz(
  topic: string,
  level: string,
  questionCount = 5,
  /** Questions already answered, so "more questions" doesn't repeat them. */
  exclude?: string
): AsyncGenerator<{ type: string; data: string }> {
  const res = await fetch(`${BASE}/api/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ topic, level, questionCount, exclude })
  });

  if (!res.ok) throw new Error(await res.text());

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      
      const lines = chunk.split('\n');
      let currentEvent = 'message';
      const dataChunks: string[] = [];
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataChunks.push(line.slice(5).replace(/^ /, ''));
        }
      }
      
      if (dataChunks.length > 0) {
        yield { type: currentEvent, data: dataChunks.join('\n') };
      }
      
      boundary = buffer.indexOf('\n\n');
    }
  }
}

export const api = {
  explain: { stream: streamExplanation },
  quiz: { stream: streamQuiz },
  voice: {
    tts: async (text: string): Promise<ArrayBuffer | null> => {
      try {
        const res = await fetch(`${BASE}/api/voice/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ text })
        });
        if (!res.ok) return null;
        return res.arrayBuffer();
      } catch {
        return null;
      }
    },
    stt: async (audioBlob: Blob): Promise<string | null> => {
      try {
        const fd = new FormData();
        fd.append('audio', audioBlob, 'audio.wav');
        const res = await fetch(`${BASE}/api/voice/stt`, { method: 'POST', headers: { ...getAuthHeaders() }, body: fd });
        if (!res.ok) return null;
        return ((await res.json()) as { transcript: string }).transcript;
      } catch {
        return null;
      }
    }
  },
  rag: {
    upload: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${BASE}/api/rag/upload`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        body: fd
      });
      return res.json();
    },
    search: async (query: string, topK?: number) => {
      const res = await fetch(`${BASE}/api/rag/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ query, topK })
      });
      return res.json();
    },
    stats: async () => {
      const res = await fetch(`${BASE}/api/rag/stats`, { headers: { ...getAuthHeaders() } });
      return res.json();
    },
    clear: async () => {
      const res = await fetch(`${BASE}/api/rag/documents`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      });
      return res.json();
    }
  },
  media: {
    generateVideo: async (topic: string) => {
      const res = await fetch(`${BASE}/api/media/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ topic })
      });
      return res.json();
    },
    videoStatus: async (jobId: string) => {
      const res = await fetch(`${BASE}/api/media/video/status/${jobId}`, { headers: { ...getAuthHeaders() } });
      return res.json();
    }
  },
  gamification: {
    profile: async (userId: string) => {
      const res = await fetch(`${BASE}/api/gamification/profile/${userId}`, { headers: { ...getAuthHeaders() } });
      return res.json();
    },
    addXP: async (userId: string, amount: number, reason: string) => {
      const res = await fetch(`${BASE}/api/gamification/xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId, amount, reason })
      });
      return res.json();
    },
    updateStreak: async (userId: string) => {
      const res = await fetch(`${BASE}/api/gamification/streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId })
      });
      return res.json();
    }
  },
  image: {
    /**
     * Generating one FLUX image on a 6GB card takes ~80s warm, longer while the
     * model is still paging in — so the ceiling is generous, but it must exist:
     * without one a failed job left the UI spinning forever.
     */
    generate: async (prompt: string, style = 'illustration'): Promise<string> => {
      let res: Response;
      try {
        res = await fetch(`${BASE}/api/explain/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ prompt, style }),
          signal: AbortSignal.timeout(480_000)
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'TimeoutError') {
          throw new Error('Image generation timed out. The GPU may still be busy — try again.');
        }
        throw new Error('Cannot reach the EduGenie server.');
      }

      const data = (await res.json().catch(() => ({}))) as {
        imageUrl?: string | null;
        error?: string;
      };
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'Image generation failed. Please try again.');
      }
      return data.imageUrl;
    }
  }
};
