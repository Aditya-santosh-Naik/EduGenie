import { useAuthStore } from '../store/authStore';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Call this before every fetch to get the auth header
function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().user?.idToken;
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

/** Stream explanation from SSE endpoint */
export async function* streamExplanation(
  topic: string,
  mode: string,
  level: string,
  userId?: string
): AsyncGenerator<{ type: string; data: string }> {
  const res = await fetch(`${BASE}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ topic, mode, level, userId })
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
  level: string
): AsyncGenerator<{ type: string; data: string }> {
  const res = await fetch(`${BASE}/api/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ topic, level })
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
    upload: async (file: File, userId: string) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('userId', userId);
      const res = await fetch(`${BASE}/api/rag/upload`, { method: 'POST', headers: { ...getAuthHeaders() }, body: fd });
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
    generate: async (prompt: string): Promise<string | null> => {
      try {
        const res = await fetch(`${BASE}/api/explain/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ prompt })
        });
        const data = (await res.json()) as { imageUrl: string | null };
        return data.imageUrl;
      } catch {
        return null;
      }
    }
  }
};
